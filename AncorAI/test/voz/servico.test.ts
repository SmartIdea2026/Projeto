// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fachada da busca por voz.
 *
 * O foco: ativar grava a preferência e baixa o modelo; uma falha de download
 * volta a preferência para desligado e deixa o erro no estado — o estado nunca
 * promete um microfone que não vai funcionar.
 */

const baixarModelo = vi.fn(async () => undefined);
const modeloEstaPronto = vi.fn(async () => false);
const encerrarVoz = vi.fn();

vi.mock('../../src/main/voz/transcricao', () => ({
  baixarModelo: (cb: (p: unknown) => void) => baixarModelo(cb),
  modeloEstaPronto: () => modeloEstaPronto(),
  encerrarVoz: () => encerrarVoz(),
  transcrever: vi.fn(async () => ({ texto: 'x' })),
  inicializarVoz: vi.fn()
}));

vi.mock('../../src/main/permissoes', () => ({
  permissaoMicrofone: () => 'concedida'
}));

vi.mock('../../src/main/voz/config', () => ({
  lerConfigVoz: () => ({
    captura: { silencioLimiarRms: 0.01, silencioDuracaoMs: 1500, duracaoMaximaS: 30, taxaAmostragemHz: 16000 }
  })
}));

const banco = await import('../../src/main/banco/repositorio');
const { estado, ativar, ajustarMicrofone, CHAVE_VOZ_ATIVA, CHAVE_MIC_ID, CHAVE_MIC_CONSENTIDO } =
  await import('../../src/main/voz/servico');

let dir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  modeloEstaPronto.mockResolvedValue(false);
  baixarModelo.mockResolvedValue(undefined);
  dir = mkdtempSync(join(tmpdir(), 'ancorai-servico-voz-'));
  await banco.abrirBanco(dir);
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(dir, { recursive: true, force: true });
});

describe('estado', () => {
  it('parte de desligado, sem modelo', async () => {
    expect(await estado()).toMatchObject({ vozAtiva: false, modelo: 'ausente' });
  });

  it('parte sem consentimento de microfone e sem dispositivo escolhido', async () => {
    expect(await estado()).toMatchObject({ microfoneConsentido: false, microfoneId: null });
  });
});

describe('ajustarMicrofone', () => {
  it('registra o consentimento do primeiro uso', async () => {
    const resultado = await ajustarMicrofone({ consentido: true });
    expect(resultado.microfoneConsentido).toBe(true);
    expect(await banco.lerPreferencia(CHAVE_MIC_CONSENTIDO)).toBe(true);
  });

  it('grava o dispositivo escolhido e o devolve no estado', async () => {
    const resultado = await ajustarMicrofone({ dispositivoId: 'mic-usb' });
    expect(resultado.microfoneId).toBe('mic-usb');
    expect(await banco.lerPreferenciaTexto(CHAVE_MIC_ID)).toBe('mic-usb');
  });

  it('dispositivoId null volta ao padrão do sistema', async () => {
    await ajustarMicrofone({ dispositivoId: 'mic-usb' });
    const resultado = await ajustarMicrofone({ dispositivoId: null });
    expect(resultado.microfoneId).toBeNull();
  });

  it('não mexe no que não foi informado', async () => {
    await ajustarMicrofone({ consentido: true, dispositivoId: 'mic-usb' });
    const resultado = await ajustarMicrofone({});
    expect(resultado).toMatchObject({ microfoneConsentido: true, microfoneId: 'mic-usb' });
  });
});

describe('ativar', () => {
  it('grava a preferência e baixa o modelo', async () => {
    modeloEstaPronto.mockResolvedValue(true);
    const resultado = await ativar(true, () => undefined);

    expect(baixarModelo).toHaveBeenCalledOnce();
    expect(await banco.lerPreferencia(CHAVE_VOZ_ATIVA)).toBe(true);
    expect(resultado).toMatchObject({ vozAtiva: true, modelo: 'pronto' });
  });

  it('desligar encerra o worker e não apaga o modelo', async () => {
    await ativar(true, () => undefined);
    modeloEstaPronto.mockResolvedValue(true);

    const resultado = await ativar(false, () => undefined);
    expect(encerrarVoz).toHaveBeenCalled();
    expect(await banco.lerPreferencia(CHAVE_VOZ_ATIVA)).toBe(false);
    expect(resultado.vozAtiva).toBe(false);
  });

  it('falha de download volta a preferência para desligado e reporta o erro', async () => {
    baixarModelo.mockRejectedValue(new Error('conexão caiu no meio'));

    const resultado = await ativar(true, () => undefined);

    expect(await banco.lerPreferencia(CHAVE_VOZ_ATIVA)).toBe(false);
    expect(resultado.modelo).toBe('erro');
    expect(resultado.mensagemErro).toMatch(/conexão caiu/);
  });
});
