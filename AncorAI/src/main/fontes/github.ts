import type { Documento } from '../../compartilhado/tipos';
import { type EntradaCache, gravarCache, lerCache } from '../banco/repositorio';
import { ErroFonte, extensaoDe, extensaoEhAceita } from './comum';

/**
 * Integração com a API do GitHub.
 *
 * A estratégia foi verificada contra a API real em 27/08/2026 e está registrada
 * no design, seção 2. Em resumo:
 *
 * - a Events API não serve para descobrir arquivos alterados: o `payload` de um
 *   `PushEvent` não traz a lista de commits;
 * - a árvore Git (`git/trees?recursive=1`) devolve o inventário completo do
 *   repositório em uma única requisição, e é a base da busca por nome;
 * - os documentos recentes vêm da lista de commits somada ao detalhe dos mais
 *   recentes, que é onde os arquivos alterados aparecem.
 */

const BASE = 'https://api.github.com';

interface RespostaCache<T> {
  dados: T;
  doCache: boolean;
}

function cabecalhos(
  token: string,
  etag?: string | null,
  aceite = 'application/vnd.github+json'
): HeadersInit {
  const base: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: aceite,
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (etag) base['If-None-Match'] = etag;
  return base;
}

/**
 * Executa a requisição e trata os modos de falha comuns a todo endpoint.
 *
 * Devolve `null` quando o chamador deve usar o cache que já tem — seja porque
 * o GitHub respondeu 304, seja porque a requisição falhou e o cache é o
 * recurso. Devolve a `Response` quando o corpo precisa ser lido.
 *
 * Interpretar o corpo cabe a quem chama: `requisitar` lê JSON e `requisitarBytes`
 * lê bytes. O que **não** cabe a quem chama é decidir o que fazer com 401, 403,
 * 429 ou queda de rede: essa decisão é a mesma para todo endpoint, e duplicá-la
 * faria o tratamento de limite de requisições divergir entre os dois caminhos
 * sem ninguém perceber.
 *
 * Uma resposta 304 não consome cota de rate limit do GitHub, então revalidar é
 * sempre preferível a repetir a requisição completa.
 */
async function responder(
  caminho: string,
  token: string,
  opcoes: { aceite?: string; etag?: string | null; temCache?: boolean } = {}
): Promise<Response | null> {
  const { aceite, etag = null, temCache = false } = opcoes;

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      headers: cabecalhos(token, etag, aceite)
    });
  } catch {
    if (temCache) return null;
    throw new ErroFonte('github', 'Não foi possível alcançar o GitHub.');
  }

  if (resposta.status === 304 && temCache) return null;

  if (resposta.status === 401) {
    throw new ErroFonte('github', 'A credencial do GitHub não é válida.');
  }

  if (resposta.status === 403 || resposta.status === 429) {
    const restante = resposta.headers.get('x-ratelimit-remaining');
    const limiteExcedido = restante === '0' || resposta.status === 429;
    if (temCache) return null;
    throw new ErroFonte(
      'github',
      limiteExcedido
        ? 'O limite de requisições do GitHub foi atingido. Tente novamente mais tarde.'
        : 'O GitHub recusou o acesso com a credencial informada.',
      limiteExcedido
    );
  }

  if (!resposta.ok) {
    if (temCache) return null;
    throw new ErroFonte('github', `O GitHub respondeu com o código ${resposta.status}.`);
  }

  return resposta;
}

/** Requisição de JSON com cache por ETag. */
async function requisitar<T>(
  caminho: string,
  token: string,
  chaveCache?: string
): Promise<RespostaCache<T>> {
  const cache = chaveCache ? await lerCache<T>(chaveCache) : null;

  const resposta = await responder(caminho, token, {
    etag: cache?.etag,
    temCache: Boolean(cache)
  });

  if (!resposta) return { dados: (cache as EntradaCache<T>).payload, doCache: true };

  const dados = (await resposta.json()) as T;
  if (chaveCache) await gravarCache(chaveCache, dados, resposta.headers.get('etag'));
  return { dados, doCache: false };
}

/**
 * Requisição de bytes, sem cache por ETag.
 *
 * Endereçar um blob pelo `sha` já é endereçar por conteúdo: o mesmo `sha`
 * devolve sempre os mesmos bytes. Revalidar por ETag não teria o que revalidar,
 * e gravar o resultado em `cache_fontes` colocaria arquivos inteiros numa
 * coleção com semântica de cache de resposta e vida curta. Quem guarda o
 * resultado desta chamada é a camada de conteúdo, com regra própria.
 */
async function requisitarBytes(
  caminho: string,
  token: string,
  aceite: string
): Promise<ArrayBuffer> {
  const resposta = await responder(caminho, token, { aceite });
  // `responder` só devolve `null` quando há cache a usar, e aqui não há.
  return (resposta as Response).arrayBuffer();
}

export async function verificarCredencial(token: string): Promise<string> {
  const { dados } = await requisitar<{ login: string }>('/user', token);
  return dados.login;
}

interface RepositorioApi {
  name: string;
  full_name: string;
  default_branch: string;
  owner: { login: string };
  pushed_at: string;
}

const POR_PAGINA = 100;

/** Teto de páginas percorridas, para que um token muito abrangente não gere
 *  uma sequência ilimitada de requisições. */
const MAX_PAGINAS = 10;

/** Resultado que pode estar incompleto, com o motivo quando estiver. */
export interface Parcial<T> {
  dados: T;
  /** Mensagem de aviso quando o resultado não é completo; nulo quando é. */
  aviso: string | null;
}

/**
 * Repositórios acessíveis pela credencial.
 *
 * Usa `/user/repos` em vez de `/users/{login}/repos` porque o segundo devolve
 * apenas repositórios públicos, deixando de fora os privados aos quais o token
 * tem acesso — limitação registrada no design, seção 2.3.
 *
 * A resposta é paginada. Uma única página de 100 cobria a conta usada no
 * desenvolvimento, mas truncaria em silêncio qualquer conta acima disso, então
 * as páginas são percorridas até a última. O fim é detectado por uma página
 * incompleta, e não pelo cabeçalho `Link`, porque cada página tem o próprio
 * `ETag` e é cacheada de forma independente.
 */
export async function listarRepositorios(token: string): Promise<Parcial<RepositorioApi[]>> {
  const todos: RepositorioApi[] = [];

  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const { dados } = await requisitar<RepositorioApi[]>(
      `/user/repos?per_page=${POR_PAGINA}&page=${pagina}` +
        '&sort=pushed&affiliation=owner,collaborator,organization_member',
      token,
      `github:repos:${pagina}`
    );

    todos.push(...dados);
    if (dados.length < POR_PAGINA) return { dados: todos, aviso: null };
  }

  return {
    dados: todos,
    aviso:
      `A busca considerou os ${MAX_PAGINAS * POR_PAGINA} repositórios mais ` +
      'recentes. Pode haver documentos em repositórios além desse limite.'
  };
}

interface ArvoreApi {
  truncated: boolean;
  // `sha` e `size` já vêm nesta resposta, sem custo algum: o `sha` é a
  // identidade do conteúdo usada para saber se o texto guardado ainda vale, e
  // o `size` permite descartar um arquivo grande demais sem gastar requisição
  // para descobrir o tamanho.
  tree: Array<{ path: string; type: string; sha: string; size?: number }>;
}

/**
 * Inventário de documentos de um repositório, em uma requisição.
 *
 * A árvore recursiva vem truncada quando o repositório é grande demais, e a
 * API sinaliza isso em `truncated`. Nesse caso o inventário está incompleto e
 * o usuário precisa saber: sem o aviso, um documento ausente do resultado é
 * indistinguível de um documento inexistente.
 */
export async function inventariar(
  token: string,
  repo: RepositorioApi
): Promise<Parcial<Documento[]>> {
  const { dados } = await requisitar<ArvoreApi>(
    `/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
    token,
    `github:tree:${repo.full_name}:${repo.default_branch}`
  );

  const documentos = dados.tree
    .filter((item) => item.type === 'blob' && extensaoEhAceita(item.path))
    .map((item) => {
      const nome = item.path.split('/').pop() ?? item.path;
      return {
        id: `github:${repo.full_name}:${item.path}`,
        nome,
        extensao: extensaoDe(nome),
        fonte: 'github' as const,
        // A árvore não carrega data por arquivo. O `pushed_at` do repositório é
        // a melhor aproximação disponível sem uma requisição por arquivo, custo
        // que o design descartou.
        dataModificacao: repo.pushed_at,
        // A árvore não carrega data por arquivo: todos os documentos do
        // repositório recebem o `pushed_at` dele. A marca acompanha o
        // documento para que a interface e o filtro de período não tratem
        // essa aproximação como data real.
        dataAproximada: true,
        link: `https://github.com/${repo.full_name}/blob/${repo.default_branch}/${item.path}`,
        caminho: item.path,
        repositorio: repo.full_name,
        versaoConteudo: item.sha,
        tamanho: item.size
      };
    });

  return {
    dados: documentos,
    aviso: dados.truncated
      ? `O repositório ${repo.full_name} é grande demais para ser listado de ` +
        'uma vez, e parte dos documentos ficou de fora.'
      : null
  };
}

interface CommitApi {
  sha: string;
  commit: { author: { date: string } };
}

interface CommitDetalheApi {
  // `sha` aqui é o do blob do arquivo naquele commit — a mesma identidade de
  // conteúdo que a árvore Git devolve. Vem de graça nesta resposta, que já é
  // buscada de qualquer forma, e é o que torna os documentos recentes
  // endereçáveis por conteúdo como os do inventário.
  files?: Array<{ filename: string; status: string; sha?: string }>;
}

/**
 * Documentos modificados recentemente.
 *
 * A lista de commits não traz os arquivos alterados, por isso o detalhe dos
 * commits mais recentes é buscado individualmente — comportamento confirmado
 * contra a API real. As requisições de detalhe são disparadas em paralelo:
 * cada uma depende só do `sha` do commit, nunca do resultado de outra, e
 * esperar uma de cada vez custava, medido em uso real, a soma de todas —
 * ida e volta de rede vezes `limiteCommits`, por repositório.
 */
export async function recentesDoRepositorio(
  token: string,
  repo: RepositorioApi,
  limiteCommits = 10
): Promise<Parcial<Documento[]>> {
  const { dados: commits } = await requisitar<CommitApi[]>(
    `/repos/${repo.full_name}/commits?per_page=${limiteCommits}`,
    token,
    `github:commits:${repo.full_name}`
  );

  const detalhes = await Promise.all(
    commits.map((commit) =>
      requisitar<CommitDetalheApi>(
        `/repos/${repo.full_name}/commits/${commit.sha}`,
        token,
        `github:commit:${repo.full_name}:${commit.sha}`
      )
    )
  );

  const encontrados = new Map<string, Documento>();

  // A ordem de processamento continua a dos commits — do mais recente para o
  // mais antigo —, mesmo com as requisições resolvendo em qualquer ordem.
  for (const [indice, commit] of commits.entries()) {
    const { dados: detalhe } = detalhes[indice]!;

    for (const arquivo of detalhe.files ?? []) {
      if (arquivo.status === 'removed') continue;
      if (!extensaoEhAceita(arquivo.filename)) continue;

      const id = `github:${repo.full_name}:${arquivo.filename}`;
      // Os commits vêm do mais recente para o mais antigo: a primeira
      // ocorrência de um arquivo já carrega sua modificação mais recente.
      if (encontrados.has(id)) continue;

      const nome = arquivo.filename.split('/').pop() ?? arquivo.filename;
      encontrados.set(id, {
        id,
        nome,
        extensao: extensaoDe(nome),
        fonte: 'github',
        dataModificacao: commit.commit.author.date,
        link: `https://github.com/${repo.full_name}/blob/${repo.default_branch}/${arquivo.filename}`,
        caminho: arquivo.filename,
        repositorio: repo.full_name,
        versaoConteudo: arquivo.sha
      });
    }
  }

  // Aqui a data é a do commit, e não uma aproximação: os documentos saem sem
  // a marca `dataAproximada`. E saem com `versaoConteudo`, sem o que nenhum
  // documento da tela inicial poderia ter o conteúdo obtido — a tela inicial
  // é justamente esta lista.
  return { dados: [...encontrados.values()], aviso: null };
}

interface CommitDeArquivoApi {
  commit: { author: { name: string; date: string } };
  author?: { login: string } | null;
}

/**
 * Autoria e data real da última alteração de um arquivo.
 *
 * A árvore Git não traz nenhum dos dois: ela lista caminhos e nada mais. Cada
 * arquivo exige uma consulta própria — custo que adiou este item no MVP e que
 * a paginação torna aceitável, por incidir apenas sobre a página apresentada.
 *
 * Devolve `null` quando não há commit ou a consulta falha: um documento sem
 * autoria é apresentado sem ela, nunca como erro.
 */
export async function autoriaDoArquivo(
  token: string,
  repositorio: string,
  caminho: string
): Promise<{ autor: string; dataModificacao: string } | null> {
  try {
    const { dados } = await requisitar<CommitDeArquivoApi[]>(
      `/repos/${repositorio}/commits?path=${encodeURIComponent(caminho)}&per_page=1`,
      token,
      `github:autoria:${repositorio}:${caminho}`
    );

    const commit = dados[0];
    if (!commit) return null;

    // O login do GitHub identifica melhor que o nome configurado no git, que
    // varia entre máquinas; o nome do commit é o recurso quando o autor não
    // está associado a uma conta.
    return {
      autor: commit.author?.login ?? commit.commit.author.name,
      dataModificacao: commit.commit.author.date
    };
  } catch {
    return null;
  }
}

/**
 * Bytes de um arquivo, endereçados pelo `sha` do blob.
 *
 * Usa `git/blobs/{sha}` com mídia bruta, e não o endpoint de conteúdo por
 * caminho, por três razões:
 *
 * 1. o `sha` já veio na árvore do inventário — pedir por caminho faria o
 *    GitHub resolver de novo um caminho que já resolvemos;
 * 2. endereçar por conteúdo elimina a corrida com um push que entre entre o
 *    inventário e o download: recebemos exatamente a revisão inventariada, e
 *    o texto guardado sempre corresponde ao `sha` gravado ao lado dele;
 * 3. o endpoint de conteúdo entrega no máximo 1 MB na forma JSON, enquanto o
 *    de blob com mídia bruta vai muito além.
 */
export async function conteudoDoArquivo(
  token: string,
  repositorio: string,
  sha: string
): Promise<ArrayBuffer> {
  return requisitarBytes(
    `/repos/${repositorio}/git/blobs/${sha}`,
    token,
    'application/vnd.github.raw'
  );
}

/**
 * Executa uma tarefa por repositório com concorrência limitada.
 *
 * Um repositório inacessível não invalida a busca nos demais, mas também não
 * some sem deixar rastro: a falha é contada e vira aviso. Antes, o `catch`
 * engolia o erro e o usuário recebia um resultado menor sem qualquer sinal de
 * que algo havia ficado para trás. Estouro de cota continua interrompendo,
 * porque aí o resultado seria arbitrariamente incompleto.
 */
async function porRepositorio(
  repos: RepositorioApi[],
  concorrencia: number,
  tarefa: (repo: RepositorioApi) => Promise<Parcial<Documento[]>>
): Promise<Parcial<Documento[]>> {
  const resultado: Documento[] = [];
  const avisos: string[] = [];
  const inacessiveis: string[] = [];
  const fila = [...repos];

  const trabalhadores = Array.from(
    { length: Math.min(concorrencia, fila.length) },
    async () => {
      for (let repo = fila.shift(); repo; repo = fila.shift()) {
        try {
          const parcial = await tarefa(repo);
          resultado.push(...parcial.dados);
          if (parcial.aviso) avisos.push(parcial.aviso);
        } catch (erro) {
          if (erro instanceof ErroFonte && erro.limiteExcedido) throw erro;
          inacessiveis.push(repo.full_name);
        }
      }
    }
  );

  await Promise.all(trabalhadores);

  if (inacessiveis.length > 0) {
    const lista = inacessiveis.slice(0, 3).join(', ');
    const resto = inacessiveis.length > 3 ? ` e outros ${inacessiveis.length - 3}` : '';
    avisos.push(`Não foi possível consultar ${lista}${resto}.`);
  }

  return { dados: resultado, aviso: avisos.length > 0 ? avisos.join(' ') : null };
}

/** Junta o aviso da listagem de repositórios ao das consultas por repositório. */
function juntarAvisos(...partes: Array<string | null>): string | null {
  const presentes = partes.filter((parte): parte is string => Boolean(parte));
  return presentes.length > 0 ? presentes.join(' ') : null;
}

export async function buscarDocumentos(token: string): Promise<Parcial<Documento[]>> {
  const repos = await listarRepositorios(token);
  const documentos = await porRepositorio(repos.dados, 4, (repo) =>
    inventariar(token, repo)
  );

  return {
    dados: documentos.dados,
    aviso: juntarAvisos(repos.aviso, documentos.aviso)
  };
}

export async function documentosRecentes(token: string): Promise<Parcial<Documento[]>> {
  const repos = await listarRepositorios(token);
  // Apenas os repositórios com atividade mais recente, para conter o custo:
  // cada um exige uma requisição de commits e uma por commit detalhado.
  const ativos = [...repos.dados]
    .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
    .slice(0, 5);

  const documentos = await porRepositorio(ativos, 2, (repo) =>
    recentesDoRepositorio(token, repo, 10)
  );

  // O aviso de paginação não se aplica aqui: a lista de recentes já se limita
  // aos repositórios de atividade mais recente por desenho, e esses estão
  // sempre nas primeiras páginas, que vêm ordenadas por `pushed`.
  return { dados: documentos.dados, aviso: documentos.aviso };
}
