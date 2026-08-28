import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  abrirBanco,
  fecharBanco,
  gravarCache,
  lerCache,
  listarAcessados,
  registrarAcesso
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
