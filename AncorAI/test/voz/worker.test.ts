// @vitest-environment node

import { EventEmitter } from 'node:events';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Corpo do utilityProcess de transcrição.
 *
 * `process.parentPort` e o `@huggingface/transformers` são dublados. O foco: o
 * worker carrega o pipeline no `init`, anuncia `pronto`, e devolve `transcrito`
 * / `erro` conforme a inferência — sem deixar exceção escapar.
 */

class PortaFalsa extends EventEmitter {
  postMessage = vi.fn();
  // A porta real usa MessageEvent ({ data }); o worker lê `evento.data`.
  emitirMensagem(data: unknown): void {
    this.emit('message', { data });
  }
}

const porta = new PortaFalsa();
const transcritor = vi.fn(async (_pcm: unknown, _opcoes?: unknown) => ({
  text: '  buscar ata  '
}));
const pipeline = vi.fn(async () => transcritor);

// O worker lê `process.parentPort` no topo — só existe num utilityProcess.
(process as unknown as { parentPort: unknown }).parentPort = porta;
vi.mock('@huggingface/transformers', () => ({
  pipeline: (...args: unknown[]) => pipeline(...args),
  env: {}
}));

const CONFIG = {
  modelo: 'm',
  revisao: 'r',
  quantizacao: 'q8',
  idioma: 'portuguese',
  tarefa: 'transcribe',
  chunkLengthS: 30,
  noSpeechThreshold: 0.6
};

beforeEach(async () => {
  vi.clearAllMocks();
  transcritor.mockResolvedValue({ text: '  buscar ata  ' });
  porta.removeAllListeners();
  await import('../../src/main/voz/worker');
});

afterEach(() => {
  vi.resetModules();
});

afterAll(() => {
  delete (process as unknown as { parentPort?: unknown }).parentPort;
});

async function aguardar(): Promise<void> {
  await new Promise((r) => setImmediate(r));
}

describe('worker de transcrição', () => {
  it('carrega o pipeline no init e anuncia "pronto"', async () => {
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: false });
    await aguardar();

    expect(pipeline).toHaveBeenCalledWith(
      'automatic-speech-recognition',
      'm',
      expect.objectContaining({ dtype: 'q8', revision: 'r' })
    );
    expect(porta.postMessage).toHaveBeenCalledWith({ tipo: 'pronto' });
  });

  it('transcreve e devolve o texto aparado', async () => {
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: false });
    await aguardar();
    porta.postMessage.mockClear();

    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();

    expect(porta.postMessage).toHaveBeenCalledWith({ tipo: 'transcrito', texto: 'buscar ata' });
  });

  it('remove a pontuação de frase, deixando só as palavras', async () => {
    transcritor.mockResolvedValue({ text: ' Roadmap de setembro, requisitos! ' });
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: false });
    await aguardar();
    porta.postMessage.mockClear();

    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();

    expect(porta.postMessage).toHaveBeenCalledWith({
      tipo: 'transcrito',
      texto: 'Roadmap de setembro requisitos'
    });
  });

  it('remove as anotações de som do Whisper ([Música], (applause))', async () => {
    transcritor.mockResolvedValue({ text: '[Música] roadmap (applause)' });
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: false });
    await aguardar();
    porta.postMessage.mockClear();

    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();

    expect(porta.postMessage).toHaveBeenCalledWith({ tipo: 'transcrito', texto: 'roadmap' });
  });

  it('mantém hífen interno das palavras', async () => {
    transcritor.mockResolvedValue({ text: 'guarda-chuva.' });
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: false });
    await aguardar();
    porta.postMessage.mockClear();

    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();

    expect(porta.postMessage).toHaveBeenCalledWith({ tipo: 'transcrito', texto: 'guarda-chuva' });
  });

  it('passa o idioma da config, sempre com task transcribe (nunca translate)', async () => {
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: false });
    await aguardar();

    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();

    expect(transcritor.mock.calls[0]![1]).toMatchObject({
      language: 'portuguese',
      task: 'transcribe'
    });
  });

  it('idioma "auto" recai em português (o transformers.js 3.8 não detecta idioma)', async () => {
    porta.emitirMensagem({
      tipo: 'init',
      cacheDir: '/tmp/c',
      config: { ...CONFIG, idioma: 'auto' },
      permitirDownload: false
    });
    await aguardar();

    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();

    expect(transcritor.mock.calls[0]![1]).toMatchObject({ language: 'portuguese' });
  });

  it('devolve erro quando a inferência lança, sem propagar a exceção', async () => {
    transcritor.mockRejectedValue(new Error('sessão morreu'));
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: false });
    await aguardar();
    porta.postMessage.mockClear();

    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();

    expect(porta.postMessage).toHaveBeenCalledWith({ tipo: 'erro', mensagem: 'sessão morreu' });
  });

  it('devolve erro se pedirem transcrição antes do init', async () => {
    porta.emitirMensagem({ tipo: 'transcrever', pcm: new Float32Array(16).buffer });
    await aguardar();
    expect(porta.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'erro' })
    );
  });

  it('reporta falha de carregamento do pipeline como erro', async () => {
    pipeline.mockRejectedValue(new Error('modelo corrompido'));
    porta.emitirMensagem({ tipo: 'init', cacheDir: '/tmp/c', config: CONFIG, permitirDownload: true });
    await aguardar();
    expect(porta.postMessage).toHaveBeenCalledWith({ tipo: 'erro', mensagem: 'modelo corrompido' });
  });
});
