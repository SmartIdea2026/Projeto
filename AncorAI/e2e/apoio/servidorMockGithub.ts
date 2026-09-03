import { respostaJson, subirServidorMock, type ServidorMock } from './servidorHttp';

/**
 * Mock mínimo da API do GitHub para a suíte E2E — só as rotas que os fluxos
 * cobertos aqui exercitam (ver design.md - Decisão 2 e o contrato extraído de
 * `src/main/fontes/github.ts` durante o design desta mudança). Cada teste sobe
 * sua própria instância e a fecha ao final.
 */

export interface RepositorioMock {
  name: string;
  full_name: string;
  default_branch: string;
  owner: { login: string };
  pushed_at: string;
}

export interface ArquivoArvoreMock {
  path: string;
  sha: string;
  size?: number;
}

export interface AutoriaMock {
  autor: string;
  data: string;
}

export interface ConfigServidorGithub {
  /** `GET /user` — validação de credencial. */
  usuario?: { status?: number; login?: string };
  /** `GET /user/repos` — listagem de repositórios acessíveis. */
  repositorios?: { status?: number; itens?: RepositorioMock[] };
  /**
   * `GET /repos/{full_name}/git/trees/{branch}?recursive=1`, por
   * `"{full_name}:{branch}"`.
   */
  arvores?: Record<string, { truncated?: boolean; status?: number; arquivos: ArquivoArvoreMock[] }>;
  /**
   * `GET /repos/{full_name}/commits?path={caminho}&per_page=1`, por
   * `"{full_name}\n{caminho}"`. Ausente ou `null` responde lista vazia
   * (equivalente a "sem autoria resolvida", que `autoriaDoArquivo` já trata).
   */
  autoria?: Record<string, AutoriaMock | null>;
  /** `GET /repos/{full_name}/git/blobs/{sha}` (Accept: raw), por `sha`. */
  blobs?: Record<string, string>;
}

export async function subirServidorGithub(config: ConfigServidorGithub = {}): Promise<ServidorMock> {
  return subirServidorMock([
    {
      metodo: 'GET',
      caminho: '/user',
      manipulador: (_req, res) => {
        const status = config.usuario?.status ?? 200;
        if (status !== 200) {
          respostaJson(res, status, { message: 'credencial inválida (mock)' });
          return;
        }
        respostaJson(res, 200, { login: config.usuario?.login ?? 'usuaria-e2e' });
      }
    },
    {
      metodo: 'GET',
      caminho: '/user/repos',
      manipulador: (_req, res) => {
        const status = config.repositorios?.status ?? 200;
        if (status !== 200) {
          respostaJson(res, status, { message: 'acesso recusado (mock)' });
          return;
        }
        respostaJson(res, 200, config.repositorios?.itens ?? []);
      }
    },
    {
      metodo: 'GET',
      caminho: /^\/repos\/([^/]+\/[^/]+)\/git\/trees\/([^/]+)$/,
      manipulador: (_req, res, correspondencia) => {
        const fullName = correspondencia![1]!;
        const branch = correspondencia![2]!;
        const entrada = config.arvores?.[`${fullName}:${branch}`];
        if (!entrada) {
          respostaJson(res, 404, { message: `árvore não mockada para ${fullName}:${branch}` });
          return;
        }
        if (entrada.status && entrada.status !== 200) {
          respostaJson(res, entrada.status, { message: 'falha ao obter a árvore (mock)' });
          return;
        }
        respostaJson(res, 200, {
          truncated: entrada.truncated ?? false,
          tree: entrada.arquivos.map((arquivo) => ({
            path: arquivo.path,
            type: 'blob',
            sha: arquivo.sha,
            size: arquivo.size
          }))
        });
      }
    },
    {
      metodo: 'GET',
      caminho: /^\/repos\/([^/]+\/[^/]+)\/commits$/,
      manipulador: (_req, res, correspondencia, url) => {
        const fullName = correspondencia![1]!;
        const caminho = url.searchParams.get('path') ?? '';
        const entrada = config.autoria?.[`${fullName}\n${caminho}`];
        if (!entrada) {
          respostaJson(res, 200, []);
          return;
        }
        respostaJson(res, 200, [
          {
            commit: { author: { name: entrada.autor, date: entrada.data } },
            author: { login: entrada.autor }
          }
        ]);
      }
    },
    {
      metodo: 'GET',
      caminho: /^\/repos\/[^/]+\/[^/]+\/git\/blobs\/([^/]+)$/,
      manipulador: (_req, res, correspondencia) => {
        const sha = correspondencia![1]!;
        const texto = config.blobs?.[sha];
        if (texto === undefined) {
          respostaJson(res, 404, { message: `blob não mockado para ${sha}` });
          return;
        }
        res.writeHead(200, { 'content-type': 'application/vnd.github.raw' });
        res.end(texto, 'utf-8');
      }
    }
  ]);
}
