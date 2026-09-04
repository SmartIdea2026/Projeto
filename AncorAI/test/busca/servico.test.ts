import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  abrirBanco,
  fecharBanco,
  gravarCategoriaAcervo,
  gravarConteudo,
  sincronizarInventario
} from '../../src/main/banco/repositorio';
import { buscar, reordenar } from '../../src/main/busca/servico';
import { FILTROS_PADRAO, type Documento, type Filtros } from '../../src/compartilhado/tipos';

/**
 * `reordenar` só reconsulta as fontes quando os filtros recebidos descrevem
 * uma consulta diferente da retida (`mesmaConsulta`, em `servico.ts`). A
 * categoria precisa entrar nessa comparação como qualquer outro filtro de
 * consulta: sem isso, pedir a mesma ordenação e termo sob uma categoria
 * diferente devolveria o conjunto retido da categoria anterior, em vez de
 * reconsultar.
 */

const TERMO = 'zorbatrix-conteudo';

const docCategoriaX: Documento = {
  id: 'doc-categoria-x',
  nome: 'documento-x.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T12:00:00Z',
  link: 'https://exemplo/x',
  repositorio: 'exemplo/repo'
};

const docCategoriaY: Documento = {
  id: 'doc-categoria-y',
  nome: 'documento-y.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-08-01T12:00:00Z',
  link: 'https://exemplo/y',
  repositorio: 'exemplo/repo'
};

let diretorioDados: string;

beforeEach(async () => {
  diretorioDados = mkdtempSync(join(tmpdir(), 'ancorai-servico-'));
  await abrirBanco(diretorioDados);
  await sincronizarInventario([docCategoriaX, docCategoriaY]);
  await gravarConteudo({
    _id: docCategoriaX.id,
    versaoConteudo: 'v1',
    estado: 'extraido',
    texto: `Parágrafo que menciona ${TERMO} no meio do texto.`,
    truncado: false
  });
  await gravarConteudo({
    _id: docCategoriaY.id,
    versaoConteudo: 'v1',
    estado: 'extraido',
    texto: `Outro parágrafo que também menciona ${TERMO} no corpo.`,
    truncado: false
  });
  await gravarCategoriaAcervo(docCategoriaX.id, { categoria: 'Categoria X', categoriaVersaoConteudo: 'v1' });
  await gravarCategoriaAcervo(docCategoriaY.id, { categoria: 'Categoria Y', categoriaVersaoConteudo: 'v1' });
});

afterEach(() => {
  fecharBanco();
  rmSync(diretorioDados, { recursive: true, force: true });
});

describe('reordenar() com categoria', () => {
  it('reconsulta em vez de reaproveitar o conjunto retido quando só a categoria muda', async () => {
    const filtrosX: Filtros = {
      ...FILTROS_PADRAO,
      termo: TERMO,
      buscarConteudo: true,
      categoria: 'Categoria X'
    };
    const resultadoX = await buscar(filtrosX);
    expect(resultadoX.documentos.map((d) => d.id)).toEqual([docCategoriaX.id]);

    const filtrosY: Filtros = { ...filtrosX, categoria: 'Categoria Y' };
    const resultadoY = await reordenar(filtrosY);

    // Antes da correção, `mesmaConsulta` ignorava a categoria e devolvia o
    // conjunto retido da consulta anterior (`doc-categoria-x`) sem reconsultar.
    expect(resultadoY.documentos.map((d) => d.id)).toEqual([docCategoriaY.id]);
  });
});
