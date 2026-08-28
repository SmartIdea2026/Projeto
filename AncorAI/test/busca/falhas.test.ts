import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroFonte } from '../../src/main/fontes/comum';
import { FILTROS_PADRAO, type Documento } from '../../src/compartilhado/tipos';

/**
 * Cenários de falha das fontes (CB05, CB06, CB07).
 *
 * O serviço é carregado dinamicamente depois dos mocks porque ele importa o
 * cofre e o banco, que dependem do Electron e não existem sob o Vitest.
 */

const cofre = { obter: vi.fn(), definir: vi.fn(), remover: vi.fn(), existe: vi.fn() };
const github = {
  buscarDocumentos: vi.fn(),
  documentosRecentes: vi.fn(),
  verificarCredencial: vi.fn()
};
const drive = {
  buscarDocumentos: vi.fn(),
  documentosRecentes: vi.fn(),
  verificarCredencial: vi.fn()
};

vi.mock('../../src/main/credenciais/cofre', () => cofre);
vi.mock('../../src/main/fontes/github', () => github);
vi.mock('../../src/main/fontes/drive', () => drive);
vi.mock('../../src/main/oauth/google', () => ({
  obterAcesso: vi.fn(),
  esquecerAcesso: vi.fn()
}));
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

/** Credenciais das duas fontes presentes. */
function comAmbasConfiguradas() {
  cofre.obter.mockImplementation((chave: string) =>
    chave === 'github.token' ? 'token' : 'valor-drive'
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  comAmbasConfiguradas();
});

describe('falha em apenas uma fonte (CB05)', () => {
  it('apresenta os documentos da fonte que respondeu e informa a que falhou', async () => {
    github.buscarDocumentos.mockResolvedValue([documento]);
    drive.buscarDocumentos.mockRejectedValue(new ErroFonte('drive', 'Drive indisponível.'));

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.documentos).toHaveLength(1);
    expect(resultado.falhas).toHaveLength(1);
    expect(resultado.falhas[0]?.fonte).toBe('drive');
  });

  it('mantém a busca utilizável quando o GitHub falha', async () => {
    github.buscarDocumentos.mockRejectedValue(new ErroFonte('github', 'GitHub indisponível.'));
    drive.buscarDocumentos.mockResolvedValue([{ ...documento, id: 'drive:1', fonte: 'drive' }]);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.documentos.map((d) => d.fonte)).toEqual(['drive']);
    expect(resultado.falhas[0]?.fonte).toBe('github');
  });
});

describe('falha nas duas fontes (CB06)', () => {
  it('não devolve documentos e relata as duas falhas', async () => {
    github.buscarDocumentos.mockRejectedValue(new ErroFonte('github', 'GitHub indisponível.'));
    drive.buscarDocumentos.mockRejectedValue(new ErroFonte('drive', 'Drive indisponível.'));

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.documentos).toHaveLength(0);
    expect(resultado.falhas.map((f) => f.fonte).sort()).toEqual(['drive', 'github']);
  });
});

describe('limite de requisições', () => {
  it('sinaliza a falha como limite excedido', async () => {
    github.buscarDocumentos.mockRejectedValue(
      new ErroFonte('github', 'Limite atingido.', true)
    );
    drive.buscarDocumentos.mockResolvedValue([]);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(resultado.falhas[0]?.limiteExcedido).toBe(true);
  });
});

describe('fonte não configurada', () => {
  it('relata a ausência de credencial sem consultar a fonte', async () => {
    cofre.obter.mockImplementation((chave: string) =>
      chave === 'github.token' ? 'token' : null
    );
    github.buscarDocumentos.mockResolvedValue([documento]);

    const resultado = await servico.buscar({ ...FILTROS_PADRAO, termo: 'a' });

    expect(drive.buscarDocumentos).not.toHaveBeenCalled();
    expect(resultado.falhas[0]?.fonte).toBe('drive');
    expect(resultado.documentos).toHaveLength(1);
  });
});

describe('seleção de fonte na busca', () => {
  it('não consulta a fonte que não foi selecionada (RN05)', async () => {
    github.buscarDocumentos.mockResolvedValue([documento]);

    await servico.buscar({ ...FILTROS_PADRAO, termo: 'a', fontes: ['github'] });

    expect(github.buscarDocumentos).toHaveBeenCalled();
    expect(drive.buscarDocumentos).not.toHaveBeenCalled();
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

    expect(status.map((item) => item.estado)).toEqual([
      'nao-configurada',
      'nao-configurada'
    ]);
  });

  it('reporta conectada e identifica a conta', async () => {
    github.verificarCredencial.mockResolvedValue('GustavoMairinck');
    drive.verificarCredencial.mockResolvedValue('equipe@exemplo.com');

    const status = await servico.status(false);

    expect(status[0]).toMatchObject({ estado: 'conectada', conta: 'GustavoMairinck' });
    expect(status[1]).toMatchObject({ estado: 'conectada', conta: 'equipe@exemplo.com' });
  });

  it('reporta inválida quando a fonte recusa a credencial', async () => {
    github.verificarCredencial.mockRejectedValue(
      new ErroFonte('github', 'A credencial do GitHub não é válida.')
    );
    drive.verificarCredencial.mockRejectedValue(
      new ErroFonte('drive', 'A autorização não é mais válida.')
    );

    const status = await servico.status(false);

    expect(status.every((item) => item.estado === 'invalida')).toBe(true);
  });
});
