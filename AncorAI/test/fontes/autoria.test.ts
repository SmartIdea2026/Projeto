import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Autoria e data real da última alteração.
 *
 * A árvore Git não traz nenhum dos dois — só caminhos. Cada arquivo custa uma
 * consulta própria, e é esse custo que mantém a operação restrita à página
 * apresentada.
 */

vi.mock('../../src/main/banco/repositorio', () => ({
  lerCache: vi.fn(async () => null),
  gravarCache: vi.fn(async () => undefined)
}));
const github = await import('../../src/main/fontes/github');

function resposta(corpo: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => corpo
  } as unknown as Response;
}

afterEach(() => vi.restoreAllMocks());

describe('consulta de autoria', () => {
  it('prefere o login do GitHub ao nome configurado no git', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta([
          {
            commit: { author: { name: 'Gustavo M.', date: '2026-08-22T10:00:00Z' } },
            author: { login: 'GustavoMairinck' }
          }
        ])
      )
    );

    const autoria = await github.autoriaDoArquivo('token', 'o/r', 'Docs/ata.md');

    expect(autoria).toEqual({
      autor: 'GustavoMairinck',
      dataModificacao: '2026-08-22T10:00:00Z'
    });
  });

  it('recorre ao nome do commit quando não há conta associada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta([
          {
            commit: { author: { name: 'Marina Alves', date: '2026-08-18T09:00:00Z' } },
            author: null
          }
        ])
      )
    );

    const autoria = await github.autoriaDoArquivo('token', 'o/r', 'Docs/spec.md');

    expect(autoria?.autor).toBe('Marina Alves');
  });

  it('codifica o caminho para não quebrar a consulta', async () => {
    const chamado = vi.fn(async () => resposta([]));
    vi.stubGlobal('fetch', chamado);

    await github.autoriaDoArquivo('token', 'o/r', 'Docs/Atas e Reuniões/24-08.md');

    const url = chamado.mock.calls[0]![0] as string;
    expect(url).toContain('Atas%20e%20Reuni');
    expect(url).not.toContain('Atas e Reuni');
  });

  it('devolve nulo quando o arquivo não tem commit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta([])));

    expect(await github.autoriaDoArquivo('token', 'o/r', 'novo.md')).toBeNull();
  });

  it('devolve nulo quando a consulta falha, sem propagar erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta({ message: 'Not Found' }, 404)));

    // A ausência de autoria não é erro: o documento é apresentado sem ela.
    expect(await github.autoriaDoArquivo('token', 'o/r', 'sumido.md')).toBeNull();
  });
});
