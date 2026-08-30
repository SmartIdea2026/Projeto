import type { Documento, Filtros, Fonte } from '../../compartilhado/tipos';

// Reexportado para que o main continue importando as regras de um lugar só. A
// implementação vive em `compartilhado/` porque o renderer também a usa.
export { ordenar } from '../../compartilhado/ordenacao';

/**
 * Regras de filtragem e ordenação aplicadas sobre os documentos já obtidos.
 *
 * Estas regras são independentes das fontes: operam sobre o formato unificado,
 * depois que cada fonte já foi normalizada.
 */

/**
 * Aplica os filtros de termo, extensão e período.
 *
 * O termo é comparado ao nome do arquivo e ao autor da última alteração. O
 * autor só está preenchido nos documentos que passaram por `detalhar`; os
 * demais continuam encontráveis pelo nome.
 *
 * O período incide sobre a data real do documento. Documento cuja data ainda
 * for aproximada é descartado enquanto houver período em vigor: ver o comentário
 * na própria regra.
 *
 * O filtro de fonte não é aplicado aqui: ele decide quais fontes chegam a ser
 * consultadas, antes desta etapa.
 */
export function aplicarFiltros(documentos: Documento[], filtros: Filtros): Documento[] {
  const termo = filtros.termo.trim().toLocaleLowerCase();
  const inicial = filtros.dataInicial ? Date.parse(filtros.dataInicial) : null;
  // A data final é inclusiva: o usuário informa um dia, não um instante.
  const final = filtros.dataFinal ? Date.parse(filtros.dataFinal) + 86_399_999 : null;

  return documentos.filter((documento) => {
    // O termo casa com o nome do arquivo ou com quem o alterou por último:
    // procurar "gabi" deve encontrar o que a Gabi escreveu, não só arquivos
    // com "gabi" no nome.
    if (termo) {
      const noNome = documento.nome.toLocaleLowerCase().includes(termo);
      const noAutor = (documento.autor ?? '').toLocaleLowerCase().includes(termo);
      if (!noNome && !noAutor) return false;
    }

    if (filtros.extensoes.length > 0 && !filtros.extensoes.includes(documento.extensao)) {
      return false;
    }

    if (inicial !== null || final !== null) {
      // Data aproximada não serve a um recorte por data: ela é a do
      // repositório, igual para todos os arquivos dele. Presumir o documento
      // dentro do intervalo contradiz o filtro; presumi-lo fora seria
      // igualmente arbitrário — a diferença é que a omissão pode ser
      // comunicada ao usuário, e a inclusão indevida não. Quem resolve a data
      // antes desta etapa é `enriquecerParaBusca`; o que chega aqui ainda
      // marcado é o que ficou além do teto ou falhou.
      if (documento.dataAproximada) return false;

      const data = Date.parse(documento.dataModificacao);
      if (Number.isNaN(data)) return false;
      if (inicial !== null && data < inicial) return false;
      if (final !== null && data > final) return false;
    }

    return true;
  });
}


/** Remove duplicatas por id, preservando a ordem de entrada. */
export function unificar(documentos: Documento[]): Documento[] {
  const vistos = new Map<string, Documento>();
  for (const documento of documentos) {
    if (!vistos.has(documento.id)) vistos.set(documento.id, documento);
  }
  return [...vistos.values()];
}

/** Verdadeiro quando a fonte deve ser consultada (RN04 e RN05). */
export function fonteSelecionada(filtros: Filtros, fonte: Fonte): boolean {
  return filtros.fontes.length === 0 || filtros.fontes.includes(fonte);
}
