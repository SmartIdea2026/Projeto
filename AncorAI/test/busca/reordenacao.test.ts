import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTROS_PADRAO, POR_PAGINA, type Documento } from '../../src/compartilhado/tipos';

/**
 * Reordenação a partir do conjunto retido.
 *
 * A especificação exige que trocar o critério reorganize o **resultado
 * inteiro** e que isso **não** consulte as fontes. As duas juntas obrigam o
 * processo principal a reter o conjunto filtrado da consulta vigente: o
 * renderer só recebe a página, e reordenar dez documentos devolve a ordem de um
 * recorte arbitrário.
 *
 * O que estes testes travam é o limite dessa retenção. Ela responde a critério
 * e página, e a nada mais: com filtros que descrevem outra consulta, devolver o
 * conjunto anterior seria apresentar o resultado de uma consulta como se fosse
 * o de outra.
 */

const cofre = { obter: vi.fn(), definir: vi.fn(), remover: vi.fn(), existe: vi.fn() };
const github = {
  buscarDocumentos: vi.fn(),
  documentosRecentes: vi.fn(),
  verificarCredencial: vi.fn(),
  autoriaDoArquivo: vi.fn()
};

vi.mock('../../src/main/credenciais/cofre', () => cofre);
vi.mock('../../src/main/fontes/github', () => github);
vi.mock('../../src/main/banco/repositorio', () => ({
  lerCache: vi.fn(async () => null),
  gravarCache: vi.fn(async () => undefined),
  conteudoParaBusca: vi.fn(async () => ({ textos: new Map(), versoes: new Map() })),
  inventarioSincronizado: vi.fn(async () => []),
  documentosSemAutoria: vi.fn(async () => 0),
  categoriasDeDocumentos: vi.fn(async () => new Map())
}));
vi.mock('../../src/main/credenciais/validacao', () => ({
  lerValidacao: vi.fn(async () => null),
  gravarValidacao: vi.fn(async () => undefined),
  invalidarValidacao: vi.fn(async () => undefined)
}));

const servico = await import('../../src/main/busca/servico');

/** 12 documentos: nome crescente, data decrescente. */
const ACERVO: Documento[] = Array.from({ length: 12 }, (_, i) => {
  const nome = `${String.fromCharCode(97 + i)}.md`;
  return {
    id: `github:o/r:${nome}`,
    nome,
    extensao: 'md',
    fonte: 'github' as const,
    dataModificacao: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    link: `https://exemplo/${nome}`
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  cofre.obter.mockImplementation((chave: string) =>
    chave === 'github.token' ? 'token' : null
  );
  github.buscarDocumentos.mockResolvedValue({ dados: ACERVO, aviso: null });
  github.documentosRecentes.mockResolvedValue({ dados: ACERVO, aviso: null });
});

describe('reordenação sem consultar as fontes', () => {
  it('reorganiza o resultado inteiro a partir do conjunto retido', async () => {
    const porData = await servico.buscar({ ...FILTROS_PADRAO, termo: '.md' });
    expect(porData.documentos[0]?.nome).toBe('l.md');

    const porNome = await servico.reordenar({
      ...FILTROS_PADRAO,
      termo: '.md',
      ordenacao: 'a-z'
    });

    // `a.md` estava na segunda página por data: reordenar só a página visível
    // devolveria `c.md` no topo.
    expect(porNome.documentos[0]?.nome).toBe('a.md');
    expect(porNome.total).toBe(12);
    // Uma consulta às fontes ao todo, a da busca original.
    expect(github.buscarDocumentos).toHaveBeenCalledTimes(1);
  });

  it('serve outra página do conjunto retido sem ir às fontes', async () => {
    await servico.recentes(FILTROS_PADRAO);

    const segunda = await servico.reordenar({ ...FILTROS_PADRAO, pagina: 2 });

    expect(segunda.pagina).toBe(2);
    expect(segunda.documentos).toHaveLength(12 - POR_PAGINA);
    expect(github.documentosRecentes).toHaveBeenCalledTimes(1);
  });

  it('preserva falhas e avisos da consulta que produziu o conjunto', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: ACERVO,
      aviso: 'Parte dos documentos ficou de fora.'
    });

    await servico.buscar({ ...FILTROS_PADRAO, termo: '.md' });
    const reordenado = await servico.reordenar({
      ...FILTROS_PADRAO,
      termo: '.md',
      ordenacao: 'z-a'
    });

    expect(reordenado.avisos).toEqual([
      { fonte: 'github', mensagem: 'Parte dos documentos ficou de fora.' }
    ]);
  });
});

describe('filtros divergentes do conjunto retido', () => {
  it('termo diferente volta a consultar as fontes', async () => {
    await servico.buscar({ ...FILTROS_PADRAO, termo: '.md' });

    await servico.reordenar({ ...FILTROS_PADRAO, termo: 'outro', ordenacao: 'a-z' });

    expect(github.buscarDocumentos).toHaveBeenCalledTimes(2);
  });

  it('período diferente volta a consultar as fontes', async () => {
    await servico.recentes(FILTROS_PADRAO);

    await servico.reordenar({ ...FILTROS_PADRAO, dataInicial: '2026-01-05' });

    // Com período, a rota é o acervo: a janela de recentes não o alcança.
    expect(github.buscarDocumentos).toHaveBeenCalledTimes(1);
  });

  it('extensão diferente volta a consultar as fontes', async () => {
    await servico.recentes(FILTROS_PADRAO);

    await servico.reordenar({ ...FILTROS_PADRAO, extensoes: ['pdf'] });

    expect(github.documentosRecentes).toHaveBeenCalledTimes(2);
  });

  it('trocar só o critério e a página não conta como divergência', async () => {
    await servico.recentes({ ...FILTROS_PADRAO, extensoes: ['md'] });

    await servico.reordenar({
      ...FILTROS_PADRAO,
      extensoes: ['md'],
      ordenacao: 'z-a',
      pagina: 2
    });

    expect(github.documentosRecentes).toHaveBeenCalledTimes(1);
  });
});
