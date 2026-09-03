/**
 * Corpo do `utilityProcess` de transcrição (ADR-0008).
 *
 * A inferência do Whisper é CPU-bound e levaria o event loop do processo
 * principal junto se rodasse lá. Aqui ela roda isolada: um crash do runtime de
 * ML derruba só este processo, e o principal segue respondendo.
 *
 * `@huggingface/transformers` é ESM e pesado — carregado com `await import()`,
 * nunca no topo. O binário nativo do `onnxruntime-node` (CPU) faz a inferência;
 * os execution providers de GPU são excluídos do pacote (`electron-builder.yml`).
 *
 * Protocolo (mensagens por `process.parentPort`):
 *   ◀ { tipo: 'init', cacheDir, config, permitirDownload }
 *   ▶ { tipo: 'progresso', recebidos, total, arquivo }   (durante o download)
 *   ▶ { tipo: 'pronto' }                                  (pipeline carregado)
 *   ◀ { tipo: 'transcrever', pcm: ArrayBuffer }
 *   ▶ { tipo: 'transcrito', texto }
 *   ▶ { tipo: 'erro', mensagem }
 */

interface ConfigWorker {
  modelo: string;
  revisao: string;
  quantizacao: string;
  /** Código do idioma para o Whisper, ou `"auto"`/vazio para autodetecção. */
  idioma: string;
  tarefa: string;
  chunkLengthS: number;
  noSpeechThreshold: number;
}

type Transcritor = (
  pcm: Float32Array,
  opcoes: Record<string, unknown>
) => Promise<{ text?: string }>;

const porta = process.parentPort;

let transcritor: Transcritor | null = null;
let opcoesTranscricao: Record<string, unknown> = {};

function erro(mensagem: string): void {
  porta.postMessage({ tipo: 'erro', mensagem });
}

/**
 * Deixa só as palavras ditadas.
 *
 * O Whisper anota sons entre colchetes ou parênteses (`[Música]`, `(applause)`)
 * e pontua a transcrição (ponto, vírgula, "!", "?") — nada disso faz sentido num
 * termo de busca: "roadmap." não casa com "roadmap". Remove as anotações
 * inteiras, tira a pontuação de frase, mantém hífen e apóstrofo internos
 * ("guarda-chuva"), e junta os espaços que sobraram.
 */
function limparPontuacao(texto: string): string {
  return texto
    .replace(/\[[^\]]*\]|\([^)]*\)|♪[^♪]*♪/g, ' ')
    .replace(/[.,!?;:…"“”«»()[\]{}♪*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function carregar(
  cacheDir: string,
  config: ConfigWorker,
  permitirDownload: boolean
): Promise<void> {
  const { pipeline, env } = await import('@huggingface/transformers');

  env.cacheDir = cacheDir;
  env.allowLocalModels = true;
  env.allowRemoteModels = permitirDownload;

  // O transformers.js 3.8 NÃO detecta idioma: sem `language` ele assume inglês
  // ("No language specified - defaulting to English") e o Whisper acaba
  // vertendo o português para o inglês. Então o idioma é sempre fixo — `auto`
  // ou vazio na config cai em português.
  const idioma = config.idioma && config.idioma !== 'auto' ? config.idioma : 'portuguese';
  opcoesTranscricao = {
    language: idioma,
    // `transcribe` (nunca `translate`): a saída é a fala literal, no idioma
    // `idioma`, sem tradução.
    task: config.tarefa,
    chunk_length_s: config.chunkLengthS,
    // `return_timestamps: true` faz o Whisper aplicar o corte por "sem fala"
    // segmento a segmento: um trecho mudo vira texto vazio em vez de uma frase
    // inventada. O `.text` da saída continua sendo a transcrição completa.
    return_timestamps: true,
    no_speech_threshold: config.noSpeechThreshold,
    temperature: 0
  };

  transcritor = (await pipeline('automatic-speech-recognition', config.modelo, {
    dtype: config.quantizacao as 'q8',
    revision: config.revisao,
    progress_callback: (evento: {
      status: string;
      file?: string;
      loaded?: number;
      total?: number;
    }) => {
      if (evento.status === 'progress' && evento.file) {
        porta.postMessage({
          tipo: 'progresso',
          arquivo: evento.file,
          recebidos: evento.loaded ?? 0,
          total: evento.total ?? 0
        });
      }
    }
  })) as unknown as Transcritor;

  porta.postMessage({ tipo: 'pronto' });
}

async function transcrever(pcm: Float32Array): Promise<void> {
  if (!transcritor) {
    erro('Modelo de voz não carregado.');
    return;
  }
  try {
    const saida = await transcritor(pcm, opcoesTranscricao);
    porta.postMessage({ tipo: 'transcrito', texto: limparPontuacao(String(saida.text ?? '')) });
  } catch (falha) {
    erro(falha instanceof Error ? falha.message : 'Falha na transcrição.');
  }
}

porta.on('message', (evento: { data: Record<string, unknown> }) => {
  const msg = evento.data;

  if (msg['tipo'] === 'init') {
    carregar(
      msg['cacheDir'] as string,
      msg['config'] as ConfigWorker,
      Boolean(msg['permitirDownload'])
    ).catch((falha: unknown) =>
      erro(falha instanceof Error ? falha.message : 'Falha ao carregar o modelo.')
    );
    return;
  }

  if (msg['tipo'] === 'transcrever') {
    void transcrever(new Float32Array(msg['pcm'] as ArrayBuffer));
  }
});
