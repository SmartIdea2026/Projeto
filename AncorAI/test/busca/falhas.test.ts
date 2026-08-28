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
    github.buscarDocumentos.mockResolvedValue([documento]);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.documentos.map((d) => d.fonte)).toEqual(['github']);
    expect(resultado.falhas).toHaveLength(0);
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
    github.buscarDocumentos.mockResolvedValue([documento]);

    await servico.buscar({ ...FILTROS_PADRAO, termo: 'a', fontes: ['github'] });

    expect(github.buscarDocumentos).toHaveBeenCalled();
  });

  it('lista vazia de fontes significa todas as fontes (RN04)', async () => {
    github.buscarDocumentos.mockResolvedValue([documento]);

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
