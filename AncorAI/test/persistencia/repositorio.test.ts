import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  abrirBanco,
  conteudoParaBusca,
  documentosSemAutoria,
  fecharBanco,
  gravarAutoria,
  gravarConteudo,
  gravarCache,
  idsComAutoriaPendente,
  inventarioSincronizado,
  lerCache,
  listarAcessados,
  registrarAcesso,
  sincronizarInventario
} from '../../src/main/banco/repositorio';
import type { Documento } from '../../src/compartilhado/tipos';

/** Exercita o banco NoSQL local contra um diretório temporário real. */

let diretorio: string;

const documento: Documento = {
  id: 'github:SmartIdea2026/Projeto:Docs/ADR/ADR-0001.md',
  nome: 'ADR-0001.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-27T12:00:00Z',
  link: 'https://github.com/SmartIdea2026/Projeto/blob/main/Docs/ADR/ADR-0001.md',
  caminho: 'Docs/ADR/ADR-0001.md',
  repositorio: 'SmartIdea2026/Projeto'
};

beforeAll(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-teste-'));
  await abrirBanco(diretorio);
});

afterAll(() => {
  fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
});

describe('registro de documentos acessados', () => {
  it('guarda o acesso e o devolve na listagem', async () => {
    await registrarAcesso(documento);
    const acessados = await listarAcessados();

    expect(acessados).toHaveLength(1);
    expect(acessados[0]).toMatchObject({
      id: documento.id,
      nome: 'ADR-0001.md',
      fonte: 'github',
      link: documento.link
    });
  });

  it('não duplica o registro ao acessar o mesmo documento novamente', async () => {
    await registrarAcesso(documento);
    await registrarAcesso(documento);

    expect(await listarAcessados()).toHaveLength(1);
  });

  it('ordena do acesso mais recente para o mais antigo', async () => {
    await registrarAcesso({ ...documento, id: 'github:2', nome: 'outro.pdf' });
    const acessados = await listarAcessados();

    expect(acessados[0]?.id).toBe('github:2');
  });
});

describe('armazenamento do conteúdo', () => {
  /**
   * Este é o teste que protege a decisão da ADR-0002: guardar apenas o link.
   * Ele inspeciona o arquivo do banco, e não a API, porque o que importa é o
   * que efetivamente chega ao disco.
   */
  it('não persiste o conteúdo do documento, apenas o link', async () => {
    const conteudoSigiloso = 'CONTEUDO-INTEGRAL-DO-DOCUMENTO-NAO-DEVE-SER-GRAVADO';
    await registrarAcesso({
      ...documento,
      id: 'github:x:sigilo.md',
      // Mesmo que um campo extra chegue junto, ele não deve ser gravado.
      ...({ conteudo: conteudoSigiloso } as Partial<Documento>)
    });

    const bruto = readFileSync(join(diretorio, 'documentos_acessados.db'), 'utf8');

    expect(bruto).not.toContain(conteudoSigiloso);
    expect(bruto).toContain('sigilo.md');
  });

  it('grava somente os campos previstos no registro de acesso', async () => {
    const acessados = await listarAcessados();
    for (const registro of acessados) {
      expect(Object.keys(registro).sort()).toEqual([
        'acessadoEm',
        'fonte',
        'id',
        'link',
        'nome'
      ]);
    }
  });
});

describe('conteúdo para a busca', () => {
  it('só entrega texto dos registros extraídos, mas a versão de todos', async () => {
    await gravarConteudo({
      _id: 'github:x:com-texto.md',
      versaoConteudo: 'sha-a',
      estado: 'extraido',
      texto: 'Conteúdo do documento para a busca.',
      truncado: false
    });
    await gravarConteudo({
      _id: 'github:x:sem-texto.pdf',
      versaoConteudo: 'sha-b',
      estado: 'sem-texto',
      texto: '',
      truncado: false
    });
    await gravarConteudo({
      _id: 'github:x:grande.md',
      versaoConteudo: 'sha-c',
      estado: 'excedente',
      texto: '',
      truncado: false,
      motivo: 'O arquivo excede o limite.'
    });

    const { textos, versoes } = await conteudoParaBusca();

    // O texto só existe para o que foi extraído.
    expect([...textos.keys()]).toEqual(['github:x:com-texto.md']);
    expect(textos.get('github:x:com-texto.md')).toBe('Conteúdo do documento para a busca.');

    // A versão acompanha todo registro, para aferir cobertura da sincronização.
    expect(versoes.get('github:x:com-texto.md')).toBe('sha-a');
    expect(versoes.get('github:x:sem-texto.pdf')).toBe('sha-b');
    expect(versoes.get('github:x:grande.md')).toBe('sha-c');
  });
});

describe('snapshot do inventário', () => {
  const doInventario = (id: string, extra: Partial<Documento> = {}): Documento => ({
    id,
    nome: id.split(':').pop() ?? id,
    extensao: 'md',
    fonte: 'github',
    dataModificacao: '2026-08-01T00:00:00Z',
    dataAproximada: true,
    link: `https://github.com/x/${id}`,
    caminho: `docs/${id}.md`,
    repositorio: 'x/x',
    versaoConteudo: `sha-${id}`,
    ...extra
  });

  it('vazio antes da primeira sincronização', async () => {
    expect(await inventarioSincronizado()).toEqual([]);
  });

  it('guarda os documentos do inventário e remove os que saíram', async () => {
    await sincronizarInventario([doInventario('a'), doInventario('b')]);
    expect((await inventarioSincronizado()).map((d) => d.id).sort()).toEqual([
      'a',
      'b'
    ]);

    await sincronizarInventario([doInventario('a'), doInventario('c')]);
    expect((await inventarioSincronizado()).map((d) => d.id).sort()).toEqual([
      'a',
      'c'
    ]);
  });

  it('devolve o documento com data aproximada enquanto a autoria não foi resolvida', async () => {
    await sincronizarInventario([doInventario('sem-autor')]);
    const [documento] = await inventarioSincronizado();

    expect(documento?.autor).toBeUndefined();
    expect(documento?.dataAproximada).toBe(true);
    expect(await documentosSemAutoria()).toBe(1);
  });

  it('aplica a autoria resolvida: autor, data real e sem marca de aproximada', async () => {
    await sincronizarInventario([doInventario('com-autor')]);
    await gravarAutoria('com-autor', {
      autor: 'gabi',
      dataModificacao: '2026-08-15T09:00:00Z',
      versaoAutoria: 'sha-com-autor'
    });

    const [documento] = await inventarioSincronizado();
    expect(documento?.autor).toBe('gabi');
    expect(documento?.dataModificacao).toBe('2026-08-15T09:00:00Z');
    expect(documento?.dataAproximada).toBeUndefined();
    expect(await documentosSemAutoria()).toBe(0);
  });

  it('preserva a autoria resolvida ao regravar o inventário', async () => {
    await sincronizarInventario([doInventario('mantem')]);
    await gravarAutoria('mantem', {
      autor: 'ana',
      dataModificacao: '2026-08-10T00:00:00Z',
      versaoAutoria: 'sha-mantem'
    });

    await sincronizarInventario([doInventario('mantem')]);

    const [documento] = await inventarioSincronizado();
    expect(documento?.autor).toBe('ana');
  });

  it('volta a exigir autoria quando o sha do blob muda', async () => {
    await sincronizarInventario([doInventario('mudou')]);
    await gravarAutoria('mudou', {
      autor: 'ze',
      dataModificacao: '2026-08-10T00:00:00Z',
      versaoAutoria: 'sha-mudou'
    });

    await sincronizarInventario([
      doInventario('mudou', { versaoConteudo: 'sha-novo' })
    ]);

    const [documento] = await inventarioSincronizado();
    expect(documento?.autor).toBeUndefined();
    expect(documento?.dataAproximada).toBe(true);
    expect(await documentosSemAutoria()).toBe(1);
  });

  it('deixa o documento pendente quando a autoria não foi obtida', async () => {
    await sincronizarInventario([doInventario('anonimo')]);
    // Nenhuma chamada a gravarAutoria: a varredura não conseguiu a autoria.

    const [documento] = await inventarioSincronizado();
    expect(documento?.autor).toBeUndefined();
    expect(await idsComAutoriaPendente()).toEqual(['anonimo']);
  });
});

describe('cache das fontes', () => {
  it('devolve o que foi gravado, com o ETag', async () => {
    await gravarCache('github:tree:x', { tree: [1, 2, 3] }, 'W/"abc"');
    const entrada = await lerCache<{ tree: number[] }>('github:tree:x');

    expect(entrada?.etag).toBe('W/"abc"');
    expect(entrada?.payload.tree).toEqual([1, 2, 3]);
  });

  it('devolve nulo para chave inexistente', async () => {
    expect(await lerCache('nao-existe')).toBeNull();
  });

  it('substitui a entrada anterior da mesma chave', async () => {
    await gravarCache('chave', { v: 1 }, null);
    await gravarCache('chave', { v: 2 }, null);
    const entrada = await lerCache<{ v: number }>('chave');

    expect(entrada?.payload.v).toBe(2);
  });
});
