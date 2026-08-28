import type { Documento, Ordenacao } from './tipos';

/**
 * Ordenação dos documentos.
 *
 * Fica em `compartilhado/` porque os dois lados precisam da mesma
 * implementação: o processo main ordena o resultado da consulta, e o renderer
 * reordena localmente quando o usuário troca o critério — sem nova consulta às
 * fontes, conforme a especificação de busca. Duplicar a função nas duas camadas
 * abriria espaço para divergirem.
 *
 * É pura e não depende de Node nem do Electron, então atravessa a fronteira
 * sem carregar nada do processo principal junto.
 *
 * Os critérios de data desempatam por nome A–Z. Sem isso, documentos que
 * compartilham a mesma data saem em ordem arbitrária — situação comum no
 * GitHub, onde a busca deriva a data do repositório e não do arquivo, deixando
 * um repositório inteiro com a mesma data.
 */
export function ordenar(documentos: Documento[], criterio: Ordenacao): Documento[] {
  const copia = [...documentos];
  const porNome = (a: Documento, b: Documento) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  const porData = (a: Documento, b: Documento) =>
    Date.parse(a.dataModificacao) - Date.parse(b.dataModificacao);

  // O desempate por nome torna a ordem estável entre consultas sucessivas.
  const porDataDesempatada = (a: Documento, b: Documento, inverso: boolean) => {
    const diferenca = porData(a, b);
    if (diferenca !== 0) return inverso ? -diferenca : diferenca;
    return porNome(a, b);
  };

  switch (criterio) {
    case 'a-z':
      return copia.sort(porNome);
    case 'z-a':
      return copia.sort((a, b) => porNome(b, a));
    case 'data-asc':
      return copia.sort((a, b) => porDataDesempatada(a, b, false));
    case 'data-desc':
      return copia.sort((a, b) => porDataDesempatada(a, b, true));
  }
}
