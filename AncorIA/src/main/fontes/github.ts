import type { Documento } from '../../compartilhado/tipos';
import { gravarCache, lerCache } from '../banco/indice';
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

/**
 * Repositórios acessíveis pela credencial.
 *
 * Usa `/user/repos` em vez de `/users/{login}/repos` porque o segundo devolve
 * apenas repositórios públicos, deixando de fora os privados aos quais o token
 * tem acesso — limitação registrada no design, seção 2.3.
 */
export async function listarRepositorios(token: string): Promise<RepositorioApi[]> {
  const { dados } = await requisitar<RepositorioApi[]>(
    '/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member',
    token,
    'github:repos'
  );
  return dados;
}

interface ArvoreApi {
  truncated: boolean;
  tree: Array<{ path: string; type: string; sha: string }>;
}

/** Inventário completo de documentos de um repositório, em uma requisição. */
export async function inventariar(
  token: string,
  repo: RepositorioApi
): Promise<Documento[]> {
  const { dados } = await requisitar<ArvoreApi>(
    `/repos/${repo.full_name}/git/trees/${repo.default_branch}?recursive=1`,
    token,
    `github:tree:${repo.full_name}:${repo.default_branch}`
  );

  return dados.tree
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
        link: `https://github.com/${repo.full_name}/blob/${repo.default_branch}/${item.path}`,
        caminho: item.path,
        repositorio: repo.full_name
      };
    });
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
): Promise<Documento[]> {
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

  return [...encontrados.values()];
}

/** Executa uma tarefa por repositório com concorrência limitada. */
async function porRepositorio(
  repos: RepositorioApi[],
  concorrencia: number,
  tarefa: (repo: RepositorioApi) => Promise<Documento[]>
): Promise<Documento[]> {
  const resultado: Documento[] = [];
  const fila = [...repos];

  const trabalhadores = Array.from(
    { length: Math.min(concorrencia, fila.length) },
    async () => {
      for (let repo = fila.shift(); repo; repo = fila.shift()) {
        try {
          resultado.push(...(await tarefa(repo)));
        } catch (erro) {
          // Um repositório inacessível não invalida a busca nos demais.
          if (erro instanceof ErroFonte && erro.limiteExcedido) throw erro;
        }
      }
    }
  );

  await Promise.all(trabalhadores);
  return resultado;
}

export async function buscarDocumentos(token: string): Promise<Documento[]> {
  const repos = await listarRepositorios(token);
  return porRepositorio(repos, 4, (repo) => inventariar(token, repo));
}

export async function documentosRecentes(token: string): Promise<Documento[]> {
  const repos = await listarRepositorios(token);
  // Apenas os repositórios com atividade mais recente, para conter o custo:
  // cada um exige uma requisição de commits e uma por commit detalhado.
  const ativos = [...repos]
    .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
    .slice(0, 5);
  return porRepositorio(ativos, 2, (repo) => recentesDoRepositorio(token, repo, 10));
}
