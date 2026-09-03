import type { CapturaVoz, MicrofoneDisponivel } from '../../compartilhado/tipos';

/**
 * Captura de áudio para o ditado na busca (ADR-0008).
 *
 * Grava do microfone, encerra sozinha após um intervalo de silêncio (ou quando
 * o usuário manda parar, ou no teto de duração), e devolve PCM mono na taxa que
 * o Whisper espera — reamostrado aqui, via Web Audio, sem depender de ffmpeg.
 *
 * Nada de Web Audio / `getUserMedia` / `MediaRecorder` no topo do módulo: o
 * jsdom não os tem, e os testes dublam o que precisam. Tudo roda dentro de
 * `iniciarCaptura`.
 */

export type MotivoFimCaptura = 'silencio' | 'manual' | 'teto' | 'cancelado';

export interface ResultadoCaptura {
  motivo: MotivoFimCaptura;
  /** PCM 16 kHz mono Float32 como `ArrayBuffer`; ausente quando não houve fala. */
  pcm?: ArrayBuffer;
  /** Energia RMS do áudio capturado (0–1), para diagnóstico de microfone mudo. */
  nivel?: number;
}

export interface ControleCaptura {
  parar(): void;
  cancelar(): void;
  readonly resultado: Promise<ResultadoCaptura>;
}

/** Lançado quando o navegador nega o microfone. */
export class ErroPermissaoMicrofone extends Error {
  constructor() {
    super('Acesso ao microfone negado.');
    this.name = 'ErroPermissaoMicrofone';
  }
}

/**
 * Abre e fecha o microfone só para o navegador registrar a permissão.
 *
 * Chamado pelo "permitir" do primeiro uso e pelo botão de listar dispositivos
 * nas configurações: sem uma concessão, `enumerarMicrofones` devolve a lista
 * sem os nomes. Devolve `true` se a permissão foi concedida.
 */
export async function solicitarPermissaoMicrofone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((faixa) => faixa.stop());
    return true;
  } catch {
    return false;
  }
}

/**
 * Lista os microfones que o navegador conhece.
 *
 * Os `rotulo` só vêm preenchidos depois de a permissão ter sido concedida ao
 * menos uma vez nesta origem.
 */
export async function enumerarMicrofones(): Promise<MicrofoneDisponivel[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const dispositivos = await navigator.mediaDevices.enumerateDevices();
  return dispositivos
    .filter((d) => d.kind === 'audioinput')
    .map((d) => ({ id: d.deviceId, rotulo: d.label }));
}

/** RMS de um bloco de amostras. */
function energia(amostras: Float32Array): number {
  let soma = 0;
  for (const v of amostras) soma += v * v;
  return Math.sqrt(soma / Math.max(amostras.length, 1));
}

interface Reamostragem {
  pcm: Float32Array;
  nivel: number;
}

async function reamostrarParaMono(
  blob: Blob,
  taxaAlvo: number
): Promise<Reamostragem | null> {
  const bytes = await blob.arrayBuffer();
  if (bytes.byteLength === 0) return null;

  const contexto = new AudioContext();
  try {
    const decodificado = await contexto.decodeAudioData(bytes);
    const quadros = Math.ceil((decodificado.duration || 0) * taxaAlvo);
    const offline = new OfflineAudioContext(1, Math.max(quadros, 1), taxaAlvo);
    const fonte = offline.createBufferSource();
    fonte.buffer = decodificado;
    fonte.connect(offline.destination);
    fonte.start();
    const renderizado = await offline.startRendering();
    const amostras = renderizado.getChannelData(0);
    return { pcm: amostras.slice(), nivel: energia(amostras) };
  } finally {
    void contexto.close();
  }
}

/**
 * Abre o microfone escolhido; volta ao padrão do sistema se ele tiver sumido.
 *
 * Um `deviceId` fixo pode não existir mais (fone desconectado, entrada trocada
 * no SO). Nesse caso o navegador lança `OverconstrainedError` — aí vale mais
 * gravar pelo microfone padrão do que recusar o ditado.
 */
async function abrirMicrofone(dispositivoId: string | null): Promise<MediaStream> {
  // Processamento do navegador ligado de propósito: cancela eco, reduz ruído de
  // fundo e nivela o ganho — o modelo transcreve melhor uma fala limpa e com
  // volume constante do que o sinal cru.
  const audio: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    ...(dispositivoId ? { deviceId: { exact: dispositivoId } } : {})
  };
  try {
    return await navigator.mediaDevices.getUserMedia({ audio });
  } catch (erro) {
    const semDispositivo =
      erro instanceof DOMException &&
      (erro.name === 'OverconstrainedError' || erro.name === 'NotFoundError');
    if (dispositivoId && semDispositivo) {
      try {
        const { deviceId: _, ...semId } = audio;
        return await navigator.mediaDevices.getUserMedia({ audio: semId });
      } catch {
        throw new ErroPermissaoMicrofone();
      }
    }
    throw new ErroPermissaoMicrofone();
  }
}

/**
 * Começa a capturar. Resolve `ControleCaptura` assim que o microfone abre;
 * `resultado` resolve quando a captura encerra.
 *
 * `dispositivoId` fixa qual microfone captar; ausente ou `null` usa o padrão do
 * sistema. Lança `ErroPermissaoMicrofone` se `getUserMedia` for negado.
 */
export async function iniciarCaptura(
  captura: CapturaVoz,
  dispositivoId?: string | null
): Promise<ControleCaptura> {
  const stream = await abrirMicrofone(dispositivoId ?? null);

  const contexto = new AudioContext();
  // Um AudioContext pode nascer suspenso pela política de autoplay; sem retomar,
  // o analisador não recebe amostras.
  if (contexto.state === 'suspended') await contexto.resume();

  const fonte = contexto.createMediaStreamSource(stream);
  const analisador = contexto.createAnalyser();
  analisador.fftSize = 2048;
  // O grafo só é "puxado" se houver caminho até o destino. Um ganho zero leva o
  // sinal ao destino (mantendo o analisador ativo) sem tocar nada nos alto-
  // falantes — evita o eco de ouvir o próprio microfone.
  const ganhoZero = contexto.createGain();
  ganhoZero.gain.value = 0;
  fonte.connect(analisador);
  analisador.connect(ganhoZero);
  ganhoZero.connect(contexto.destination);

  // Bitrate mais alto que o padrão (~40 kbps): a fala comprimida demais chega
  // abafada ao modelo. 128 kbps é folgado para voz. Se o navegador recusar a
  // opção, cai no construtor simples.
  let gravador: MediaRecorder;
  try {
    gravador = new MediaRecorder(stream, { audioBitsPerSecond: 128_000 });
  } catch {
    gravador = new MediaRecorder(stream);
  }
  const pedacos: Blob[] = [];
  gravador.ondataavailable = (evento) => {
    if (evento.data.size > 0) pedacos.push(evento.data);
  };

  let encerrado = false;
  let motivo: MotivoFimCaptura = 'manual';
  let resolver!: (r: ResultadoCaptura) => void;
  const resultado = new Promise<ResultadoCaptura>((r) => (resolver = r));

  const amostras = new Uint8Array(analisador.fftSize);
  let ultimoSomAlto = performance.now();
  // A parada por silêncio só é armada depois que houve fala: sem isso, uma
  // pausa entre tocar o botão e começar a falar encerraria a captura antes de
  // qualquer palavra, e o trecho de silêncio faz o Whisper "alucinar".
  let houveFala = false;

  const limparRecursos = (): void => {
    clearInterval(intervalo);
    clearTimeout(teto);
    stream.getTracks().forEach((faixa) => faixa.stop());
    void contexto.close();
  };

  const finalizar = (): void => {
    if (encerrado) return;
    encerrado = true;
    limparRecursos();

    if (motivo === 'cancelado') {
      resolver({ motivo });
      return;
    }

    gravador.onstop = () => {
      const mistura = new Blob(pedacos, { type: gravador.mimeType || 'audio/webm' });
      reamostrarParaMono(mistura, captura.taxaAmostragemHz)
        .then((r) => {
          if (!r) {
            resolver({ motivo: 'silencio', nivel: 0 });
            return;
          }
          // A decisão de "houve fala" é do áudio de verdade, não do medidor ao
          // vivo (que pode falhar em certos navegadores). Trecho curto demais
          // ou praticamente mudo → "não ouvi nada", com o nível para diagnóstico.
          const curto = r.pcm.length < captura.taxaAmostragemHz * 0.3;
          const mudo = r.nivel < 0.004;
          resolver(
            curto || mudo
              ? { motivo: 'silencio', nivel: r.nivel }
              : { motivo, pcm: r.pcm.buffer as ArrayBuffer, nivel: r.nivel }
          );
        })
        .catch(() => resolver({ motivo: 'silencio', nivel: 0 }));
    };
    if (gravador.state !== 'inactive') gravador.stop();
    else gravador.onstop?.(new Event('stop'));
  };

  const intervalo = setInterval(() => {
    analisador.getByteTimeDomainData(amostras);
    let soma = 0;
    for (const v of amostras) {
      const centrado = (v - 128) / 128;
      soma += centrado * centrado;
    }
    const rms = Math.sqrt(soma / amostras.length);

    const agora = performance.now();
    if (rms >= captura.silencioLimiarRms * 1.5) {
      houveFala = true;
      ultimoSomAlto = agora;
    } else if (rms >= captura.silencioLimiarRms) {
      ultimoSomAlto = agora;
    } else if (houveFala && agora - ultimoSomAlto >= captura.silencioDuracaoMs) {
      motivo = 'silencio';
      finalizar();
    }
  }, 100);

  const teto = setTimeout(() => {
    motivo = 'teto';
    finalizar();
  }, captura.duracaoMaximaS * 1000);

  gravador.start();

  return {
    parar() {
      motivo = 'manual';
      finalizar();
    },
    cancelar() {
      motivo = 'cancelado';
      finalizar();
    },
    resultado
  };
}
