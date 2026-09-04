/**
 * Normalização e correspondência de termo usadas na busca.
 *
 * Fica em `compartilhado/` pelo mesmo motivo de `ordenacao.ts`: o processo
 * principal filtra por termo (`main/busca/regras.ts`) e o renderer precisa da
 * mesma regra depois que a autoria de um documento é atualizada em segundo
 * plano (`App.tsx` - `detalharPagina`) — duplicar a lógica nas duas camadas
 * abriria espaço para divergirem.
 */

/**
 * Normaliza um texto para comparação de termo: sem acento e sem caixa.
 *
 * A mesma normalização vale para nome, autor e conteúdo — procurar "atas"
 * encontra "Atás".
 */
export function normalizar(texto: string): string {
  // NFD separa a letra do acento; a faixa \u0300–\u036f cobre os diacríticos
  // combinantes, que são então removidos.
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
}

/**
 * Verdadeiro quando o termo (já normalizado) casa com o nome ou o autor do
 * documento, por substring — a mesma regra de `aplicarFiltros` para esses dois
 * campos.
 *
 * O conteúdo fica de fora de propósito: casar por conteúdo exige o texto do
 * documento, que nunca alcança o renderer (ADR-0005). Por isso esta função só
 * serve para revalidar nome e autor — o único uso hoje é conferir, depois que
 * a autoria real de um documento chega do GitHub, se ele ainda justifica estar
 * no resultado de uma busca por termo.
 */
export function casaPorNomeOuAutor(
  documento: { nome: string; autor?: string | null },
  termoNormalizado: string
): boolean {
  return (
    normalizar(documento.nome).includes(termoNormalizado) ||
    normalizar(documento.autor ?? '').includes(termoNormalizado)
  );
}
