import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Documento } from '../../src/compartilhado/tipos';

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
