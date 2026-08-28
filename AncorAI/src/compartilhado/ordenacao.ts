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
 */
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
