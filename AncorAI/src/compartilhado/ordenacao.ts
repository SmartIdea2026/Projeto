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
 *
 * Todo critério desempata, por último, pelo identificador. Ele é único, então
 * a ordem resultante é total: dois documentos nunca ficam empatados até o fim,
 * e a lista sai igual em consultas sucessivas. Sem esse último critério,
 * documentos de mesmo nome em repositórios diferentes — `README.md`, `ata.md`,
 * que são a regra e não a exceção — continuam trocando de lugar entre uma
 * consulta e outra, mesmo com o desempate por nome.
 */
export function ordenar(documentos: Documento[], criterio: Ordenacao): Documento[] {
  const copia = [...documentos];
  const porNome = (a: Documento, b: Documento) =>
    a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
  const porData = (a: Documento, b: Documento) =>
    Date.parse(a.dataModificacao) - Date.parse(b.dataModificacao);
  // O identificador desempata sempre no mesmo sentido, inclusive em Z–A: o que
  // se busca dele é uma ordem estável, não uma ordem com significado próprio.
  const porId = (a: Documento, b: Documento) => a.id.localeCompare(b.id);

  const desempatar = (
    a: Documento,
    b: Documento,
    diferenca: number,
    seguinte: (a: Documento, b: Documento) => number
  ) => (diferenca !== 0 ? diferenca : seguinte(a, b));

  const porNomeDesempatado = (a: Documento, b: Documento, inverso: boolean) =>
    desempatar(a, b, inverso ? porNome(b, a) : porNome(a, b), porId);

  const porDataDesempatada = (a: Documento, b: Documento, inverso: boolean) => {
    const diferenca = porData(a, b);
    return desempatar(a, b, inverso ? -diferenca : diferenca, (x, y) =>
      porNomeDesempatado(x, y, false)
    );
  };

  const porCriterio = (a: Documento, b: Documento): number => {
    switch (criterio) {
      case 'a-z':
        return porNomeDesempatado(a, b, false);
      case 'z-a':
        return porNomeDesempatado(a, b, true);
      case 'data-asc':
        return porDataDesempatada(a, b, false);
      case 'data-desc':
        return porDataDesempatada(a, b, true);
    }
  };

  // Um documento marcado `apenasConteudo` é a própria razão de ligar "Buscar
  // no conteúdo": sem precedência própria, ele se perde atrás de qualquer
  // termo que também bata no nome ou no autor de muitos documentos — com um
  // acervo grande, isso empurra o único resultado que o filtro deveria trazer
  // para páginas que ninguém abre, e a busca por conteúdo parece não fazer
  // nada. Dentro de cada grupo — só conteúdo, e o resto —, o critério
  // escolhido continua valendo normalmente.
  return copia.sort((a, b) => {
    const diferenca = Number(Boolean(b.apenasConteudo)) - Number(Boolean(a.apenasConteudo));
    return diferenca !== 0 ? diferenca : porCriterio(a, b);
  });
}
