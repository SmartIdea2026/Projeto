import { EXTENSOES_ACEITAS, type Fonte } from '../../compartilhado/tipos';

/**
 * Utilidades compartilhadas entre as integrações com as fontes externas.
 *
 * As regras de filtragem e ordenação ficam em `busca/regras.ts`: elas operam
 * sobre documentos já normalizados e não dependem de fonte alguma.
 */

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
