import {
  EXTENSOES_ACEITAS,
  type Documento,
  type Filtros,
  type Fonte,
  type Ordenacao
} from '../../compartilhado/tipos';

/** Erro atribuído a uma fonte específica, para o aviso parcial de CB05. */
export class ErroFonte extends Error {
  constructor(
    readonly fonte: Fonte,
    mensagem: string,
    readonly limiteExcedido = false
  ) {
    super(mensagem);
    this.name = 'ErroFonte';
  }
}

export function extensaoDe(nome: string): string {
  const partes = nome.split('.');
  return partes.length > 1 ? (partes.pop() ?? '').toLowerCase() : '';
}

export function extensaoEhAceita(nome: string): boolean {
  return (EXTENSOES_ACEITAS as readonly string[]).includes(extensaoDe(nome));
}

/**
 * Aplica os filtros de termo, extensão e período sobre os documentos.
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
    if (termo && !documento.nome.toLocaleLowerCase().includes(termo)) return false;

    if (filtros.extensoes.length > 0 && !filtros.extensoes.includes(documento.extensao)) {
      return false;
    }

    if (inicial !== null || final !== null) {
      const data = Date.parse(documento.dataModificacao);
      if (Number.isNaN(data)) return false;
      if (inicial !== null && data < inicial) return false;
      if (final !== null && data > final) return false;
    }

    return true;
  });
}

export function ordenar(documentos: Documento[], criterio: Ordenacao): Documento[] {
  const copia = [...documentos];
  const porNome = (a: Documento, b: Documento) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  const porData = (a: Documento, b: Documento) =>
    Date.parse(a.dataModificacao) - Date.parse(b.dataModificacao);

  switch (criterio) {
    case 'a-z':
      return copia.sort(porNome);
    case 'z-a':
      return copia.sort((a, b) => porNome(b, a));
    case 'data-asc':
      return copia.sort(porData);
    case 'data-desc':
      return copia.sort((a, b) => porData(b, a));
  }
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
