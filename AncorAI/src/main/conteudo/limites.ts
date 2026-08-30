import type { Documento } from '../../compartilhado/tipos';

/**
 * Tetos da ingestão de conteúdo, em um lugar só.
 *
 * O banco é NeDB e carrega a base inteira em memória ao abrir. A ADR-0002
 * registra isso como risco e manda reavaliar "caso o histórico ou os resumos
 * cresçam além do esperado" — guardar texto de documentos é exatamente esse
 * crescimento, e estes três números são a resposta a ele (ADR-0005).
 *
 * Para o acervo atual nenhum deles chega perto de valer. Existem para que o
 * comportamento no dia em que valerem seja uma decisão escrita, e não uma
 * surpresa.
 */

/** Acima disto o arquivo não é baixado. */
export const LIMITE_BYTES_POR_ARQUIVO = 2 * 1024 * 1024;

/** Acima disto o texto extraído é cortado, e o corte fica registrado. */
export const LIMITE_CARACTERES_POR_DOCUMENTO = 200_000;

/** Acima disto a ingestão de segundo plano se suspende. */
export const LIMITE_CARACTERES_TOTAL = 50 * 1024 * 1024;

/**
 * Motivo pelo qual um documento não é ingerido, ou `null` quando pode ser.
 *
 * O tamanho vem do inventário, então um arquivo grande demais é descartado
 * **sem gastar requisição alguma** para descobrir que é grande demais. Um
 * documento sem `versaoConteudo` — os que vêm dos commits, e não da árvore —
 * não tem como ser endereçado por conteúdo e fica de fora pelo mesmo caminho.
 */
export function motivoParaNaoIngerir(documento: Documento): string | null {
  if (!documento.versaoConteudo) {
    return 'A fonte não informou a identidade do conteúdo deste documento.';
  }

  if (documento.tamanho !== undefined && documento.tamanho > LIMITE_BYTES_POR_ARQUIVO) {
    const mb = (LIMITE_BYTES_POR_ARQUIVO / 1024 / 1024).toFixed(0);
    return `O arquivo excede o limite de ${mb} MB por documento.`;
  }

  return null;
}

/** Corta o texto no limite por documento, informando se cortou. */
export function limitarTexto(texto: string): { texto: string; truncado: boolean } {
  if (texto.length <= LIMITE_CARACTERES_POR_DOCUMENTO) {
    return { texto, truncado: false };
  }
  return {
    texto: texto.slice(0, LIMITE_CARACTERES_POR_DOCUMENTO),
    truncado: true
  };
}
