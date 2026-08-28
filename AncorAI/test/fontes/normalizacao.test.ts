import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Normalização dos resultados das fontes (design, seção 4).
 *
 * Verifica que a resposta da API chega à interface com o conjunto de campos do
 * formato unificado. Com a saída do Drive do MVP (ADR-0004) resta o GitHub; o
 * valor do teste está em travar o contrato do formato, para que a segunda fonte
 * tenha um alvo definido quando voltar.
 */

vi.mock('../../src/main/banco/repositorio', () => ({
  lerCache: vi.fn(async () => null),
  gravarCache: vi.fn(async () => undefined)
}));
const github = await import('../../src/main/fontes/github');

function resposta(corpo: unknown, cabecalhos: Record<string, string> = {}) {
  return {
    ok: true,
    status: 200,
    headers: { get: (nome: string) => cabecalhos[nome.toLowerCase()] ?? null },
    json: async () => corpo
  } as unknown as Response;
}

afterEach(() => vi.restoreAllMocks());

const CAMPOS = ['dataModificacao', 'extensao', 'fonte', 'id', 'link', 'nome'];

describe('normalização do GitHub', () => {
  it('converte a árvore Git no formato unificado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/user/repos')) {
          return resposta([
            {
              name: 'Projeto',
              full_name: 'SmartIdea2026/Projeto',
              default_branch: 'main',
              owner: { login: 'SmartIdea2026' },
              pushed_at: '2026-08-27T12:00:00Z'
            }
          ]);
        }
        return resposta({
          truncated: false,
          tree: [
            { path: 'Docs/ADR/ADR-0001.md', type: 'blob', sha: 'a' },
            { path: 'src/index.ts', type: 'blob', sha: 'b' },
            { path: 'Docs', type: 'tree', sha: 'c' }
          ]
        });
      })
    );

    const documentos = await github.buscarDocumentos('token');

    expect(documentos).toHaveLength(1);
    const [documento] = documentos;
    expect(CAMPOS.every((campo) => campo in documento!)).toBe(true);
    expect(documento).toMatchObject({
      nome: 'ADR-0001.md',
      extensao: 'md',
      fonte: 'github',
      repositorio: 'SmartIdea2026/Projeto',
      caminho: 'Docs/ADR/ADR-0001.md'
    });
    expect(documento!.link).toContain('github.com/SmartIdea2026/Projeto/blob/main/');
    // O GitHub não expõe data de criação por arquivo.
    expect(documento!.dataCriacao).toBeUndefined();
  });

  it('descarta código-fonte e diretórios do inventário', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/user/repos')
          ? resposta([
              {
                name: 'r',
                full_name: 'o/r',
                default_branch: 'main',
                owner: { login: 'o' },
                pushed_at: '2026-01-01T00:00:00Z'
              }
            ])
          : resposta({
              truncated: false,
              tree: [
                { path: 'a.ts', type: 'blob', sha: '1' },
                { path: 'b.json', type: 'blob', sha: '2' },
                { path: 'pasta', type: 'tree', sha: '3' }
              ]
            })
      )
    );

    expect(await github.buscarDocumentos('token')).toHaveLength(0);
  });
});
