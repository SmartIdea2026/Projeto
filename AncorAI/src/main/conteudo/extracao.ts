import { limitarTexto } from './limites';

/**
 * Extração do texto dos documentos, por formato.
 *
 * Três resultados possíveis, e a distinção entre eles importa: `extraido` é o
 * caso feliz; `sem-texto` é um documento cujo formato não se lê ou que não tem
 * texto algum — situação normal, que não vira erro para o usuário; `falha` é
 * um problema real ao processar um formato que deveria funcionar.
 *
 * Só `falha` justifica tentar de novo. `sem-texto` é uma resposta definitiva
 * enquanto o documento não mudar na fonte, e repetir a tentativa gastaria
 * download e processamento para chegar à mesma conclusão.
 *
 * Nenhuma biblioteca aqui exige compilação nativa para funcionar — a mesma
 * disciplina que levou o projeto a escolher NeDB em vez de SQLite (ADR-0002).
 *
 * Com uma ressalva que só apareceu ao empacotar: o `pdfjs-dist` declara
 * `@napi-rs/canvas` como dependência **opcional**, e o npm a instala por
 * padrão — cerca de 62 MB de binários do Skia, usados apenas para renderizar
 * páginas em canvas. A extração de texto não os toca, e o `electron-builder.yml`
 * os exclui do pacote. Se alguém remover essa exclusão, o pacote volta a
 * carregar código nativo que a aplicação nunca chama.
 */

export type EstadoExtracao = 'extraido' | 'sem-texto' | 'falha';

export interface ResultadoExtracao {
  estado: EstadoExtracao;
  /** Vazio quando o estado não é `extraido`. */
  texto: string;
  /** Verdadeiro quando o texto foi cortado no limite por documento. */
  truncado: boolean;
  /** Por que não há texto, quando não há. */
  motivo?: string;
}

/**
 * Formatos aceitos pela busca que esta versão não lê, com o porquê de cada um.
 *
 * `xls` e `xlsx` ficam de fora por decisão de segurança, não por dificuldade
 * técnica: o pacote `xlsx` publicado no npm parou na 0.18.5, anterior à
 * correção do CVE-2023-30533, porque a SheetJS mudou a distribuição para o
 * registro próprio. Trazer uma build parada com aviso de segurança conhecido
 * para dentro do processo que guarda o token do GitHub não compensa pelo texto
 * de uma planilha, que é o menos aproveitável dos formatos aceitos.
 *
 * `doc` fica de fora por não haver extrator mantido em JavaScript puro para o
 * formato binário do Word 97.
 */
const SEM_EXTRATOR: Record<string, string> = {
  xls: 'Planilhas não são lidas nesta versão.',
  xlsx: 'Planilhas não são lidas nesta versão.',
  doc: 'O formato .doc antigo não é lido; .docx é.'
};

function semTexto(motivo: string): ResultadoExtracao {
  return { estado: 'sem-texto', texto: '', truncado: false, motivo };
}

/**
 * Fecha o resultado de uma extração bem-sucedida.
 *
 * Texto em branco não é falha: um PDF digitalizado sem camada de texto é um
 * documento legítimo do qual não há o que extrair.
 */
function concluir(bruto: string): ResultadoExtracao {
  const limpo = bruto.replace(/\s+/g, ' ').trim();
  if (limpo.length === 0) {
    return semTexto('O documento não contém texto extraível.');
  }
  const { texto, truncado } = limitarTexto(limpo);
  return { estado: 'extraido', texto, truncado };
}

function decodificar(bytes: ArrayBuffer): string {
  return new TextDecoder('utf-8').decode(bytes);
}

async function extrairDePdf(bytes: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  // `verbosity: 0` cala o aviso sobre dados de fonte padrão. Ele importa para
  // renderizar a página; aqui só se quer o texto, e a fonte não muda o texto.
  // A tarefa de carregamento é guardada porque é ela que possui `destroy` —
  // o documento em si não. Sem liberar a tarefa, o worker do pdf.js fica de pé
  // depois que a extração terminou.
  const tarefa = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    verbosity: 0
  });
  const documento = await tarefa.promise;

  const partes: string[] = [];
  for (let numero = 1; numero <= documento.numPages; numero += 1) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();
    partes.push(
      conteudo.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
    );
  }

  await tarefa.destroy();
  return partes.join('\n');
}

async function extrairDeDocx(bytes: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  return value;
}

/** Remove marcação e o que não é texto de leitura de um XHTML. */
function textoDeXhtml(marcacao: string): string {
  return marcacao
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

async function extrairDeEpub(bytes: ArrayBuffer): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const pacote = await JSZip.loadAsync(bytes);

  // Um EPUB é um zip de XHTML. A ordem de leitura correta viria do `spine` do
  // arquivo OPF; para extrair texto, a ordem dos nomes basta e evita mais um
  // analisador de XML só para ordenar capítulos.
  const capitulos = Object.keys(pacote.files)
    .filter((nome) => /\.x?html?$/i.test(nome))
    .sort();

  const partes: string[] = [];
  for (const nome of capitulos) {
    const arquivo = pacote.file(nome);
    if (arquivo) partes.push(textoDeXhtml(await arquivo.async('string')));
  }

  return partes.join('\n');
}

/**
 * Texto de um documento, a partir de seus bytes e da extensão.
 *
 * Nunca lança: um documento que não se deixa ler é um resultado, não um erro.
 * Quem chama grava o resultado e segue — a busca por nome não depende disto.
 */
export async function extrairTexto(
  bytes: ArrayBuffer,
  extensao: string
): Promise<ResultadoExtracao> {
  const formato = extensao.toLowerCase();

  const semExtrator = SEM_EXTRATOR[formato];
  if (semExtrator) return semTexto(semExtrator);

  try {
    switch (formato) {
      case 'md':
      case 'txt':
        return concluir(decodificar(bytes));
      case 'pdf':
        return concluir(await extrairDePdf(bytes));
      case 'docx':
        return concluir(await extrairDeDocx(bytes));
      case 'epub':
        return concluir(await extrairDeEpub(bytes));
      default:
        return semTexto(`Não há leitor para arquivos .${formato}.`);
    }
  } catch (erro) {
    return {
      estado: 'falha',
      texto: '',
      truncado: false,
      motivo: erro instanceof Error ? erro.message : 'Falha ao ler o documento.'
    };
  }
}
