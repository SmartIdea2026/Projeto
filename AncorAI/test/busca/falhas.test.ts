import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroFonte } from '../../src/main/fontes/comum';
import { FILTROS_PADRAO, type Documento } from '../../src/compartilhado/tipos';

/**
 * Cenários de falha das fontes (CB05, CB06, CB07).
 *
 * O serviço é carregado dinamicamente depois dos mocks porque ele importa o
 * cofre e o banco, que dependem do Electron e não existem sob o Vitest.
 *
 * Com a saída do Drive do MVP (ADR-0004) resta uma fonte, então os cenários de
 * isolamento entre fontes não são mais verificáveis ponta a ponta: o que se
 * testa aqui é que uma falha é coletada em vez de interromper a busca, que é a
 * metade de CB05 que sobrevive. `busca/regras.test.ts` cobre `fonteSelecionada`
 * de forma genérica, e o isolamento volta a ser testável quando houver a
 * segunda fonte.
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

const documento: Documento = {
  id: 'github:x:a.md',
  nome: 'a.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T00:00:00Z',
  link: 'https://exemplo/a'
};

beforeEach(() => {
  vi.clearAllMocks();
  cofre.obter.mockImplementation((chave: string) =>
    chave === 'github.token' ? 'token' : null
  );
});

describe('falha de uma fonte (CB05)', () => {
  it('coleta a falha em vez de interromper a busca', async () => {
    github.buscarDocumentos.mockRejectedValue(new ErroFonte('github', 'GitHub indisponível.'));

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    // A busca resolve normalmente: a falha é dado de saída, não exceção.
    expect(resultado.documentos).toHaveLength(0);
    expect(resultado.falhas).toHaveLength(1);
    expect(resultado.falhas[0]?.fonte).toBe('github');
    expect(resultado.falhas[0]?.mensagem).toBe('GitHub indisponível.');
  });

  it('devolve os documentos quando a fonte responde', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: [documento], aviso: null });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.documentos.map((d) => d.fonte)).toEqual(['github']);
    expect(resultado.falhas).toHaveLength(0);
    expect(resultado.avisos).toHaveLength(0);
  });
});

describe('falha em todas as fontes (CB06)', () => {
  it('não devolve documentos e relata a falha', async () => {
    github.documentosRecentes.mockRejectedValue(
      new ErroFonte('github', 'GitHub indisponível.')
    );

    const resultado = await servico.recentes(FILTROS_PADRAO);

    expect(resultado.documentos).toHaveLength(0);
    expect(resultado.falhas.map((f) => f.fonte)).toEqual(['github']);
  });
});

describe('limite de requisições', () => {
  it('sinaliza a falha como limite excedido', async () => {
    github.buscarDocumentos.mockRejectedValue(
      new ErroFonte('github', 'Limite atingido.', true)
    );

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.falhas[0]?.limiteExcedido).toBe(true);
  });
});

describe('fonte não configurada', () => {
  it('relata a ausência de credencial sem consultar a fonte', async () => {
    cofre.obter.mockReturnValue(null);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(github.buscarDocumentos).not.toHaveBeenCalled();
    expect(resultado.falhas[0]?.fonte).toBe('github');
    expect(resultado.falhas[0]?.mensagem).toBe('O GitHub não está configurado.');
  });
});

describe('seleção de fonte na busca (RN05)', () => {
  it('consulta a fonte quando ela está selecionada', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: [documento], aviso: null });

    await servico.buscar({ ...FILTROS_PADRAO, termo: 'a', fontes: ['github'] });

    expect(github.buscarDocumentos).toHaveBeenCalled();
  });

  it('lista vazia de fontes significa todas as fontes (RN04)', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: [documento], aviso: null });

    await servico.buscar({ ...FILTROS_PADRAO, termo: 'a', fontes: [] });

    expect(github.buscarDocumentos).toHaveBeenCalled();
  });
});

describe('classificação do estado de conexão', () => {
  it('distingue falha de rede de credencial inválida', () => {
    expect(servico.estadoDaFalha(new ErroFonte('github', 'Não foi possível alcançar o GitHub.')))
      .toBe('sem-conexao');
    expect(servico.estadoDaFalha(new ErroFonte('github', 'A credencial não é válida.')))
      .toBe('invalida');
  });
});

describe('estado das credenciais', () => {
  it('reporta não-configurada quando não há credencial', async () => {
    cofre.obter.mockReturnValue(null);

    const status = await servico.status();

    expect(status.map((item) => item.estado)).toEqual(['nao-configurada']);
  });

  it('reporta conectada e identifica a conta', async () => {
    github.verificarCredencial.mockResolvedValue('GustavoMairinck');

    const status = await servico.status(false);

    expect(status[0]).toMatchObject({ estado: 'conectada', conta: 'GustavoMairinck' });
  });

  it('reporta inválida quando a fonte recusa a credencial', async () => {
    github.verificarCredencial.mockRejectedValue(
      new ErroFonte('github', 'A credencial do GitHub não é válida.')
    );

    const status = await servico.status(false);

    expect(status.every((item) => item.estado === 'invalida')).toBe(true);
  });
});

describe('aviso de resultado parcial', () => {
  it('repassa o aviso da fonte sem tratá-lo como falha', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: [documento],
      aviso: 'Parte dos documentos ficou de fora.'
    });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    // A distinção é o ponto: houve resultado, então não é falha.
    expect(resultado.documentos).toHaveLength(1);
    expect(resultado.falhas).toHaveLength(0);
    expect(resultado.avisos).toEqual([
      { fonte: 'github', mensagem: 'Parte dos documentos ficou de fora.' }
    ]);
  });

  it('avisa quando o período deixa documentos de fora por data não resolvida', async () => {
    // Sem repositório e caminho, a data real não pode ser obtida.
    github.buscarDocumentos.mockResolvedValue({
      dados: [{ ...documento, dataAproximada: true }],
      aviso: null
    });

    const resultado = await servico.buscar({
      ...FILTROS_PADRAO,
      dataInicial: '2026-07-01',
      dataFinal: '2026-09-01'
    });

    // O documento sai do resultado, e a saída é dita: uma ausência silenciosa
    // é indistinguível de um documento que nunca existiu.
    expect(resultado.documentos).toHaveLength(0);
    expect(resultado.total).toBe(0);
    expect(resultado.avisos).toHaveLength(1);
    expect(resultado.avisos[0]?.mensagem).toContain('não pôde ser obtida');
    // O aviso antigo dizia o contrário: que a data usada era a do repositório.
    expect(resultado.avisos[0]?.mensagem).not.toContain('atividade do repositório');
  });

  it('não avisa quando a data real de todos os candidatos foi resolvida', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: [
        { ...documento, dataAproximada: true, repositorio: 'o/r', caminho: 'Docs/a.md' }
      ],
      aviso: null
    });
    github.autoriaDoArquivo.mockResolvedValue({
      autor: 'Gabi Prajo',
      dataModificacao: '2026-08-15T00:00:00Z'
    });

    const resultado = await servico.buscar({
      ...FILTROS_PADRAO,
      dataInicial: '2026-07-01',
      dataFinal: '2026-09-01'
    });

    expect(resultado.documentos).toHaveLength(1);
    expect(resultado.avisos).toEqual([]);
  });

  it('não avisa sobre período quando nenhum filtro de data está ativo', async () => {
    github.buscarDocumentos.mockResolvedValue({
      dados: [{ ...documento, dataAproximada: true }],
      aviso: null
    });

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.avisos).toHaveLength(0);
  });

  it('não avisa sobre período quando as datas são exatas', async () => {
    github.buscarDocumentos.mockResolvedValue({ dados: [documento], aviso: null });

    const resultado = await servico.buscar({
      ...FILTROS_PADRAO,
      dataInicial: '2026-07-01'
    });

    expect(resultado.avisos).toHaveLength(0);
  });
});

describe('ordenação da lista de recentes', () => {
  const antigo = { ...documento, id: 'github:1', nome: 'zebra.md', dataModificacao: '2026-01-01T00:00:00Z' };
  const novo = { ...documento, id: 'github:2', nome: 'abacate.md', dataModificacao: '2026-08-01T00:00:00Z' };

  it('respeita o critério pedido em vez de impor data decrescente', async () => {
    github.documentosRecentes.mockResolvedValue({ dados: [antigo, novo], aviso: null });

    const resultado = await servico.recentes({ ...FILTROS_PADRAO, ordenacao: 'a-z' });

    // Antes, `prepararRecentes` fixava 'data-desc' e a escolha era descartada.
    expect(resultado.documentos.map((d) => d.nome)).toEqual(['abacate.md', 'zebra.md']);
  });

  it('usa data decrescente quando esse é o critério vigente', async () => {
    github.documentosRecentes.mockResolvedValue({ dados: [antigo, novo], aviso: null });

    const resultado = await servico.recentes({ ...FILTROS_PADRAO, ordenacao: 'data-desc' });

    expect(resultado.documentos.map((d) => d.nome)).toEqual(['abacate.md', 'zebra.md']);
  });

  it('ordena os recentes vindos do cache pelo mesmo critério', async () => {
    const { lerCache } = await import('../../src/main/banco/repositorio');
    vi.mocked(lerCache).mockResolvedValue({ payload: [antigo, novo], etag: null } as never);

    const resultado = await servico.recentesDoCache({ ...FILTROS_PADRAO, ordenacao: 'z-a' });

    expect(resultado?.documentos.map((d) => d.nome)).toEqual(['zebra.md', 'abacate.md']);
  });

  it('produz a mesma ordem que a reordenação local do renderer', async () => {
    const { ordenar } = await import('../../src/compartilhado/ordenacao');
    github.documentosRecentes.mockResolvedValue({ dados: [antigo, novo], aviso: null });

    const doServico = await servico.recentes({ ...FILTROS_PADRAO, ordenacao: 'data-asc' });
    const doRenderer = ordenar([antigo, novo], 'data-asc');

    // Os dois lados usam a mesma função de `compartilhado/`: divergir seria
    // reintroduzir exatamente o defeito que esta mudança corrige.
    expect(doServico.documentos.map((d) => d.id)).toEqual(doRenderer.map((d) => d.id));
  });
});
