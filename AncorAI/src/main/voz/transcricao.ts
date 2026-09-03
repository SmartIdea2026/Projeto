import { join } from 'node:path';
import { utilityProcess, type UtilityProcess } from 'electron';
import type { ProgressoModeloVoz, RespostaTranscricao } from '../../compartilhado/tipos';
import { lerConfigVoz } from './config';
import { apagarModelo, modeloIntegro } from './modelo';

/**
 * Orquestra o `utilityProcess` de transcrição (ADR-0008).
 *
 * O processo principal nunca carrega o runtime de ML: ele só troca mensagens
 * com o worker. As submissões são **uma por vez** — o worker tem um modelo só
 * na memória, e transcrições paralelas competiriam por ele.
 *
 * O diretório de dados chega de fora (de `main/index.ts`), não é descoberto
 * aqui: assim o resto do módulo — a fila, o ciclo do worker — fica exercitável
 * em teste com o `utilityProcess` dublado.
 */

const CAMINHO_WORKER = join(__dirname, 'voz-worker.js');
const TIMEOUT_TRANSCRICAO_MS = 60_000;
const TIMEOUT_DOWNLOAD_MS = 10 * 60_000;

let diretorioDados = '';
let worker: UtilityProcess | null = null;
let prontoDoWorker: Promise<void> | null = null;
let fila: Promise<unknown> = Promise.resolve();

export function inicializarVoz(diretorio: string): void {
  diretorioDados = diretorio;
}

function cacheDir(): string {
  return join(diretorioDados, 'modelos');
}

/** Encerra o worker — na saída da aplicação ou ao desativar a busca por voz. */
export function encerrarVoz(): void {
  worker?.kill();
  worker = null;
  prontoDoWorker = null;
}

function iniciarWorker(permitirDownload: boolean): {
  processo: UtilityProcess;
  pronto: Promise<void>;
} {
  const config = lerConfigVoz();
  const processo = utilityProcess.fork(CAMINHO_WORKER, [], {
    serviceName: 'ancorai-voz'
  });

  const pronto = new Promise<void>((resolve, reject) => {
    const aoMensagem = (msg: Record<string, unknown>): void => {
      if (msg['tipo'] === 'pronto') {
        processo.off('message', aoMensagem);
        resolve();
      } else if (msg['tipo'] === 'erro') {
        processo.off('message', aoMensagem);
        reject(new Error(String(msg['mensagem'] ?? 'Falha no worker de voz.')));
      }
    };
    processo.on('message', aoMensagem);
    processo.once('exit', () => reject(new Error('O worker de voz encerrou antes de ficar pronto.')));
  });

  processo.postMessage({
    tipo: 'init',
    cacheDir: cacheDir(),
    permitirDownload,
    config: {
      modelo: config.modelo,
      revisao: config.revisao,
      quantizacao: config.quantizacao,
      idioma: config.idioma,
      tarefa: config.tarefa,
      chunkLengthS: config.chunkLengthS,
      noSpeechThreshold: config.noSpeechThreshold
    }
  });

  return { processo, pronto };
}

/**
 * Baixa o modelo, informando o progresso, e confere a integridade ao fim.
 *
 * Roda num worker efêmero com download habilitado, separado do worker de
 * transcrição (que nunca toca a rede). Falha de download ou hash divergente
 * apaga a pasta do modelo e lança — quem chamou volta `vozAtiva` para `false`.
 */
export async function baixarModelo(
  aoProgresso: (progresso: ProgressoModeloVoz) => void
): Promise<void> {
  const config = lerConfigVoz();

  if (await modeloIntegro(diretorioDados, config)) return;

  const { processo, pronto } = iniciarWorker(true);

  const aoMensagem = (msg: Record<string, unknown>): void => {
    if (msg['tipo'] === 'progresso') {
      aoProgresso({
        recebidos: Number(msg['recebidos'] ?? 0),
        total: Number(msg['total'] ?? 0),
        arquivo: String(msg['arquivo'] ?? '')
      });
    }
  };
  processo.on('message', aoMensagem);

  const prazo = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('O download do modelo demorou demais.')), TIMEOUT_DOWNLOAD_MS)
  );

  try {
    await Promise.race([pronto, prazo]);
  } catch (erro) {
    processo.kill();
    await apagarModelo(diretorioDados, config);
    throw erro instanceof Error ? erro : new Error('Falha ao baixar o modelo de voz.');
  }

  processo.kill();

  if (!(await modeloIntegro(diretorioDados, config))) {
    await apagarModelo(diretorioDados, config);
    throw new Error('O modelo baixado não passou na verificação de integridade.');
  }
}

async function garantirWorker(): Promise<void> {
  const config = lerConfigVoz();
  if (!(await modeloIntegro(diretorioDados, config))) {
    throw new Error('modelo-ausente');
  }

  if (worker && prontoDoWorker) {
    await prontoDoWorker;
    return;
  }

  const { processo, pronto } = iniciarWorker(false);
  worker = processo;
  prontoDoWorker = pronto;
  processo.once('exit', () => {
    if (worker === processo) encerrarVoz();
  });

  await pronto;
}

/**
 * Transcreve um trecho de PCM (16 kHz mono Float32, como `ArrayBuffer`).
 *
 * Devolve `{ texto }` ou `{ texto: null, motivo }` — nunca lança. `vazio`
 * quando a transcrição não reconheceu fala; `falha-transcricao` quando o worker
 * caiu ou estourou o prazo.
 */
export function transcrever(pcm: ArrayBuffer): Promise<RespostaTranscricao> {
  const tarefa = fila.then(async (): Promise<RespostaTranscricao> => {
    try {
      await garantirWorker();
    } catch (erro) {
      const motivo = erro instanceof Error && erro.message === 'modelo-ausente'
        ? 'modelo-ausente'
        : 'falha-transcricao';
      return { texto: null, motivo };
    }

    const processo = worker;
    if (!processo) return { texto: null, motivo: 'falha-transcricao' };

    return new Promise<RespostaTranscricao>((resolve) => {
      const prazo = setTimeout(() => {
        processo.off('message', aoMensagem);
        resolve({ texto: null, motivo: 'falha-transcricao' });
      }, TIMEOUT_TRANSCRICAO_MS);

      const aoMensagem = (msg: Record<string, unknown>): void => {
        if (msg['tipo'] === 'transcrito') {
          clearTimeout(prazo);
          processo.off('message', aoMensagem);
          const texto = String(msg['texto'] ?? '').trim();
          resolve(texto ? { texto } : { texto: null, motivo: 'vazio' });
        } else if (msg['tipo'] === 'erro') {
          clearTimeout(prazo);
          processo.off('message', aoMensagem);
          resolve({ texto: null, motivo: 'falha-transcricao' });
        }
      };

      processo.on('message', aoMensagem);
      // O `postMessage` do utilityProcess clona a mensagem (não aceita lista de
      // transferência de ArrayBuffer). São centenas de KB de PCM — cópia barata.
      processo.postMessage({ tipo: 'transcrever', pcm });
    });
  });

  fila = tarefa.catch(() => undefined);
  return tarefa;
}

/** Estado do modelo no disco, para o canal de estado. */
export async function modeloEstaPronto(): Promise<boolean> {
  try {
    return await modeloIntegro(diretorioDados, lerConfigVoz());
  } catch {
    return false;
  }
}
