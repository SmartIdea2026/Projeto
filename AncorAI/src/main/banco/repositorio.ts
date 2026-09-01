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
  tipo?: string;
  assuntos?: string[];
  destaques?: string[];
  resumoEm?: string;
}

/**
 * Registro do índice local de documentos (`indice-local`).
 *
 * Guarda metadados e a classificação por IA (assunto, tipo, etiquetas), nunca
 * o texto — que continua vivendo só em `conteudo_documentos`. A classificação
 * envelhece pela mesma identidade de conteúdo que invalida o texto e o resumo:
 * `versaoConteudo` mudou, a classificação anterior já não descreve o documento
 * atual. Documentos sem identidade de conteúdo (os que vêm dos commits) não
 * são invalidados por esta via — sem uma versão para comparar, afirmar
 * desatualização seria afirmar algo que o sistema não sabe.
 */
export interface RegistroIndice {
  _id: string;
  nome: string;
  caminho?: string;
  fonte: Fonte;
  link: string;
  versaoConteudo?: string;
  atualizadoEm: string;
  tipo?: string;
  assuntos?: string[];
  etiquetas?: string[];
  classificadoEm?: string;
}

let acessos: Datastore<RegistroAcesso> | null = null;
let cache: Datastore<RegistroCache> | null = null;
let indice: Datastore<RegistroIndice> | null = null;

/**
 * Coleção de conteúdo, aberta sob demanda e não na inicialização.
 *
 * O NeDB lê o arquivo inteiro para a memória ao abrir uma coleção. Esta é a
 * única que pode crescer para dezenas de megabytes, então carregá-la junto das
 * outras faria a abertura da aplicação e a listagem de acessados pagarem por
 * um dado que nenhuma das duas usa. Quem precisa do texto paga por ele.
 */
let conteudo: Datastore<RegistroConteudo> | null = null;
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
}

export function fecharBanco(): void {
  acessos = null;
  cache = null;
  conteudo = null;
  preferencias = null;
  indice = null;
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
 */
async function colecaoDeConteudo(): Promise<Datastore<RegistroConteudo>> {
  if (conteudo) return conteudo;
  if (!diretorioBanco) throw new Error('Banco de dados não foi inicializado.');

  const nova = new Datastore<RegistroConteudo>({
    filename: join(diretorioBanco, 'conteudo_documentos.db'),
    autoload: false
  });
  await nova.loadDatabaseAsync();
  conteudo = nova;
  return nova;
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
        ? { $unset: { resumo: true, tipo: true, assuntos: true, destaques: true, resumoEm: true } }
        : {})
    },
    { upsert: true }
  );
}

/** Grava o resumo produzido pela LLM junto do texto que o originou. */
export async function gravarResumo(
  id: string,
  dados: { resumo: string; tipo: string; assuntos: string[]; destaques: string[] }
): Promise<void> {
  const colecao = await colecaoDeConteudo();
  await colecao.updateAsync(
    { _id: id },
    { $set: { ...dados, resumoEm: new Date().toISOString() } }
  );
}

/** Identificadores de todos os documentos com conteúdo gravado. */
export async function idsComConteudo(): Promise<string[]> {
  const colecao = await colecaoDeConteudo();
  const registros = await colecao.findAsync({}).projection({ _id: 1 });
  return registros.map((registro) => registro._id);
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
 * Abre a coleção de índice na primeira vez que alguém precisa dela.
 *
 * Mesma disciplina de `colecaoDeConteudo`: aberta sob demanda, para que ligar
 * a aplicação e listar acessados não paguem por uma coleção que nenhuma das
 * duas usa.
 */
async function colecaoDeIndice(): Promise<Datastore<RegistroIndice>> {
  if (indice) return indice;
  if (!diretorioBanco) throw new Error('Banco de dados não foi inicializado.');

  const nova = new Datastore<RegistroIndice>({
    filename: join(diretorioBanco, 'indice_documentos.db'),
    autoload: false
  });
  await nova.loadDatabaseAsync();
  indice = nova;
  return nova;
}

/** Registro do índice para um documento, ou `null` se ainda não indexado. */
export async function lerIndice(id: string): Promise<RegistroIndice | null> {
  const colecao = await colecaoDeIndice();
  return colecao.findOneAsync({ _id: id });
}

/**
 * Registra ou atualiza no índice os metadados de documentos obtidos das
 * fontes, sem gravar texto algum.
 *
 * Quando a identidade de conteúdo (`versaoConteudo`) de um documento já
 * indexado muda, a classificação anterior é assinalada como desatualizada —
 * mesma disciplina de `gravarConteudo` para o resumo: `$set` só toca os
 * campos que nomeia, então sem esta limpeza uma classificação antiga
 * sobreviveria ao lado de um documento que já não é o mesmo. Um documento sem
 * identidade de conteúdo disponível não é invalidado por esta via.
 */
export async function registrarNoIndice(documentos: Documento[]): Promise<void> {
  const colecao = await colecaoDeIndice();

  for (const documento of documentos) {
    const anterior = await colecao.findOneAsync({ _id: documento.id });
    const classificacaoObsoleta =
      anterior !== null &&
      Boolean(anterior.versaoConteudo) &&
      Boolean(documento.versaoConteudo) &&
      anterior.versaoConteudo !== documento.versaoConteudo;

    await colecao.updateAsync(
      { _id: documento.id },
      {
        $set: {
          nome: documento.nome,
          ...(documento.caminho ? { caminho: documento.caminho } : {}),
          fonte: documento.fonte,
          link: documento.link,
          ...(documento.versaoConteudo ? { versaoConteudo: documento.versaoConteudo } : {}),
          atualizadoEm: new Date().toISOString()
        },
        ...(classificacaoObsoleta
          ? { $unset: { tipo: true, assuntos: true, etiquetas: true, classificadoEm: true } }
          : {})
      },
      { upsert: true }
    );
  }
}

/** Grava a classificação por IA produzida para um documento já indexado. */
export async function gravarClassificacao(
  id: string,
  dados: { tipo: string; assuntos: string[]; etiquetas: string[] }
): Promise<void> {
  const colecao = await colecaoDeIndice();
  await colecao.updateAsync(
    { _id: id },
    { $set: { ...dados, classificadoEm: new Date().toISOString() } }
  );
}

/** Documentos indexados que ainda não têm classificação vigente. */
export async function idsSemClassificacao(): Promise<string[]> {
  const colecao = await colecaoDeIndice();
  const registros = await colecao
    .findAsync({ classificadoEm: { $exists: false } })
    .projection({ _id: 1 });
  return registros.map((registro) => registro._id);
}

/**
 * Classificação vigente dos documentos informados, indexada por id.
 *
 * Usada para enriquecer resultados de busca já obtidos das fontes com
 * assunto, tipo e etiquetas — sem requisição alguma às APIs, e sem devolver
 * registros que ainda não têm classificação.
 */
export async function lerClassificacoes(
  ids: string[]
): Promise<Map<string, RegistroIndice>> {
  const colecao = await colecaoDeIndice();
  const registros = await colecao.findAsync({
    _id: { $in: ids },
    classificadoEm: { $exists: true }
  });
  return new Map(registros.map((registro) => [registro._id, registro]));
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
  valor: boolean;
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
  return registro ? registro.valor : null;
}

export async function gravarPreferencia(chave: string, valor: boolean): Promise<void> {
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
