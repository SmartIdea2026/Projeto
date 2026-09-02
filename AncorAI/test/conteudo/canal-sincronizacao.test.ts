// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CANAIS } from '../../src/compartilhado/canais';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Canal `sincronizacao:estado`.
 *
 * É um canal de leitura: devolve o retrato do andamento — estado e contagens —
 * e nada mais. A fronteira da ADR-0005 vale para ele como para os demais: o
 * texto lido dos documentos não acompanha a resposta. O teste
 * `fronteira-conteudo` cobre essa garantia junto de todos os canais; aqui o
 * foco é o handler devolver o retrato certo.
 */

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (canal: string, fn: (...args: unknown[]) => unknown) => {
      handlers.set(canal, fn);
    }
  },
  shell: { openExternal: vi.fn(async () => undefined) }
}));

vi.mock('../../src/main/credenciais/cofre', () => ({
  obter: vi.fn(() => 'token-de-teste'),
  definir: vi.fn(),
  remover: vi.fn(),
  existe: vi.fn(() => true)
}));

const banco = await import('../../src/main/banco/repositorio');
const github = await import('../../src/main/fontes/github');
const { registrarCanais } = await import('../../src/main/ipc');

let diretorio: string;

function documento(i: number): Documento {
  return {
    id: `github:org/repo:doc${i}.md`,
    nome: `doc${i}.md`,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-27T12:00:00Z',
    link: `https://github.com/org/repo/blob/main/doc${i}.md`,
    caminho: `doc${i}.md`,
    repositorio: 'org/repo',
    versaoConteudo: `sha-${i}`,
    tamanho: 100
  };
}

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-canal-sinc-'));
  await banco.abrirBanco(diretorio);
  handlers.clear();
  registrarCanais();
});

afterEach(() => {
  banco.fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function consultarEstado(): Promise<Record<string, unknown>> {
  const handler = handlers.get(CANAIS.sincronizacaoEstado);
  expect(handler).toBeDefined();
  return (handler as () => Promise<Record<string, unknown>>)();
}

describe('sincronizacao:estado', () => {
  it('devolve estado e contagens, todos escalares', async () => {
    const retrato = await consultarEstado();

    // Antes de qualquer varredura, o retrato começa parado.
    expect(retrato.estado).toBe('parada');
    expect(Object.keys(retrato).sort()).toEqual(
      [
        'estado',
        'total',
        'ingeridos',
        'reaproveitados',
        'semTexto',
        'falhas',
        'suspensa'
      ].sort()
    );
    for (const [campo, valor] of Object.entries(retrato)) {
      expect(
        ['number', 'boolean', 'string'].includes(typeof valor),
        `campo ${campo} deveria ser escalar`
      ).toBe(true);
    }
  });

  it('reflete a conclusão de uma varredura', async () => {
    vi.spyOn(github, 'buscarDocumentos').mockResolvedValue({
      dados: [documento(0), documento(1)],
      aviso: null
    });
    vi.spyOn(github, 'conteudoDoArquivo').mockResolvedValue(
      new TextEncoder().encode('texto').buffer as ArrayBuffer
    );

    const indexar = handlers.get(CANAIS.indexarConteudo) as () => Promise<unknown>;
    await indexar();

    const retrato = await consultarEstado();
    expect(retrato.estado).toBe('concluida');
    expect(retrato.total).toBe(2);
    expect(retrato.ingeridos).toBe(2);
  });

  it('reflete a suspensão por credencial ausente, com o código do motivo', async () => {
    const cofre = await import('../../src/main/credenciais/cofre');
    vi.mocked(cofre.obter).mockReturnValue(undefined as unknown as string);

    const indexar = handlers.get(CANAIS.indexarConteudo) as () => Promise<unknown>;
    await indexar();

    const retrato = await consultarEstado();
    expect(retrato.estado).toBe('suspensa');
    expect(retrato.motivoSuspensao).toBe('sem-credencial');
  });
});
