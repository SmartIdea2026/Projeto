// @vitest-environment node
//
// Código do processo principal. A configuração global usa jsdom, por causa dos
// testes de interface, mas jsdom troca `ArrayBuffer`, `Blob` e `window` pelos
// equivalentes dele — e as bibliotecas de extração seguem o caminho de
// navegador quando enxergam um `window`, pedindo worker e falhando aqui.
// Rodar no ambiente que este código realmente usa é o que torna o teste
// representativo.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErroFonte } from '../../src/main/fontes/comum';

/**
 * Obtenção do conteúdo junto à fonte.
 *
 * O que se verifica aqui é a fronteira entre inventariar e ingerir: o
 * inventário precisa carregar a identidade do conteúdo e o tamanho, porque é
 * o que permite decidir se vale baixar; e o download precisa herdar o mesmo
 * tratamento de falha das demais requisições, em vez de ter um próprio que
 * envelhece à parte.
 */

vi.mock('../../src/main/banco/repositorio', () => ({
  lerCache: vi.fn(async () => null),
  gravarCache: vi.fn(async () => undefined)
}));
const github = await import('../../src/main/fontes/github');

function resposta(corpo: unknown, status = 200, cabecalhos: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (nome: string) => cabecalhos[nome.toLowerCase()] ?? null },
    json: async () => corpo,
    arrayBuffer: async () => corpo as ArrayBuffer
  } as unknown as Response;
}

const REPO = {
  name: 'Projeto',
  full_name: 'SmartIdea2026/Projeto',
  default_branch: 'main',
  owner: { login: 'SmartIdea2026' },
  pushed_at: '2026-08-27T12:00:00Z'
};

afterEach(() => {
  vi.restoreAllMocks();
  // `restoreAllMocks` desfaz espiões, mas não zera o histórico das funções
  // criadas em `vi.mock`, que é compartilhado por todo o arquivo. Sem isto,
  // uma asserção sobre "não foi chamado" enxerga chamadas de testes anteriores.
  vi.clearAllMocks();
});

describe('identidade e tamanho no inventário', () => {
  it('carrega o sha do blob e o tamanho em cada documento inventariado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          truncated: false,
          tree: [
            { path: 'Docs/ata.md', type: 'blob', sha: 'abc123', size: 4096 },
            { path: 'src/index.ts', type: 'blob', sha: 'def456', size: 10 }
          ]
        })
      )
    );

    const { dados } = await github.inventariar('t', REPO);

    expect(dados).toHaveLength(1);
    expect(dados[0].versaoConteudo).toBe('abc123');
    expect(dados[0].tamanho).toBe(4096);
  });

  it('não quebra quando a árvore omite o tamanho', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        resposta({
          truncated: false,
          tree: [{ path: 'Docs/ata.md', type: 'blob', sha: 'abc123' }]
        })
      )
    );

    const { dados } = await github.inventariar('t', REPO);

    expect(dados[0].versaoConteudo).toBe('abc123');
    expect(dados[0].tamanho).toBeUndefined();
  });
});

describe('identidade de conteúdo nos documentos recentes', () => {
  // Os recentes vêm dos commits, não da árvore. Sem o `sha` do blob aqui,
  // nenhum documento da tela inicial teria como ter o conteúdo obtido.
  it('carrega o sha do blob que vem no detalhe do commit', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/commits?')) {
          return resposta([
            { sha: 'commit1', commit: { author: { date: '2026-08-28T10:00:00Z' } } }
          ]);
        }
        return resposta({
          files: [{ filename: 'Docs/ata.md', status: 'modified', sha: 'blob-abc' }]
        });
      })
    );

    const { dados } = await github.recentesDoRepositorio('t', REPO, 1);

    expect(dados).toHaveLength(1);
    expect(dados[0]?.versaoConteudo).toBe('blob-abc');
  });

  it('não quebra quando o commit não informa o sha do arquivo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/commits?')) {
          return resposta([
            { sha: 'commit1', commit: { author: { date: '2026-08-28T10:00:00Z' } } }
          ]);
        }
        return resposta({ files: [{ filename: 'Docs/ata.md', status: 'modified' }] });
      })
    );

    const { dados } = await github.recentesDoRepositorio('t', REPO, 1);

    expect(dados[0]?.versaoConteudo).toBeUndefined();
    expect(dados[0]?.nome).toBe('ata.md');
  });
});

describe('download do conteúdo', () => {
  it('pede o blob pelo sha, com mídia bruta', async () => {
    const chamadas: Array<{ url: string; aceite: string }> = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, opcoes: { headers: Record<string, string> }) => {
        chamadas.push({ url, aceite: opcoes.headers.Accept });
        return resposta(new ArrayBuffer(8));
      })
    );

    const bytes = await github.conteudoDoArquivo('t', 'SmartIdea2026/Projeto', 'abc123');

    expect(bytes.byteLength).toBe(8);
    expect(chamadas[0].url).toContain('/repos/SmartIdea2026/Projeto/git/blobs/abc123');
    expect(chamadas[0].aceite).toBe('application/vnd.github.raw');
  });

  it('não grava o conteúdo baixado no cache de respostas das fontes', async () => {
    const banco = await import('../../src/main/banco/repositorio');
    vi.stubGlobal('fetch', vi.fn(async () => resposta(new ArrayBuffer(8))));

    await github.conteudoDoArquivo('t', 'SmartIdea2026/Projeto', 'abc123');

    expect(banco.gravarCache).not.toHaveBeenCalled();
  });

  // O tratamento de falha do download é o mesmo das demais requisições porque
  // é a mesma função. Se algum dia deixar de ser, é aqui que aparece.
  it('devolve ErroFonte com limiteExcedido quando a cota acaba', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => resposta(null, 403, { 'x-ratelimit-remaining': '0' }))
    );

    const erro = await github
      .conteudoDoArquivo('t', 'SmartIdea2026/Projeto', 'abc123')
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroFonte);
    expect((erro as ErroFonte).limiteExcedido).toBe(true);
  });

  it('distingue credencial inválida de recusa por cota', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => resposta(null, 401)));

    const erro = await github
      .conteudoDoArquivo('t', 'SmartIdea2026/Projeto', 'abc123')
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroFonte);
    expect((erro as ErroFonte).limiteExcedido).toBe(false);
  });

  it('trata queda de rede como falha da fonte, e não como exceção crua', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      })
    );

    const erro = await github
      .conteudoDoArquivo('t', 'SmartIdea2026/Projeto', 'abc123')
      .catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroFonte);
  });
});
