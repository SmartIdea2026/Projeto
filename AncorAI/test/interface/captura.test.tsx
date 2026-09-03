import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ErroPermissaoMicrofone,
  enumerarMicrofones,
  iniciarCaptura,
  type ControleCaptura
} from '../../src/renderer/audio/captura';

/**
 * Captura de áudio do ditado.
 *
 * jsdom não tem Web Audio nem MediaRecorder — dublados aqui. O teste dirige o
 * laço de detecção de silêncio pelo relógio falso e verifica os quatro
 * desfechos: silêncio, parada manual, teto de duração e cancelamento.
 */

const captura = {
  silencioLimiarRms: 0.05,
  silencioDuracaoMs: 1500,
  duracaoMaximaS: 10,
  taxaAmostragemHz: 16000
};

/** Nível RMS corrente que o AnalyserNode falso reporta (0 = silêncio). */
let nivel = 0;
/** Energia do PCM que o OfflineAudioContext falso "renderiza". */
let pcmNivel = 0.2;
/** Duração (s) do áudio decodificado pelo AudioContext falso. */
let pcmDuracao = 2;

class MediaRecorderFalso {
  state = 'recording';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: ((e: Event) => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
    this.onstop?.(new Event('stop'));
  });
}

class AudioContextFalso {
  state = 'running';
  resume = vi.fn(async () => undefined);
  createMediaStreamSource = () => ({ connect: vi.fn() });
  createGain = () => ({ gain: { value: 0 }, connect: vi.fn() });
  destination = {};
  createAnalyser = () => ({
    fftSize: 2048,
    connect: vi.fn(),
    getByteTimeDomainData: (arr: Uint8Array) => {
      // Converte o nível desejado num desvio em torno de 128.
      const amplitude = Math.round(nivel * 128);
      for (let i = 0; i < arr.length; i++) arr[i] = 128 + (i % 2 === 0 ? amplitude : -amplitude);
    }
  });
  decodeAudioData = vi.fn(async () => ({ duration: pcmDuracao, numberOfChannels: 1 }));
  close = vi.fn(async () => undefined);
}

class OfflineAudioContextFalso {
  destination = {};
  createBufferSource = () => ({ buffer: null, connect: vi.fn(), start: vi.fn() });
  startRendering = vi.fn(async () => ({
    getChannelData: () =>
      new Float32Array(Math.round(pcmDuracao * 16000)).fill(pcmNivel)
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  nivel = 0;
  pcmNivel = 0.2;
  pcmDuracao = 2;

  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
      enumerateDevices: vi.fn(async () => [
        { kind: 'audioinput', deviceId: 'padrao', label: 'Microfone interno' },
        { kind: 'audioinput', deviceId: 'usb', label: 'Headset USB' },
        { kind: 'audiooutput', deviceId: 'alto-falante', label: 'Alto-falantes' }
      ])
    }
  });
  vi.stubGlobal('AudioContext', AudioContextFalso);
  vi.stubGlobal('OfflineAudioContext', OfflineAudioContextFalso);
  vi.stubGlobal('MediaRecorder', MediaRecorderFalso);
  vi.stubGlobal('performance', { now: () => Date.now() });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function iniciar(): Promise<ControleCaptura> {
  nivel = 0.5; // começa falando para o laço não encerrar de imediato
  const controle = await iniciarCaptura(captura);
  await vi.advanceTimersByTimeAsync(200);
  return controle;
}

describe('iniciarCaptura', () => {
  it('lança ErroPermissaoMicrofone quando getUserMedia é negado', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException('denied', 'NotAllowedError')
    );
    await expect(iniciarCaptura(captura)).rejects.toBeInstanceOf(ErroPermissaoMicrofone);
  });

  it('encerra sozinha após o intervalo de silêncio', async () => {
    const controle = await iniciar();
    nivel = 0; // silêncio
    await vi.advanceTimersByTimeAsync(1800);

    const { motivo, pcm } = await controle.resultado;
    expect(motivo).toBe('silencio');
    expect(pcm).toBeInstanceOf(ArrayBuffer);
  });

  it('encerra na parada manual, mesmo ainda falando', async () => {
    const controle = await iniciar();
    controle.parar();

    const { motivo, pcm } = await controle.resultado;
    expect(motivo).toBe('manual');
    expect(pcm).toBeInstanceOf(ArrayBuffer);
  });

  it('encerra no teto de duração', async () => {
    const controle = await iniciar();
    // fala sem parar; o teto (10 s) encerra
    await vi.advanceTimersByTimeAsync(10_500);

    const { motivo } = await controle.resultado;
    expect(motivo).toBe('teto');
  });

  it('enumerarMicrofones lista só as entradas de áudio', async () => {
    expect(await enumerarMicrofones()).toEqual([
      { id: 'padrao', rotulo: 'Microfone interno' },
      { id: 'usb', rotulo: 'Headset USB' }
    ]);
  });

  it('cancelar não produz pcm', async () => {
    const controle = await iniciar();
    controle.cancelar();

    const { motivo, pcm } = await controle.resultado;
    expect(motivo).toBe('cancelado');
    expect(pcm).toBeUndefined();
  });

  it('áudio praticamente mudo não vira transcrição, e reporta o nível', async () => {
    pcmNivel = 0.001; // o áudio decodificado é silêncio
    const controle = await iniciar();
    controle.parar();

    const { pcm, nivel: n } = await controle.resultado;
    expect(pcm).toBeUndefined();
    expect(n).toBeCloseTo(0.001, 3);
  });

  it('áudio curto demais não vira transcrição', async () => {
    pcmDuracao = 0.1; // 100 ms
    const controle = await iniciar();
    controle.parar();

    const { pcm } = await controle.resultado;
    expect(pcm).toBeUndefined();
  });

  it('capta pelo microfone escolhido quando um deviceId é informado', async () => {
    nivel = 0.5;
    await iniciarCaptura(captura, 'usb');
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: 'usb' }, noiseSuppression: true })
    });
  });

  it('volta ao microfone padrão se o dispositivo escolhido sumiu', async () => {
    const gum = navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>;
    gum.mockRejectedValueOnce(new DOMException('foi-se', 'OverconstrainedError'));
    nivel = 0.5;
    await iniciarCaptura(captura, 'sumiu');

    const ultima = gum.mock.calls.at(-1)![0] as { audio: MediaTrackConstraints };
    expect(ultima.audio.deviceId).toBeUndefined();
    expect(ultima.audio.noiseSuppression).toBe(true);
  });

  it('a parada por silêncio só arma depois que houve fala', async () => {
    nivel = 0;
    const controle = await iniciarCaptura(captura);
    // 3 s de silêncio inicial — bem além de silencioDuracaoMs (1,5 s)
    await vi.advanceTimersByTimeAsync(3000);
    // ainda gravando: nada encerrou
    nivel = 0.5;
    await vi.advanceTimersByTimeAsync(300);
    nivel = 0;
    await vi.advanceTimersByTimeAsync(1800);

    const { motivo, pcm } = await controle.resultado;
    expect(motivo).toBe('silencio');
    expect(pcm).toBeInstanceOf(ArrayBuffer);
  });
});
