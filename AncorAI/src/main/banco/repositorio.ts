import { existsSync } from 'node:fs';
import { join } from 'node:path';
import Datastore from '@seald-io/nedb';
import type { Documento, DocumentoAcessado, Fonte } from '../../compartilhado/tipos';

/**
 * Persistência local NoSQL (ADR-0002).
 *
 * O modelo é orientado a documentos, o mesmo adotado na escolha original pelo
 * Firestore, de modo que as estruturas gravadas aqui têm o formato que teriam
 * na nuvem. Os campos `resumo` e `resumoEm` existem desde já para que a
 * inclusão futura dos resumos por IA não exija migração.
 *
 * O registro de acesso guarda apenas o link de redirecionamento. O **texto**
 * dos documentos vive em coleção separada, `conteudo_documentos`, autorizada
 * pela ADR-0005 — que derrubou a cláusula da ADR-0002 segundo a qual o
 * conteúdo nunca seria armazenado. Os bytes originais continuam não sendo
 * guardados em lugar algum.
 *
 * Todo o acesso ao banco está concentrado neste módulo: trocar o armazenamento
 * de documentos por outro deve afetar apenas este arquivo.
 */

interface RegistroAcesso {
  _id: string;
  nome: string;
  fonte: Fonte;
  link: string;
  acessadoEm: string;
  resumo?: string;
  resumoEm?: string;
}

interface RegistroCache {
  _id: string;
  etag: string | null;
  payload: unknown;
  atualizadoEm: string;
}

/**
 * Texto de um documento, e o resultado da tentativa de obtê-lo.
 *
 * `versaoConteudo` é o `sha` do blob no GitHub — hash do próprio conteúdo. É
 * ele, e não a data, que diz se este registro ainda vale (ADR-0005 e o desenho
 * da mudança `ingerir-conteudo-dos-documentos`).
 *
 * Os estados negativos são gravados de propósito: sem eles, um PDF digitalizado
 * sem camada de texto seria baixado e processado de novo a cada varredura, para
 * chegar sempre à mesma conclusão.
 */
export interface RegistroConteudo {
  _id: string;
  versaoConteudo: string;
  estado: 'extraido' | 'sem-texto' | 'excedente' | 'falha';
  /** Vazio quando o estado não é `extraido`. */
  texto: string;
  truncado: boolean;
  motivo?: string;
  extraidoEm: string;
  /**
   * Resumo por IA derivado deste texto, quando já gerado.
   *
   * Mora aqui, e não em coleção própria, porque envelhece pelo mesmo motivo e
   * no mesmo instante que o texto: o `versaoConteudo` mudou. No mesmo registro,
   * um único campo governa os dois, e é impossível ficarem em desacordo.
   *
   * Os campos reservados `resumo`/`resumoEm` em `documentos_acessados` não
   * serviriam: aquela coleção só registra documentos que o usuário abriu, e o
   * painel resume o primeiro resultado da busca, que quase nunca foi aberto.
   */
  resumo?: string;
  categoria?: string;
  assuntos?: string[];
  destaques?: string[];
  resumoEm?: string;
}

let acessos: Datastore<RegistroAcesso> | null = null;
let cache: Datastore<RegistroCache> | null = null;

/**
 * Coleção de conteúdo, aberta sob demanda e não na inicialização.
 *
 * O NeDB lê o arquivo inteiro para a memória ao abrir uma coleção. Esta é a
 * única que pode crescer para dezenas de megabytes, então carregá-la junto das
 * outras faria a abertura da aplicação e a listagem de acessados pagarem por
 * um dado que nenhuma das duas usa. Quem precisa do texto paga por ele.
 */
let conteudo: Datastore<RegistroConteudo> | null = null;
let carregandoConteudo: Promise<Datastore<RegistroConteudo>> | null = null;
let diretorioBanco: string | null = null;

export async function abrirBanco(diretorio: string): Promise<void> {
  diretorioBanco = diretorio;
  if (acessos && cache) return;

  acessos = new Datastore<RegistroAcesso>({
    filename: join(diretorio, 'documentos_acessados.db'),
    autoload: false
  });
  cache = new Datastore<RegistroCache>({
    filename: join(diretorio, 'cache_fontes.db'),
    autoload: false
  });

  await acessos.loadDatabaseAsync();
  await cache.loadDatabaseAsync();
  await acessos.ensureIndexAsync({ fieldName: 'acessadoEm' });

  await migrarCategoriaSeNecessario();
}

/**
 * Apaga o resumo — prosa, categoria (então chamada `tipo`), assuntos e
 * destaques — de todo registro de conteúdo que o tiver, para que cada
 * documento receba um resumo novo, já sob a lista fechada de categorias, na
 * próxima vez que aparecer como resultado ou for pedido.
 *
 * Exportada à parte de `migrarCategoriaSeNecessario` para que o teste exercite
 * a operação em si sem depender da marca de "já rodou" desta instalação.
 */
export async function apagarResumosExistentes(): Promise<void> {
  const colecao = await colecaoDeConteudo();
  await colecao.updateAsync(
    { resumo: { $exists: true } },
    {
      $unset: {
        resumo: true,
        categoria: true,
        assuntos: true,
        destaques: true,
        resumoEm: true
      }
    },
    { multi: true }
  );
}

/**
 * Roda `apagarResumosExistentes` no máximo uma vez por instalação (mudança
 * `categorizar-documentos-pelo-resumo`).
 *
 * A marca em `preferencias` é o que garante isso. Sem ela, toda abertura da
 * aplicação pagaria o custo de abrir `conteudo_documentos.db` — a coleção que
 * `colecaoDeConteudo` deliberadamente evita carregar de saída, por poder
 * crescer a dezenas de megabytes — só para descobrir, indefinidamente, que
 * não há mais nada a apagar.
 */
export async function migrarCategoriaSeNecessario(): Promise<void> {
  if (await lerPreferencia('migracaoCategoriaFeita')) return;

  // Sem o arquivo, `conteudo_documentos.db` nunca recebeu gravação alguma —
  // não há nada a apagar. Checar a existência antes de abrir a coleção
  // preserva a abertura sob demanda que `colecaoDeConteudo` garante: abri-la
  // aqui criaria o arquivo vazio numa instalação nova, que nunca teve nada
  // para migrar.
  if (diretorioBanco && existsSync(join(diretorioBanco, 'conteudo_documentos.db'))) {
    await apagarResumosExistentes();
  }

  await gravarPreferencia('migracaoCategoriaFeita', true);
}

export function fecharBanco(): void {
  acessos = null;
  cache = null;
  conteudo = null;
  carregandoConteudo = null;
  acervo = null;
  carregandoAcervo = null;
  preferencias = null;
  diretorioBanco = null;
}

function exigir<T>(colecao: Datastore<T> | null): Datastore<T> {
  if (!colecao) throw new Error('Banco de dados não foi inicializado.');
  return colecao;
}

/** Registra o acesso a um documento, guardando apenas o link (RF20). */
export async function registrarAcesso(documento: Documento): Promise<void> {
  await exigir(acessos).updateAsync(
    { _id: documento.id },
    {
      $set: {
        nome: documento.nome,
        fonte: documento.fonte,
        link: documento.link,
        acessadoEm: new Date().toISOString()
      }
    },
    { upsert: true }
  );
}

export async function listarAcessados(limite = 20): Promise<DocumentoAcessado[]> {
  const registros = await exigir(acessos)
    .findAsync({})
    .sort({ acessadoEm: -1 })
    .limit(limite);

  return registros.map((registro) => ({
    id: registro._id,
    nome: registro.nome,
    fonte: registro.fonte,
    link: registro.link,
    acessadoEm: registro.acessadoEm
  }));
}

/**
 * Abre a coleção de conteúdo na primeira vez que alguém precisa dela.
 *
 * Ver a nota na declaração de `conteudo`: adiar esta abertura é o que mantém a
 * inicialização barata quando a coleção cresce.
 *
 * A promessa de carregamento — e não só o resultado — fica guardada em
 * `carregandoConteudo` enquanto está em andamento: sem isso, duas chamadas
 * concorrentes antes da primeira terminar veriam `conteudo` ainda nulo e cada
 * uma abriria seu próprio `Datastore` sobre o mesmo arquivo. O NeDB não tolera
 * dois `Datastore` carregando e persistindo o mesmo arquivo ao mesmo tempo — a
 * segunda instância a renomear seu `.db~` temporário encontra o arquivo que a
 * primeira já consumiu, e falha com ENOENT.
 */
async function colecaoDeConteudo(): Promise<Datastore<RegistroConteudo>> {
  if (conteudo) return conteudo;
  if (carregandoConteudo) return carregandoConteudo;
  if (!diretorioBanco) throw new Error('Banco de dados não foi inicializado.');

  carregandoConteudo = (async () => {
    const nova = new Datastore<RegistroConteudo>({
      filename: join(diretorioBanco!, 'conteudo_documentos.db'),
      autoload: false
    });
    await nova.loadDatabaseAsync();
    conteudo = nova;
    return nova;
  })();

  try {
    return await carregandoConteudo;
  } finally {
    carregandoConteudo = null;
  }
}

/** Verdadeiro quando a coleção de conteúdo já foi carregada em memória. */
export function conteudoCarregado(): boolean {
  return conteudo !== null;
}

/** Texto e estado gravados para um documento, ou `null` se nunca ingerido. */
export async function lerConteudo(id: string): Promise<RegistroConteudo | null> {
  const colecao = await colecaoDeConteudo();
  return colecao.findOneAsync({ _id: id });
}

/**
 * Grava o resultado de uma ingestão.
 *
 * Recebe texto, nunca bytes: os originais do arquivo não são persistidos em
 * ponto algum (ADR-0005).
 */
export async function gravarConteudo(
  registro: Omit<RegistroConteudo, 'extraidoEm'>
): Promise<void> {
  const colecao = await colecaoDeConteudo();
  const { _id, ...campos } = registro;
  const anterior = await colecao.findOneAsync({ _id });

  // O resumo é derivado do texto. Trocado o texto, o resumo antigo passa a
  // descrever outra coisa — e `$set` não apagaria os campos sozinho, porque só
  // toca os que nomeia. Sem esta limpeza o defeito seria silencioso: um resumo
  // plausível ao lado de um documento que já não é o mesmo.
  const resumoObsoleto =
    anterior !== null && anterior.versaoConteudo !== registro.versaoConteudo;

  await colecao.updateAsync(
    { _id },
    {
      $set: { ...campos, extraidoEm: new Date().toISOString() },
      ...(resumoObsoleto
        ? {
            $unset: {
              resumo: true,
              categoria: true,
              assuntos: true,
              destaques: true,
              resumoEm: true
            }
          }
        : {})
    },
    { upsert: true }
  );
}

/**
 * Grava o resumo produzido pela LLM junto do texto que o originou, e espelha
 * a categoria no registro do acervo (mudança
 * `categorizar-documentos-pelo-resumo`) — sempre, mesmo vazia: uma categoria
 * vazia gravada contra a versão vigente diz "já resumido, sem categoria
 * confiável", distinto de "ainda não resumido".
 */
export async function gravarResumo(
  id: string,
  dados: { resumo: string; categoria: string; assuntos: string[]; destaques: string[] },
  versaoConteudo: string
): Promise<void> {
  const colecao = await colecaoDeConteudo();
  await colecao.updateAsync(
    { _id: id },
    { $set: { ...dados, resumoEm: new Date().toISOString() } }
  );

  await gravarCategoriaAcervo(id, {
    categoria: dados.categoria,
    categoriaVersaoConteudo: versaoConteudo
  });
}

/** Identificadores de todos os documentos com conteúdo gravado. */
export async function idsComConteudo(): Promise<string[]> {
  const colecao = await colecaoDeConteudo();
  const registros = await colecao.findAsync({}).projection({ _id: 1 });
  return registros.map((registro) => registro._id);
}

/**
 * O que a busca por conteúdo precisa saber do acervo já ingerido.
 *
 * - `textos`: o texto extraído, por documento — só os registros em estado
 *   `extraido`, que são os únicos com o que casar.
 * - `versoes`: o `versaoConteudo` de **todo** registro, qualquer que seja o
 *   estado. Serve para aferir cobertura: um documento do inventário sem entrada
 *   aqui, ou com `versaoConteudo` diferente, ainda não foi alcançado pela
 *   sincronização.
 *
 * O texto não sai daqui por canal algum (ADR-0005): alimenta o casamento de
 * termo em `busca/regras.ts`, no processo principal, e nada mais.
 */
export async function conteudoParaBusca(): Promise<{
  textos: Map<string, string>;
  versoes: Map<string, string>;
}> {
  const colecao = await colecaoDeConteudo();
  const registros = await colecao.findAsync({});

  const textos = new Map<string, string>();
  const versoes = new Map<string, string>();
  for (const registro of registros) {
    versoes.set(registro._id, registro.versaoConteudo);
    if (registro.estado === 'extraido') textos.set(registro._id, registro.texto);
  }
  return { textos, versoes };
}

/** Total de caracteres de texto armazenados, para o teto do acervo. */
export async function totalDeCaracteres(): Promise<number> {
  const colecao = await colecaoDeConteudo();
  const registros = await colecao.findAsync({ estado: 'extraido' });
  return registros.reduce((soma, registro) => soma + registro.texto.length, 0);
}

/**
 * Descarta o conteúdo de documentos que saíram do inventário.
 *
 * Sem isto, o texto de um arquivo apagado no repositório sobreviveria
 * indefinidamente no disco de quem já o tinha ingerido.
 */
export async function descartarConteudoAusente(idsVigentes: string[]): Promise<number> {
  const colecao = await colecaoDeConteudo();
  return colecao.removeAsync({ _id: { $nin: idsVigentes } }, { multi: true });
}

/**
 * Snapshot local do inventário, gravado pela sincronização.
 *
 * A busca com termo ou período é servida daqui, em vez de consultar a fonte um
 * documento por vez a cada consulta (design da mudança
 * `sincronizar-acervo-e-buscar-por-conteudo`, decisão 8). Guarda os metadados de
 * cada documento do inventário e, quando já resolvida, a autoria e a data real
 * da última alteração.
 *
 * Aberta sob demanda como `conteudo_documentos`, mas por outro motivo: esta é
 * pequena — metadados, não texto —, e o adiamento serve só para não pesar a
 * inicialização de quem nunca sincronizou. Depois da primeira leitura fica em
 * memória, então a busca não relê o arquivo a cada consulta.
 */
interface RegistroAcervo {
  _id: string;
  nome: string;
  extensao: string;
  fonte: Fonte;
  link: string;
  /** Data do inventário (o `pushed_at` do repositório) até a autoria ser resolvida. */
  dataModificacao: string;
  dataAproximada?: boolean | null;
  caminho?: string | null;
  repositorio?: string | null;
  versaoConteudo?: string | null;
  tamanho?: number | null;
  /** Autor do último commit que tocou o arquivo, quando a fonte o informou. */
  autor?: string | null;
  /** Data real da última alteração, quando resolvida. */
  dataReal?: string | null;
  /**
   * O `versaoConteudo` para o qual a autoria já foi resolvida. Difere do
   * `versaoConteudo` atual quando o arquivo mudou na fonte desde então, e a
   * autoria precisa ser resolvida de novo — a mesma lógica de vigência que o
   * texto usa pelo `sha` do blob. Ausente enquanto a varredura não conseguiu a
   * autoria, caso em que a próxima varredura tenta de novo.
   */
  versaoAutoria?: string | null;
  /**
   * Categoria do documento (mudança `categorizar-documentos-pelo-resumo`),
   * espelhada aqui a partir do resumo por IA (`RegistroConteudo.categoria`)
   * sempre que ele é (re)gerado — é este registro, e não o do resumo, que a
   * busca consulta para o filtro por categoria.
   */
  categoria?: string | null;
  /**
   * O `versaoConteudo` para o qual `categoria` foi espelhada. Ausente ou
   * diferente da versão vigente significa que o documento ainda não foi
   * resumido nesta versão — mesma lógica de vigência que `versaoAutoria` usa
   * para a autoria.
   */
  categoriaVersaoConteudo?: string | null;
  sincronizadoEm: string;
}

let acervo: Datastore<RegistroAcervo> | null = null;
let carregandoAcervo: Promise<Datastore<RegistroAcervo>> | null = null;

/**
 * A promessa de carregamento — e não só o resultado — fica guardada em
 * `carregandoAcervo` enquanto está em andamento: ver a mesma nota em
 * `colecaoDeConteudo`. Duas chamadas concorrentes ao mount da tela — a busca
 * de recentes e o dropdown de categoria disparam cada uma a sua, ambas no
 * primeiro instante da aplicação — bastam para expor a corrida sem isto.
 */
async function colecaoDeAcervo(): Promise<Datastore<RegistroAcervo>> {
  if (acervo) return acervo;
  if (carregandoAcervo) return carregandoAcervo;
  if (!diretorioBanco) throw new Error('Banco de dados não foi inicializado.');

  carregandoAcervo = (async () => {
    const nova = new Datastore<RegistroAcervo>({
      filename: join(diretorioBanco!, 'acervo_documentos.db'),
      autoload: false
    });
    await nova.loadDatabaseAsync();
    acervo = nova;
    return nova;
  })();

  try {
    return await carregandoAcervo;
  } finally {
    carregandoAcervo = null;
  }
}

/**
 * Verdadeiro quando a varredura já resolveu a autoria para a versão vigente do
 * arquivo.
 *
 * Uma resolução malsucedida não grava `versaoAutoria`: o documento continua
 * pendente e a varredura seguinte tenta de novo.
 */
function autoriaVigente(registro: RegistroAcervo): boolean {
  if (!registro.versaoAutoria) return false;
  // Sem identidade de conteúdo não há como reverificar — o gravado é o melhor
  // que há, como em `estaVigente` para o texto.
  if (!registro.versaoConteudo) return true;
  return registro.versaoAutoria === registro.versaoConteudo;
}

/** Mesma lógica de vigência de `autoriaVigente`, para a categoria espelhada. */
function categoriaVigente(registro: RegistroAcervo): boolean {
  if (!registro.categoriaVersaoConteudo) return false;
  if (!registro.versaoConteudo) return true;
  return registro.categoriaVersaoConteudo === registro.versaoConteudo;
}

/** Recompõe o `Documento` a partir do registro do snapshot. */
function reconstruirDocumento(registro: RegistroAcervo): Documento {
  const documento: Documento = {
    id: registro._id,
    nome: registro.nome,
    extensao: registro.extensao,
    fonte: registro.fonte,
    link: registro.link,
    dataModificacao: registro.dataModificacao
  };

  if (registro.caminho) documento.caminho = registro.caminho;
  if (registro.repositorio) documento.repositorio = registro.repositorio;
  if (registro.versaoConteudo) documento.versaoConteudo = registro.versaoConteudo;
  if (typeof registro.tamanho === 'number') documento.tamanho = registro.tamanho;

  if (autoriaVigente(registro) && registro.autor) {
    // Autoria resolvida: a data real substitui a aproximada, e a marca sai — o
    // filtro de período passa a poder recortar este documento.
    documento.autor = registro.autor;
    if (registro.dataReal) documento.dataModificacao = registro.dataReal;
  } else if (registro.dataAproximada) {
    documento.dataAproximada = true;
  }

  if (categoriaVigente(registro) && registro.categoria) {
    documento.categoria = registro.categoria;
  }

  return documento;
}

/**
 * Grava o snapshot do inventário: um registro por documento, e a remoção dos
 * que saíram.
 *
 * Toca apenas os campos do inventário — `autor`, `dataReal` e `versaoAutoria`
 * são de `gravarAutoria` e não são apagados aqui, para que a autoria já
 * resolvida sobreviva a uma nova varredura do inventário.
 */
export async function sincronizarInventario(documentos: Documento[]): Promise<void> {
  const colecao = await colecaoDeAcervo();

  for (const documento of documentos) {
    await colecao.updateAsync(
      { _id: documento.id },
      {
        $set: {
          nome: documento.nome,
          extensao: documento.extensao,
          fonte: documento.fonte,
          link: documento.link,
          dataModificacao: documento.dataModificacao,
          dataAproximada: documento.dataAproximada ?? false,
          caminho: documento.caminho ?? null,
          repositorio: documento.repositorio ?? null,
          versaoConteudo: documento.versaoConteudo ?? null,
          tamanho: documento.tamanho ?? null,
          sincronizadoEm: new Date().toISOString()
        }
      },
      { upsert: true }
    );
  }

  await colecao.removeAsync(
    { _id: { $nin: documentos.map((documento) => documento.id) } },
    { multi: true }
  );
}

/**
 * Grava a autoria resolvida de um documento do snapshot.
 *
 * Sem `upsert`: a passagem do inventário (`sincronizarInventario`) já criou o
 * registro. `versaoAutoria` fixa contra qual versão do arquivo esta autoria
 * vale, para que a varredura seguinte só a refaça se o `sha` do blob mudou.
 */
export async function gravarAutoria(
  id: string,
  autoria: { autor: string; dataModificacao: string; versaoAutoria: string | null }
): Promise<void> {
  const colecao = await colecaoDeAcervo();
  await colecao.updateAsync(
    { _id: id },
    {
      $set: {
        autor: autoria.autor,
        dataReal: autoria.dataModificacao,
        versaoAutoria: autoria.versaoAutoria
      }
    }
  );
}

/**
 * Espelha a categoria do resumo por IA no registro do acervo (mudança
 * `categorizar-documentos-pelo-resumo`) — é este registro, não o do resumo,
 * que a busca consulta para o filtro por categoria.
 */
export async function gravarCategoriaAcervo(
  id: string,
  categoria: { categoria: string; categoriaVersaoConteudo: string }
): Promise<void> {
  const colecao = await colecaoDeAcervo();
  await colecao.updateAsync(
    { _id: id },
    {
      $set: {
        categoria: categoria.categoria,
        categoriaVersaoConteudo: categoria.categoriaVersaoConteudo
      }
    }
  );
}

/**
 * Categorias já atribuídas a algum documento do acervo, sem repetição, em
 * ordem alfabética — para popular o dropdown do filtro por categoria.
 *
 * Só conta categorias vigentes (mesma lógica de `categoriaVigente`): uma
 * categoria desatualizada não viraria opção alcançável no filtro, porque
 * `reconstruirDocumento` já a esconde de `Documento.categoria`.
 */
export async function categoriasDisponiveis(): Promise<string[]> {
  const colecao = await colecaoDeAcervo();
  const registros = await colecao
    .findAsync({ categoria: { $exists: true, $ne: '' } })
    .projection({ categoria: 1, categoriaVersaoConteudo: 1, versaoConteudo: 1 });

  const categorias = new Set<string>();
  for (const registro of registros) {
    if (categoriaVigente(registro as RegistroAcervo) && registro.categoria) {
      categorias.add(registro.categoria);
    }
  }
  return [...categorias].sort((a, b) => a.localeCompare(b));
}

/**
 * Categoria vigente já conhecida no acervo para os documentos informados,
 * indexada por id.
 *
 * Serve para completar a janela de recentes (`categorizar-documentos-pelo-
 * resumo`): ela vem direto do GitHub, sem passar por `reconstruirDocumento`,
 * e por isso nunca carrega a categoria — mesmo quando o acervo local já a
 * conhece, por um resumo gerado antes.
 */
export async function categoriasDeDocumentos(
  ids: readonly string[]
): Promise<ReadonlyMap<string, string>> {
  const mapa = new Map<string, string>();
  if (ids.length === 0) return mapa;

  const colecao = await colecaoDeAcervo();
  const registros = await colecao
    .findAsync({ _id: { $in: [...ids] }, categoria: { $exists: true, $ne: '' } })
    .projection({ categoria: 1, categoriaVersaoConteudo: 1, versaoConteudo: 1 });

  for (const registro of registros) {
    if (categoriaVigente(registro as RegistroAcervo) && registro.categoria) {
      mapa.set(registro._id, registro.categoria);
    }
  }
  return mapa;
}

/**
 * O inventário do snapshot local, cada documento já com autoria e data real
 * quando resolvidas.
 *
 * Devolve `[]` quando a coleção nunca foi preenchida — nenhuma sincronização
 * desde a instalação. Nesse caso a busca cai na consulta ao vivo à fonte.
 */
export async function inventarioSincronizado(): Promise<Documento[]> {
  const colecao = await colecaoDeAcervo();
  const registros = await colecao.findAsync({});
  return registros.map(reconstruirDocumento);
}

/** Ids do snapshot cuja autoria a varredura ainda precisa resolver ou refazer. */
export async function idsComAutoriaPendente(): Promise<string[]> {
  const colecao = await colecaoDeAcervo();
  const registros = await colecao.findAsync({});
  return registros
    .filter((registro) => !autoriaVigente(registro))
    .map((registro) => registro._id);
}

/** Quantos documentos do snapshot ainda estão sem autoria resolvida. */
export async function documentosSemAutoria(): Promise<number> {
  return (await idsComAutoriaPendente()).length;
}

/** Quantos documentos há no snapshot do inventário. Zero quando nunca sincronizado. */
export async function totalNoInventario(): Promise<number> {
  const colecao = await colecaoDeAcervo();
  return (await colecao.findAsync({})).length;
}

/**
 * Um documento do acervo já classificado pela IA, com seus rótulos.
 *
 * `nome` e `link` vêm do snapshot do inventário; `categoria` e `assuntos`, do
 * registro de conteúdo. O texto de onde os rótulos saíram **não** acompanha
 * (ADR-0005) — esta função alimenta a pilha de relacionados, no processo
 * principal, e o que ela devolve pode chegar ao renderer.
 */
export interface DocumentoClassificado {
  id: string;
  nome: string;
  fonte: Fonte;
  link: string;
  categoria: string;
  assuntos: string[];
}

/**
 * Documentos que já passaram pela classificação por IA (têm `resumoEm`) e estão
 * no snapshot do inventário.
 *
 * Um documento classificado mas ausente do snapshot fica de fora: sem o registro
 * do inventário não há nome nem link para apresentá-lo na pilha.
 */
export async function documentosClassificados(): Promise<DocumentoClassificado[]> {
  const conteudoColecao = await colecaoDeConteudo();
  const acervoColecao = await colecaoDeAcervo();

  const registrosAcervo = await acervoColecao.findAsync({});
  const noInventario = new Map(registrosAcervo.map((registro) => [registro._id, registro]));

  const saida: DocumentoClassificado[] = [];
  for (const conteudo of await conteudoColecao.findAsync({})) {
    if (!conteudo.resumoEm) continue;
    const inventario = noInventario.get(conteudo._id);
    if (!inventario) continue;
    saida.push({
      id: conteudo._id,
      nome: inventario.nome,
      fonte: inventario.fonte,
      link: inventario.link,
      categoria: conteudo.categoria ?? '',
      assuntos: conteudo.assuntos ?? []
    });
  }
  return saida;
}

/**
 * Preferências do usuário nesta instalação.
 *
 * Coleção própria, e não o cofre: o cofre é para segredos, e um consentimento
 * não é segredo — é uma decisão que precisa ser lembrada. Também não cabe em
 * `cache_fontes`, que tem semântica de cache e vida curta; uma preferência
 * apagada por limpeza de cache voltaria a perguntar o que já foi respondido.
 */
interface RegistroPreferencia {
  _id: string;
  /**
   * `boolean` para os liga/desliga (consentimento da LLM, busca por voz ativa);
   * `string` para escolhas com valor textual, como o `deviceId` do microfone.
   */
  valor: boolean | string;
  definidoEm: string;
}

let preferencias: Datastore<RegistroPreferencia> | null = null;

async function colecaoDePreferencias(): Promise<Datastore<RegistroPreferencia>> {
  if (preferencias) return preferencias;
  if (!diretorioBanco) throw new Error('Banco de dados não foi inicializado.');

  const nova = new Datastore<RegistroPreferencia>({
    filename: join(diretorioBanco, 'preferencias.db'),
    autoload: false
  });
  await nova.loadDatabaseAsync();
  preferencias = nova;
  return nova;
}

export async function lerPreferencia(chave: string): Promise<boolean | null> {
  const colecao = await colecaoDePreferencias();
  const registro = await colecao.findOneAsync({ _id: chave });
  return registro && typeof registro.valor === 'boolean' ? registro.valor : null;
}

export async function gravarPreferencia(chave: string, valor: boolean): Promise<void> {
  const colecao = await colecaoDePreferencias();
  await colecao.updateAsync(
    { _id: chave },
    { $set: { valor, definidoEm: new Date().toISOString() } },
    { upsert: true }
  );
}

/**
 * Preferência com valor textual, na mesma coleção das de liga/desliga.
 *
 * Usada pela escolha de microfone da busca por voz: o `deviceId` precisa ser
 * lembrado entre execuções, não é segredo, e não caberia como `boolean`.
 */
export async function lerPreferenciaTexto(chave: string): Promise<string | null> {
  const colecao = await colecaoDePreferencias();
  const registro = await colecao.findOneAsync({ _id: chave });
  return registro && typeof registro.valor === 'string' ? registro.valor : null;
}

export async function gravarPreferenciaTexto(chave: string, valor: string): Promise<void> {
  const colecao = await colecaoDePreferencias();
  await colecao.updateAsync(
    { _id: chave },
    { $set: { valor, definidoEm: new Date().toISOString() } },
    { upsert: true }
  );
}

export interface EntradaCache<T> {
  etag: string | null;
  payload: T;
  atualizadoEm: string;
}

export async function lerCache<T>(chave: string): Promise<EntradaCache<T> | null> {
  const registro = await exigir(cache).findOneAsync({ _id: chave });
  if (!registro) return null;
  return {
    etag: registro.etag,
    payload: registro.payload as T,
    atualizadoEm: registro.atualizadoEm
  };
}

export async function gravarCache(
  chave: string,
  payload: unknown,
  etag: string | null
): Promise<void> {
  await exigir(cache).updateAsync(
    { _id: chave },
    { $set: { etag, payload, atualizadoEm: new Date().toISOString() } },
    { upsert: true }
  );
}
