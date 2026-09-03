// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANAIS, EVENTOS_VOZ } from '../../src/compartilhado/canais';

/**
 * Canais de voz no registro IPC.
 *
 * `voz:transcrever` devolve a fala do usuário (nunca conteúdo de documento —
 * coberto por `fronteira-conteudo`). `voz:ativar` grava a preferência e
 * repassa o progresso do download para o `webContents` que pediu.
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (canal: string, fn: (...args: unknown[]) => unknown) => handlers.set(canal, fn)
  },
  shell: { openExternal: vi.fn() }
}));

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn(() => 'token'),
  definir: vi.fn(),
  remover: vi.fn(),
  existe: vi.fn(() => true)
}));

const transcrever = vi.fn(async () => ({ texto: 'buscar ata de agosto' }));
const baixarModelo = vi.fn(async (cb: (p: unknown) => void) => {
  cb({ recebidos: 5, total: 10, arquivo: 'encoder.onnx' });
});
vi.mock('../../src/main/voz/transcricao', () => ({
  transcrever: (pcm: ArrayBuffer) => transcrever(pcm),
  baixarModelo: (cb: (p: unknown) => void) => baixarModelo(cb),
  modeloEstaPronto: vi.fn(async () => true),
  encerrarVoz: vi.fn(),
  inicializarVoz: vi.fn()
}));

vi.mock('../../src/main/permissoes', () => ({ permissaoMicrofone: () => 'concedida' }));
vi.mock('../../src/main/voz/config', () => ({
  lerConfigVoz: () => ({
    captura: { silencioLimiarRms: 0.01, silencioDuracaoMs: 1500, duracaoMaximaS: 30, taxaAmostragemHz: 16000 }
  })
}));

const banco = await import('../../src/main/banco/repositorio');
const { registrarCanais } = await import('../../src/main/ipc');

let dir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'ancorai-ipc-voz-'));
  await banco.abrirBanco(dir);
  handlers.clear();
  registrarCanais();
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(dir, { recursive: true, force: true });
});

describe('canais de voz', () => {
  it('voz:transcrever devolve o texto da fala', async () => {
    const resposta = await handlers.get(CANAIS.vozTranscrever)!({}, new ArrayBuffer(16));
    expect(resposta).toEqual({ texto: 'buscar ata de agosto' });
    expect(transcrever).toHaveBeenCalledOnce();
  });

  it('voz:modelo-estado devolve o retrato consolidado', async () => {
    const estado = (await handlers.get(CANAIS.vozModeloEstado)!({})) as Record<string, unknown>;
    expect(estado).toMatchObject({ vozAtiva: false, modelo: 'pronto', permissao: 'concedida' });
    expect(estado['captura']).toBeDefined();
  });

  it('voz:ativar grava a preferência e emite o progresso ao sender', async () => {
    const enviados: unknown[] = [];
    const sender = { send: (_canal: string, p: unknown) => enviados.push(p), isDestroyed: () => false };

    await handlers.get(CANAIS.vozAtivar)!({ sender }, true);

    expect(baixarModelo).toHaveBeenCalledOnce();
    expect(await banco.lerPreferencia('voz.ativa')).toBe(true);
    expect(enviados).toEqual([{ recebidos: 5, total: 10, arquivo: 'encoder.onnx' }]);
  });

  it('voz:ativar não envia progresso a um sender já destruído', async () => {
    const sender = { send: vi.fn(), isDestroyed: () => true };
    await handlers.get(CANAIS.vozAtivar)!({ sender }, true);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('voz:microfone grava o consentimento e a escolha, e devolve o estado', async () => {
    const estado = (await handlers.get(CANAIS.vozMicrofone)!(
      {},
      { consentido: true, dispositivoId: 'mic-usb' }
    )) as Record<string, unknown>;

    expect(estado).toMatchObject({ microfoneConsentido: true, microfoneId: 'mic-usb' });
    expect(await banco.lerPreferencia('voz.microfoneConsentido')).toBe(true);
    expect(await banco.lerPreferenciaTexto('voz.microfone')).toBe('mic-usb');
  });

  it('o evento de progresso não está entre os canais handle', () => {
    expect(Object.values(CANAIS)).not.toContain(EVENTOS_VOZ.modeloProgresso);
  });
});
