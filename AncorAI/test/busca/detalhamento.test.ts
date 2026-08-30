import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILTROS_PADRAO, type Documento } from '../../src/compartilhado/tipos';

/**
 * Enriquecimento da página apresentada com autoria e data real.
 *
 * O ponto que estes testes travam é o custo: só a página visível é consultada.
 * Estender ao resultado inteiro reintroduziria a razão pela qual este item foi
 * adiado no MVP.
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
  gravarCache: vi.fn(async () => undefined)
}));
vi.mock('../../src/main/credenciais/validacao', () => ({
  lerValidacao: vi.fn(async () => null),
  gravarValidacao: vi.fn(async () => undefined),
  invalidarValidacao: vi.fn(async () => undefined)
}));

const servico = await import('../../src/main/busca/servico');

function doc(nome: string, extras: Partial<Documento> = {}): Documento {
  return {
    id: `github:o/r:${nome}`,
    nome,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-01T00:00:00Z',
    dataAproximada: true,
    link: `https://exemplo/${nome}`,
    caminho: `Docs/${nome}`,
    repositorio: 'o/r',
    ...extras
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cofre.obter.mockImplementation((chave: string) =>
    chave === 'github.token' ? 'token' : null
  );
});

describe('detalhamento da página apresentada', () => {
  it('consulta apenas os documentos recebidos', async () => {
    github.autoriaDoArquivo.mockResolvedValue({
      autor: 'GustavoMairinck',
      dataModificacao: '2026-08-22T10:00:00Z'
    });

    const pagina = [doc('a.md'), doc('b.md')];
    await servico.detalhar(pagina);

    // Duas consultas para dois documentos: nada além da página.
    expect(github.autoriaDoArquivo).toHaveBeenCalledTimes(2);
  });

  it('substitui a data aproximada pela real e remove a marca', async () => {
    github.autoriaDoArquivo.mockResolvedValue({
      autor: 'GustavoMairinck',
      dataModificacao: '2026-08-22T10:00:00Z'
    });

    const [detalhado] = await servico.detalhar([doc('a.md')]);

    expect(detalhado?.autor).toBe('GustavoMairinck');
    expect(detalhado?.dataModificacao).toBe('2026-08-22T10:00:00Z');
    // A marca existia para avisar que a data era do repositório; com a data
    // real ela deixa de fazer sentido.
    expect(detalhado?.dataAproximada).toBeUndefined();
  });

  it('mantém o documento intacto quando a autoria não vem', async () => {
    github.autoriaDoArquivo.mockResolvedValue(null);

    const original = doc('a.md');
    const [detalhado] = await servico.detalhar([original]);

    expect(detalhado?.autor).toBeUndefined();
    expect(detalhado?.dataModificacao).toBe('2026-08-01T00:00:00Z');
    expect(detalhado?.dataAproximada).toBe(true);
  });

  it('um documento sem autoria não impede os demais', async () => {
    github.autoriaDoArquivo
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ autor: 'Marina', dataModificacao: '2026-08-18T09:00:00Z' });

    const detalhados = await servico.detalhar([doc('a.md'), doc('b.md')]);

    expect(detalhados[0]?.autor).toBeUndefined();
    expect(detalhados[1]?.autor).toBe('Marina');
  });

  it('preserva a ordem da página', async () => {
    github.autoriaDoArquivo.mockResolvedValue({
      autor: 'x',
      dataModificacao: '2026-08-22T10:00:00Z'
    });

    const detalhados = await servico.detalhar([doc('a.md'), doc('b.md'), doc('c.md')]);

    expect(detalhados.map((d) => d.nome)).toEqual(['a.md', 'b.md', 'c.md']);
  });

  it('não consulta documentos sem repositório ou caminho', async () => {
    const semCaminho = doc('x.md', { caminho: undefined });

    const [devolvido] = await servico.detalhar([semCaminho]);

    expect(github.autoriaDoArquivo).not.toHaveBeenCalled();
    expect(devolvido).toEqual(semCaminho);
  });

  it('devolve os documentos como vieram quando não há credencial', async () => {
    cofre.obter.mockReturnValue(null);

    const pagina = [doc('a.md')];
    expect(await servico.detalhar(pagina)).toEqual(pagina);
    expect(github.autoriaDoArquivo).not.toHaveBeenCalled();
  });
});

describe('enriquecimento para a busca por autor', () => {
  it('preenche a autoria antes de filtrar, para o termo alcançar o autor', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: [doc('ata.md'), doc('requisitos.md')],
      aviso: null
    });
    github.autoriaDoArquivo.mockImplementation(async (_t: string, _r: string, caminho: string) =>
      caminho.includes('ata')
        ? { autor: 'Gabi Prajo', dataModificacao: '2026-08-22T10:00:00Z' }
        : { autor: 'Marina Alves', dataModificacao: '2026-08-18T09:00:00Z' }
    );

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'gabi' });

    // Nenhum dos nomes de arquivo contém "gabi": a correspondência é do autor.
    expect(resultado.documentos.map((d) => d.nome)).toEqual(['ata.md']);
  });

  it('não consulta autoria quando não há termo de busca', async () => {
    github.documentosRecentes.mockResolvedValue({
      dados: [doc('ata.md'), doc('requisitos.md')],
      aviso: null
    });

    await servico.recentes(FILTROS_PADRAO);

    // Na tela de recentes o autor serve só para exibição, e a página visível
    // já é detalhada depois de apresentada.
    expect(github.autoriaDoArquivo).not.toHaveBeenCalled();
  });

  it('avisa quando o acervo excede o teto do enriquecimento', async () => {
    const muitos = Array.from({ length: 305 }, (_, i) => doc(`doc${i}.md`));
    github.buscarDocumentos.mockResolvedValue({ dados: muitos, aviso: null });
    github.autoriaDoArquivo.mockResolvedValue(null);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'doc' });

    // Cada documento custa uma requisição; o teto evita que a primeira busca
    // num acervo grande fique inviável, mas o usuário precisa saber do limite.
    expect(github.autoriaDoArquivo).toHaveBeenCalledTimes(300);
    expect(resultado.avisos.some((a) => a.mensagem.includes('300 primeiros'))).toBe(true);
  });

  it('não avisa quando o acervo cabe no teto', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: [doc('ata.md')], aviso: null });
    github.autoriaDoArquivo.mockResolvedValue(null);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'ata' });

    expect(resultado.avisos).toEqual([]);
  });

  it('limita a concorrência das consultas de autoria', async () => {
    let simultaneas = 0;
    let pico = 0;
    github.buscarDocumentos.mockResolvedValue({
      dados: Array.from({ length: 30 }, (_, i) => doc(`doc${i}.md`)),
      aviso: null
    });
    github.autoriaDoArquivo.mockImplementation(async () => {
      simultaneas += 1;
      pico = Math.max(pico, simultaneas);
      await new Promise((resolver) => setTimeout(resolver, 1));
      simultaneas -= 1;
      return null;
    });

    await servico.buscar({ ...FILTROS_PADRAO, termo: 'doc' });

    // Sem limite, os 30 sairiam de uma vez contra a API.
    expect(pico).toBeLessThanOrEqual(6);
  });
});

/**
 * Resolução da data antes do filtro de período.
 *
 * O período é comparado à data, e a data do inventário é a do repositório —
 * igual para todos os arquivos dele. Filtrar por ela é filtrar por atividade do
 * repositório sob o nome de recorte por data. Por isso, e só quando há período,
 * a data real é resolvida antes da filtragem.
 */
describe('data real antes do filtro de período', () => {
  it('descarta o documento cuja data real cai fora do intervalo', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: [doc('ata.md'), doc('antigo.md')],
      aviso: null
    });
    // Os dois herdaram a data do repositório, que está dentro do intervalo.
    // Só a data real distingue um do outro.
    github.autoriaDoArquivo.mockImplementation(async (_t: string, _r: string, caminho: string) =>
      caminho.includes('ata')
        ? { autor: 'Gabi Prajo', dataModificacao: '2026-08-10T00:00:00Z' }
        : { autor: 'Marina Alves', dataModificacao: '2025-02-01T00:00:00Z' }
    );

    const resultado = await servico.buscar({
      ...FILTROS_PADRAO,
      dataInicial: '2026-08-01',
      dataFinal: '2026-08-31'
    });

    expect(resultado.documentos.map((d) => d.nome)).toEqual(['ata.md']);
    // O contador acompanha: o descartado não entra no total.
    expect(resultado.total).toBe(1);
  });

  it('resolve a data mesmo sem termo de busca', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: [doc('ata.md')], aviso: null });
    github.autoriaDoArquivo.mockResolvedValue({
      autor: 'Gabi Prajo',
      dataModificacao: '2026-08-10T00:00:00Z'
    });

    await servico.buscar({ ...FILTROS_PADRAO, dataInicial: '2026-08-01' });

    expect(github.autoriaDoArquivo).toHaveBeenCalledTimes(1);
  });

  it('não consulta os documentos que já têm data real', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: [
        doc('do-commit.md', { dataAproximada: undefined }),
        doc('da-arvore.md')
      ],
      aviso: null
    });
    github.autoriaDoArquivo.mockResolvedValue({
      autor: 'Gabi Prajo',
      dataModificacao: '2026-08-10T00:00:00Z'
    });

    await servico.buscar({ ...FILTROS_PADRAO, dataInicial: '2026-08-01' });

    // Só o de data aproximada custa requisição: ao outro não falta dado algum.
    expect(github.autoriaDoArquivo).toHaveBeenCalledTimes(1);
    expect(github.autoriaDoArquivo.mock.calls[0]![2]).toContain('da-arvore');
  });

  it('resolve uma vez só quando há termo e período ao mesmo tempo', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: [doc('ata.md'), doc('requisitos.md')],
      aviso: null
    });
    github.autoriaDoArquivo.mockResolvedValue({
      autor: 'Gabi Prajo',
      dataModificacao: '2026-08-10T00:00:00Z'
    });

    await servico.buscar({
      ...FILTROS_PADRAO,
      termo: 'a',
      dataInicial: '2026-08-01',
      dataFinal: '2026-08-31'
    });

    // Autor e data vêm juntos da mesma consulta: pedir os dois separadamente
    // dobraria o custo sem trazer dado novo.
    expect(github.autoriaDoArquivo).toHaveBeenCalledTimes(2);
  });

  it('não resolve nada além da página quando não há termo nem período', async () => {
    github.documentosRecentes.mockResolvedValue({
      dados: [doc('ata.md'), doc('requisitos.md')],
      aviso: null
    });

    await servico.recentes(FILTROS_PADRAO);

    // O custo fica contido ao caso em que o dado decide quem entra no
    // resultado; fora dele, a página visível é detalhada depois de apresentada.
    expect(github.autoriaDoArquivo).not.toHaveBeenCalled();
  });
});
