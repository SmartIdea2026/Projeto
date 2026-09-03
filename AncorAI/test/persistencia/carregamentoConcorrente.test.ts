import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Datastore from '@seald-io/nedb';
import {
  abrirBanco,
  categoriasDisponiveis,
  conteudoParaBusca,
  fecharBanco,
  inventarioSincronizado,
  lerConteudo
} from '../../src/main/banco/repositorio';

/**
 * Duas funções públicas que tocam o acervo ou o conteúdo pela primeira vez —
 * a busca de recentes e o dropdown de categoria, por exemplo — podem disparar
 * quase juntas, ambas ao mount da tela (`categorizar-documentos-pelo-resumo`).
 * Sem uma promessa de carregamento compartilhada, cada uma abriria seu
 * próprio `Datastore` sobre o mesmo arquivo, e o NeDB não tolera essa
 * concorrência: a segunda instância a persistir encontra o `.db~` temporário
 * que a primeira já consumiu ao renomear, e falha com ENOENT — foi o erro
 * visto em uso real.
 *
 * Este arquivo é próprio, e não um bloco dentro de `repositorio.test.ts`,
 * porque o que se mede aqui é o instante em que cada coleção é aberta pela
 * *primeira* vez — e `repositorio.test.ts` mantém um banco compartilhado
 * entre todos os seus testes, o que esconderia exatamente essa primeira
 * abertura.
 */

let diretorio: string;

beforeEach(async () => {
  diretorio = mkdtempSync(join(tmpdir(), 'ancorai-concorrencia-'));
  await abrirBanco(diretorio);
});

afterEach(() => {
  vi.restoreAllMocks();
  fecharBanco();
  rmSync(diretorio, { recursive: true, force: true });
});

describe('carregamento concorrente das coleções', () => {
  it('duas chamadas concorrentes ao acervo abrem o Datastore uma única vez', async () => {
    const espiao = vi.spyOn(Datastore.prototype, 'loadDatabaseAsync');

    const [, categorias] = await Promise.all([inventarioSincronizado(), categoriasDisponiveis()]);

    expect(categorias).toEqual([]);
    // `abrirBanco` já carregou `acessos` e `cache` no `beforeEach` — só o
    // acervo é novo aqui, e deve ser aberto uma vez só, não duas.
    expect(espiao).toHaveBeenCalledTimes(1);
  });

  it('duas chamadas concorrentes ao conteúdo abrem o Datastore uma única vez', async () => {
    const espiao = vi.spyOn(Datastore.prototype, 'loadDatabaseAsync');

    await Promise.all([lerConteudo('qualquer'), conteudoParaBusca()]);

    expect(espiao).toHaveBeenCalledTimes(1);
  });
});
