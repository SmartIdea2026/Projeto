import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTROS_PADRAO, POR_PAGINA, type Documento } from '../../src/compartilhado/tipos';

/**
 * Paginação dos resultados.
 *
 * A fatia apresentada e o total encontrado são coisas diferentes, e a distinção
 * é o que permite ao contador dizer "12 resultados" enquanto a tela mostra 10.
 * A paginação incide depois de filtrar e ordenar, para que a primeira página
 * traga os documentos de maior precedência — e não dez quaisquer.
 */

const cofre = { obter: vi.fn(), definir: vi.fn(), remover: vi.fn(), existe: vi.fn() };
const github = {
  buscarDocumentos: vi.fn(),
  documentosRecentes: vi.fn(),
  verificarCredencial: vi.fn()
};

vi.mock('../../src/main/credenciais/cofre', () => cofre);
vi.mock('../../src/main/fontes/github', () => github);
vi.mock('../../src/main/banco/repositorio', () => ({
  lerCache: vi.fn(async () => null),
  gravarCache: vi.fn(async () => undefined)
}));
vi.mock('../../src/main/credenciais/validacao', () => ({
  lerValidacao: vi.fn(async () => null),
  gravarValidacao: vi.fn(async () => undefined),
  invalidarValidacao: vi.fn(async () => undefined)
}));

const servico = await import('../../src/main/busca/servico');

/** 25 documentos com datas decrescentes e nomes previsíveis. */
function acervo(quantidade: number): Documento[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: `github:o/r:doc${String(i).padStart(2, '0')}.md`,
    nome: `doc${String(i).padStart(2, '0')}.md`,
    extensao: 'md',
    fonte: 'github' as const,
    dataModificacao: new Date(Date.UTC(2026, 0, quantidade - i)).toISOString(),
    link: `https://exemplo/${i}`
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  cofre.obter.mockImplementation((chave: string) =>
    chave === 'github.token' ? 'token' : null
  );
});

describe('recorte da página', () => {
  it('apresenta 10 por página e informa o total encontrado', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: acervo(25), aviso: null });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'doc' });

    expect(resultado.documentos).toHaveLength(POR_PAGINA);
    expect(resultado.total).toBe(25);
    expect(resultado.pagina).toBe(1);
  });

  it('a primeira página traz os de maior precedência segundo a ordenação', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: acervo(25), aviso: null });

    const porNome = await servico.buscar({
      ...FILTROS_PADRAO,
      termo: 'doc',
      ordenacao: 'a-z'
    });

    // Ordenar antes de paginar: doc00 é o primeiro alfabeticamente do acervo.
    expect(porNome.documentos[0]?.nome).toBe('doc00.md');
    expect(porNome.documentos.at(-1)?.nome).toBe('doc09.md');
  });

  it('navega para a página seguinte sem repetir documentos', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: acervo(25), aviso: null });

    const primeira = await servico.buscar({ ...FILTROS_PADRAO, termo: 'doc', ordenacao: 'a-z' });
    const segunda = await servico.buscar({
      ...FILTROS_PADRAO,
      termo: 'doc',
      ordenacao: 'a-z',
      pagina: 2
    });

    expect(segunda.pagina).toBe(2);
    expect(segunda.documentos[0]?.nome).toBe('doc10.md');
    const repetidos = segunda.documentos.filter((d) =>
      primeira.documentos.some((p) => p.id === d.id)
    );
    expect(repetidos).toEqual([]);
  });

  it('a última página traz o resto, menor que uma página cheia', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: acervo(25), aviso: null });

    const terceira = await servico.buscar({ ...FILTROS_PADRAO, termo: 'doc', pagina: 3 });

    expect(terceira.documentos).toHaveLength(5);
    expect(terceira.total).toBe(25);
  });

  it('página além do fim cai na última em vez de devolver vazio', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: acervo(25), aviso: null });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'doc', pagina: 99 });

    expect(resultado.pagina).toBe(3);
    expect(resultado.documentos).toHaveLength(5);
  });

  it('resultado que cabe em uma página não é recortado', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: acervo(4), aviso: null });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'doc' });

    expect(resultado.documentos).toHaveLength(4);
    expect(resultado.total).toBe(4);
  });

  it('resultado vazio informa total zero na primeira página', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: [], aviso: null });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'nada' });

    expect(resultado.documentos).toEqual([]);
    expect(resultado.total).toBe(0);
    expect(resultado.pagina).toBe(1);
  });
});

describe('paginação da lista de recentes', () => {
  it('recorta os recentes e informa o total', async () => {
    github.documentosRecentes.mockResolvedValue({ dados: acervo(25), aviso: null });

    const resultado = await servico.recentes(FILTROS_PADRAO);

    expect(resultado.documentos).toHaveLength(POR_PAGINA);
    // Os recentes limitam-se a 30 antes de paginar.
    expect(resultado.total).toBe(25);
  });
});
