import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Resultados incompletos e datas aproximadas.
 *
 * Todos os casos aqui têm a mesma forma: a consulta funciona, devolve
 * documentos, e ainda assim o resultado não é o conjunto completo ou não tem a
 * precisão que o filtro pressupõe. O que se verifica é que o sistema **diz**
 * isso, em vez de entregar o resultado parcial como se fosse total — um
 * documento ausente é indistinguível de um documento inexistente para quem
 * está olhando a tela.
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

function repo(nome: string, pushedAt = '2026-08-27T12:00:00Z') {
  return {
    name: nome.split('/')[1],
    full_name: nome,
    default_branch: 'main',
    owner: { login: nome.split('/')[0] },
    pushed_at: pushedAt
  };
}

function arvore(caminhos: string[], truncated = false) {
  return {
    truncated,
    tree: caminhos.map((path, indice) => ({ path, type: 'blob', sha: String(indice) }))
  };
}

/** Página cheia de repositórios, para forçar a busca da página seguinte. */
function paginaCheia(prefixo: string) {
  return Array.from({ length: 100 }, (_, i) => repo(`${prefixo}/r${i}`));
}

afterEach(() => vi.restoreAllMocks());

describe('paginação dos repositórios', () => {
  it('percorre além da primeira página até encontrar uma incompleta', async () => {
    const paginasPedidas: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/user/repos')) {
          const pagina = new URL(url).searchParams.get('page')!;
          paginasPedidas.push(pagina);
          // A primeira página vem cheia, sinalizando que há mais; a segunda
          // vem com um item só, encerrando a varredura.
          return resposta(pagina === '1' ? paginaCheia('o') : [repo('o/ultimo')]);
        }
        return resposta(arvore(['doc.md']));
      })
    );

    const { dados, aviso } = await github.buscarDocumentos('token');

    expect(paginasPedidas).toEqual(['1', '2']);
    // 101 repositórios, um documento em cada.
    expect(dados).toHaveLength(101);
    expect(aviso).toBeNull();
  });

  it('para de pedir páginas assim que uma vem incompleta', async () => {
    const paginasPedidas: string[] = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/user/repos')) {
          paginasPedidas.push(new URL(url).searchParams.get('page')!);
          return resposta([repo('o/unico')]);
        }
        return resposta(arvore(['doc.md']));
      })
    );

    await github.buscarDocumentos('token');

    expect(paginasPedidas).toEqual(['1']);
  });

  it('avisa quando o teto de páginas é atingido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/user/repos')
          ? // Toda página vem cheia: nunca há sinal de fim.
            resposta(paginaCheia('o'))
          : resposta(arvore([]))
      )
    );

    const { aviso } = await github.buscarDocumentos('token');

    expect(aviso).toContain('1000 repositórios mais recentes');
  });
});

describe('árvore truncada pela API', () => {
  it('avisa que parte dos documentos ficou de fora', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/user/repos')
          ? resposta([repo('o/gigante')])
          : resposta(arvore(['a.md', 'b.md'], true))
      )
    );

    const { dados, aviso } = await github.buscarDocumentos('token');

    // Os documentos que vieram continuam sendo apresentados.
    expect(dados).toHaveLength(2);
    expect(aviso).toContain('o/gigante');
    expect(aviso).toContain('ficou de fora');
  });

  it('não avisa quando a árvore veio inteira', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/user/repos')
          ? resposta([repo('o/normal')])
          : resposta(arvore(['a.md'], false))
      )
    );

    expect((await github.buscarDocumentos('token')).aviso).toBeNull();
  });
});

describe('repositório inacessível', () => {
  it('mantém os demais e nomeia o que falhou', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/user/repos')) {
          return resposta([repo('o/bom'), repo('o/ruim')]);
        }
        // O repositório problemático responde 404; o outro responde normalmente.
        if (url.includes('o/ruim')) return resposta({ message: 'Not Found' }, 404);
        return resposta(arvore(['ok.md']));
      })
    );

    const { dados, aviso } = await github.buscarDocumentos('token');

    expect(dados).toHaveLength(1);
    expect(aviso).toContain('o/ruim');
    expect(aviso).not.toContain('o/bom');
  });
});

describe('data aproximada', () => {
  it('marca os documentos vindos da árvore Git', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/user/repos')
          ? resposta([repo('o/r', '2026-08-27T12:00:00Z')])
          : resposta(arvore(['doc.md']))
      )
    );

    const { dados } = await github.buscarDocumentos('token');

    // A árvore não traz data por arquivo: a data é a do repositório.
    expect(dados[0]?.dataAproximada).toBe(true);
    expect(dados[0]?.dataModificacao).toBe('2026-08-27T12:00:00Z');
  });

  it('não marca os documentos vindos dos commits, cuja data é real', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/user/repos')) return resposta([repo('o/r')]);
        if (url.includes('/commits?')) {
          return resposta([{ sha: 'abc', commit: { author: { date: '2026-08-20T09:00:00Z' } } }]);
        }
        return resposta({ files: [{ filename: 'ata.md', status: 'modified' }] });
      })
    );

    const { dados } = await github.documentosRecentes('token');

    expect(dados[0]?.dataAproximada).toBeUndefined();
    expect(dados[0]?.dataModificacao).toBe('2026-08-20T09:00:00Z');
  });
});
