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
 * Normaliza um texto para comparação de termo: sem acento e sem caixa.
 *
 * A mesma normalização vale para nome, autor e conteúdo — procurar "atas"
 * encontra "Atás", e procurar no conteúdo segue a mesma regra do nome.
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
 * Verdadeiro quando `termo` aparece em `texto` como uma palavra inteira.
 *
 * O nome e o autor casam por substring — procurar "ata" acha `ata-template.md`.
 * O **conteúdo**, não: um documento tem milhares de palavras, e "ata" como
 * substring casaria com "tratamento", "data" e "plataforma" em quase todo
 * arquivo. Aqui o termo precisa estar cercado por algo que não seja letra nem
 * dígito — início do texto, espaço, pontuação, quebra de linha. Ambos os
 * argumentos já vêm normalizados por `normalizar`.
 */
function contemPalavra(texto: string, termo: string): boolean {
  const ehLetraOuDigito = (caractere: string): boolean =>
    /[\p{L}\p{N}]/u.test(caractere);

  for (let de = texto.indexOf(termo); de !== -1; de = texto.indexOf(termo, de + 1)) {
    const antes = de === 0 ? '' : texto[de - 1]!;
    const fim = de + termo.length;
    const depois = fim >= texto.length ? '' : texto[fim]!;
    if (!ehLetraOuDigito(antes) && !ehLetraOuDigito(depois)) return true;
  }
  return false;
}

/**
 * Aplica os filtros de termo, extensão e período.
 *
 * O termo é comparado ao nome do arquivo, ao autor da última alteração e ao
 * texto já armazenado do documento (`textos`, indexado por id). A correspondência
 * é **aditiva**: o documento entra se o termo casar com qualquer um dos três. O
 * autor só está preenchido nos documentos que passaram por `detalhar`, e o
 * texto só existe para os documentos já ingeridos; os demais continuam
 * encontráveis pelo que houver.
 *
 * Um documento que casou **apenas** pelo conteúdo é devolvido com
 * `apenasConteudo: true`. O texto onde o termo ocorreu não acompanha o
 * resultado — nem aqui, nem em canal algum (ADR-0005).
 *
 * O período incide sobre a data real do documento. Documento cuja data ainda
 * for aproximada é descartado enquanto houver período em vigor: ver o comentário
 * na própria regra.
 *
 * O filtro de fonte não é aplicado aqui: ele decide quais fontes chegam a ser
 * consultadas, antes desta etapa.
 */
export function aplicarFiltros(
  documentos: Documento[],
  filtros: Filtros,
  textos?: ReadonlyMap<string, string>
): Documento[] {
  const termo = normalizar(filtros.termo.trim());
  const inicial = filtros.dataInicial ? Date.parse(filtros.dataInicial) : null;
  // A data final é inclusiva: o usuário informa um dia, não um instante.
  const final = filtros.dataFinal ? Date.parse(filtros.dataFinal) + 86_399_999 : null;

  const resultado: Documento[] = [];

  for (const documento of documentos) {
    if (filtros.extensoes.length > 0 && !filtros.extensoes.includes(documento.extensao)) {
      continue;
    }

    if (inicial !== null || final !== null) {
      // Data aproximada não serve a um recorte por data: ela é a do
      // repositório, igual para todos os arquivos dele. Presumir o documento
      // dentro do intervalo contradiz o filtro; presumi-lo fora seria
      // igualmente arbitrário — a diferença é que a omissão pode ser
      // comunicada ao usuário, e a inclusão indevida não. Quem resolve a data
      // antes desta etapa é `enriquecerParaBusca`; o que chega aqui ainda
      // marcado é o que ficou além do teto ou falhou.
      if (documento.dataAproximada) continue;

      const data = Date.parse(documento.dataModificacao);
      if (Number.isNaN(data)) continue;
      if (inicial !== null && data < inicial) continue;
      if (final !== null && data > final) continue;
    }

    if (!termo) {
      resultado.push(documento);
      continue;
    }

    // O termo casa com o nome do arquivo, com quem o alterou por último ou com
    // o texto guardado: procurar "gabi" encontra o que a Gabi escreveu, e
    // procurar "orçamento" encontra a ata que menciona o orçamento no corpo.
    //
    // Nome e autor casam por substring; o conteúdo, só como palavra inteira —
    // ver `contemPalavra`.
    const noNome = normalizar(documento.nome).includes(termo);
    const noAutor = normalizar(documento.autor ?? '').includes(termo);
    const noConteudo =
      textos !== undefined &&
      contemPalavra(normalizar(textos.get(documento.id) ?? ''), termo);

    if (!noNome && !noAutor && !noConteudo) continue;

    resultado.push(
      !noNome && !noAutor && noConteudo ? { ...documento, apenasConteudo: true } : documento
    );
  }

  return resultado;
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
