import type { Documento } from '../../compartilhado/tipos';
import { gravarCache, lerCache } from '../banco/repositorio';
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

function cabecalhos(token: string, etag?: string | null): HeadersInit {
  const base: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (etag) base['If-None-Match'] = etag;
  return base;
}

/**
 * Requisição com cache por ETag.
 *
 * Uma resposta 304 não consome cota de rate limit do GitHub, então revalidar é
 * sempre preferível a repetir a requisição completa.
 */
async function requisitar<T>(
  caminho: string,
  token: string,
  chaveCache?: string
): Promise<RespostaCache<T>> {
  const cache = chaveCache ? await lerCache<T>(chaveCache) : null;

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      headers: cabecalhos(token, cache?.etag)
    });
  } catch {
    if (cache) return { dados: cache.payload, doCache: true };
    throw new ErroFonte('github', 'Não foi possível alcançar o GitHub.');
  }

  if (resposta.status === 304 && cache) {
    return { dados: cache.payload, doCache: true };
  }

  if (resposta.status === 401) {
    throw new ErroFonte('github', 'A credencial do GitHub não é válida.');
  }

  if (resposta.status === 403 || resposta.status === 429) {
    const restante = resposta.headers.get('x-ratelimit-remaining');
    const limiteExcedido = restante === '0' || resposta.status === 429;
    if (cache) return { dados: cache.payload, doCache: true };
    throw new ErroFonte(
      'github',
      limiteExcedido
        ? 'O limite de requisições do GitHub foi atingido. Tente novamente mais tarde.'
        : 'O GitHub recusou o acesso com a credencial informada.',
      limiteExcedido
    );
  }

  if (!resposta.ok) {
    if (cache) return { dados: cache.payload, doCache: true };
    throw new ErroFonte('github', `O GitHub respondeu com o código ${resposta.status}.`);
  }

  const dados = (await resposta.json()) as T;
  if (chaveCache) await gravarCache(chaveCache, dados, resposta.headers.get('etag'));
  return { dados, doCache: false };
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
  tree: Array<{ path: string; type: string; sha: string }>;
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
        repositorio: repo.full_name
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
  files?: Array<{ filename: string; status: string }>;
}

/**
 * Documentos modificados recentemente.
 *
 * A lista de commits não traz os arquivos alterados, por isso o detalhe dos
 * commits mais recentes é buscado individualmente — comportamento confirmado
 * contra a API real.
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

  const encontrados = new Map<string, Documento>();

  for (const commit of commits) {
    const { dados: detalhe } = await requisitar<CommitDetalheApi>(
      `/repos/${repo.full_name}/commits/${commit.sha}`,
      token,
      `github:commit:${repo.full_name}:${commit.sha}`
    );

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
        repositorio: repo.full_name
      });
    }
  }

  // Aqui a data é a do commit, e não uma aproximação: os documentos saem sem
  // a marca `dataAproximada`.
  return { dados: [...encontrados.values()], aviso: null };
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
