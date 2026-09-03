// @vitest-environment node

import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Orquestração do utilityProcess de transcrição.
 *
 * O processo real roda o Whisper; aqui ele é dobrado por um EventEmitter que o
 * teste controla. O foco: sucesso, transcrição vazia (→ motivo `vazio`),
 * timeout e queda do worker (→ `falha-transcricao`, sem derrubar o teste).
 */

class ProcessoFalso extends EventEmitter {
  postMessage = vi.fn((msg: Record<string, unknown>) => aoEnviar?.(msg, this));
  kill = vi.fn();
}

let aoEnviar: ((msg: Record<string, unknown>, proc: ProcessoFalso) => void) | undefined;
const forkado: ProcessoFalso[] = [];

vi.mock('electron', () => ({
  utilityProcess: {
    fork: vi.fn(() => {
      const p = new ProcessoFalso();
      forkado.push(p);
      return p;
    })
  }
}));

vi.mock('../../src/main/voz/config', () => ({
  lerConfigVoz: () => ({
    modelo: 'm',
    revisao: 'r',
    quantizacao: 'q8',
    idioma: 'portuguese',
    tarefa: 'transcribe',
    chunkLengthS: 30,
    noSpeechThreshold: 0.6,
    captura: { silencioLimiarRms: 0.01, silencioDuracaoMs: 1500, duracaoMaximaS: 30, taxaAmostragemHz: 16000 }
  })
}));

const modeloIntegro = vi.fn(async () => true);
vi.mock('../../src/main/voz/modelo', () => ({
  modeloIntegro: () => modeloIntegro(),
  apagarModelo: vi.fn(async () => undefined)
}));

const { inicializarVoz, transcrever, encerrarVoz } = await import('../../src/main/voz/transcricao');

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  inicializarVoz('/tmp/dados');
  forkado.length = 0;
  modeloIntegro.mockResolvedValue(true);
  const { utilityProcess } = await import('electron');
  (utilityProcess.fork as ReturnType<typeof vi.fn>).mockClear();
  // Padrão: o worker fica pronto e devolve uma transcrição.
  aoEnviar = (msg, proc) => {
    if (msg['tipo'] === 'init') queueMicrotask(() => proc.emit('message', { tipo: 'pronto' }));
    if (msg['tipo'] === 'transcrever') {
      queueMicrotask(() => proc.emit('message', { tipo: 'transcrito', texto: 'buscar roadmap' }));
    }
  };
});

afterEach(() => {
  encerrarVoz();
  vi.useRealTimers();
  aoEnviar = undefined;
});

describe('transcrever', () => {
  it('devolve o texto quando o worker responde', async () => {
    const p = transcrever(new ArrayBuffer(16));
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ texto: 'buscar roadmap' });
  });

  it('reaproveita o mesmo worker entre chamadas', async () => {
    await Promise.all([
      (async () => {
        const r = transcrever(new ArrayBuffer(16));
        await vi.runAllTimersAsync();
        return r;
      })()
    ]);
    const r2 = transcrever(new ArrayBuffer(16));
    await vi.runAllTimersAsync();
    await r2;

    const { utilityProcess } = await import('electron');
    expect(utilityProcess.fork).toHaveBeenCalledTimes(1);
  });

  it('devolve motivo "vazio" quando a transcrição não reconheceu fala', async () => {
    aoEnviar = (msg, proc) => {
      if (msg['tipo'] === 'init') queueMicrotask(() => proc.emit('message', { tipo: 'pronto' }));
      if (msg['tipo'] === 'transcrever') {
        queueMicrotask(() => proc.emit('message', { tipo: 'transcrito', texto: '   ' }));
      }
    };
    const p = transcrever(new ArrayBuffer(16));
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ texto: null, motivo: 'vazio' });
  });

  it('devolve "modelo-ausente" quando o modelo não está íntegro', async () => {
    modeloIntegro.mockResolvedValue(false);
    const p = transcrever(new ArrayBuffer(16));
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ texto: null, motivo: 'modelo-ausente' });
  });

  it('devolve "falha-transcricao" quando o worker emite erro', async () => {
    aoEnviar = (msg, proc) => {
      if (msg['tipo'] === 'init') queueMicrotask(() => proc.emit('message', { tipo: 'pronto' }));
      if (msg['tipo'] === 'transcrever') {
        queueMicrotask(() => proc.emit('message', { tipo: 'erro', mensagem: 'boom' }));
      }
    };
    const p = transcrever(new ArrayBuffer(16));
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ texto: null, motivo: 'falha-transcricao' });
  });

  it('devolve "falha-transcricao" no timeout', async () => {
    aoEnviar = (msg, proc) => {
      if (msg['tipo'] === 'init') queueMicrotask(() => proc.emit('message', { tipo: 'pronto' }));
      // nunca responde ao 'transcrever'
    };
    const p = transcrever(new ArrayBuffer(16));
    await vi.advanceTimersByTimeAsync(61_000);
    await expect(p).resolves.toEqual({ texto: null, motivo: 'falha-transcricao' });
  });

  it('não derruba o processo quando o worker encerra antes de ficar pronto', async () => {
    aoEnviar = (_msg, proc) => {
      queueMicrotask(() => proc.emit('exit', 1));
    };
    const p = transcrever(new ArrayBuffer(16));
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ texto: null, motivo: 'falha-transcricao' });
  });
});
