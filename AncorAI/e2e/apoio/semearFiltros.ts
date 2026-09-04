import {
  abrirBanco,
  fecharBanco,
  gravarCategoriaAcervo,
  gravarConteudo,
  sincronizarInventario
} from '../../src/main/banco/repositorio';
import type { Documento } from '../../src/compartilhado/tipos';

/**
 * Conjunto de documentos próprio para `filtros.spec.ts`, apartado do par usado
 * por `busca-local.spec.ts` (design.md - Decisão 6): extensões distintas,
 * datas espaçadas, e um documento cujo termo de busca só existe no conteúdo,
 * não no nome — para o teste de "Buscar no conteúdo".
 *
 * Todos os quatro primeiros documentos carregam `TERMO_COMUM` no nome: buscar
 * por ele entra no modo "busca" (em vez de "recentes"), que é servido do
 * snapshot local incondicionalmente — ver `src/main/busca/servico.ts` -
 * `executarBusca`. O quinto documento não o carrega de propósito.
 */

export const TERMO_COMUM = 'e2efiltro';
export const TERMO_SO_CONTEUDO = 'abacateverde';
export const CATEGORIA_SO_CONTEUDO = 'Especificação';

export const DOC_ALFA: Documento = {
  id: 'e2e-filtro-alfa',
  nome: `alfa-${TERMO_COMUM}.md`,
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-01-10T12:00:00.000Z',
  link: 'https://github.com/exemplo/filtros/blob/main/alfa.md',
  repositorio: 'exemplo/filtros'
};

export const DOC_BETA: Documento = {
  id: 'e2e-filtro-beta',
  nome: `beta-${TERMO_COMUM}.pdf`,
  extensao: 'pdf',
  fonte: 'github',
  dataModificacao: '2026-03-15T12:00:00.000Z',
  link: 'https://github.com/exemplo/filtros/blob/main/beta.pdf',
  repositorio: 'exemplo/filtros'
};

export const DOC_GAMA: Documento = {
  id: 'e2e-filtro-gama',
  nome: `gama-${TERMO_COMUM}.txt`,
  extensao: 'txt',
  fonte: 'github',
  dataModificacao: '2026-06-20T12:00:00.000Z',
  link: 'https://github.com/exemplo/filtros/blob/main/gama.txt',
  repositorio: 'exemplo/filtros'
};

export const DOC_DELTA: Documento = {
  id: 'e2e-filtro-delta',
  nome: `delta-${TERMO_COMUM}.docx`,
  extensao: 'docx',
  fonte: 'github',
  dataModificacao: '2026-08-25T12:00:00.000Z',
  link: 'https://github.com/exemplo/filtros/blob/main/delta.docx',
  repositorio: 'exemplo/filtros'
};

/** Nome sem `TERMO_COMUM`: só o conteúdo, gravado à parte, contém o termo buscado. */
export const DOC_SO_CONTEUDO: Documento = {
  id: 'e2e-filtro-so-conteudo',
  nome: 'documento-sem-o-termo-no-nome.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-05-01T12:00:00.000Z',
  link: 'https://github.com/exemplo/filtros/blob/main/so-conteudo.md',
  repositorio: 'exemplo/filtros'
};

export async function semearParaFiltros(diretorioDados: string): Promise<void> {
  await abrirBanco(diretorioDados);
  await sincronizarInventario([DOC_ALFA, DOC_BETA, DOC_GAMA, DOC_DELTA, DOC_SO_CONTEUDO]);
  await gravarConteudo({
    _id: DOC_SO_CONTEUDO.id,
    versaoConteudo: 'semeado-e2e',
    estado: 'extraido',
    texto: `Um parágrafo qualquer que menciona ${TERMO_SO_CONTEUDO} no meio do texto.`,
    truncado: false
  });
  // Categoria espelhada no acervo (categorizar-documentos-pelo-resumo), como a
  // busca por conteúdo espera encontrar num documento já resumido pela IA —
  // usado pelo teste que combina "Buscar no conteúdo" com o filtro de categoria.
  await gravarCategoriaAcervo(DOC_SO_CONTEUDO.id, {
    categoria: CATEGORIA_SO_CONTEUDO,
    categoriaVersaoConteudo: 'semeado-e2e'
  });
  fecharBanco();
}
