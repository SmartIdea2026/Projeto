import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

/**
 * Base comum aos mocks de GitHub e Gemini (`servidorMockGithub.ts`,
 * `servidorMockGemini.ts`) — evita duplicar o `createServer`/roteamento em
 * cada um. Cada teste sobe sua própria instância, em porta efêmera, e a fecha
 * ao final: nenhum estado é compartilhado entre testes (ver design.md -
 * Decisão 2).
 */

export interface Rota {
  metodo: string;
  /** Casado contra `pathname` (sem query string). */
  caminho: RegExp | string;
  manipulador: (
    req: IncomingMessage,
    res: ServerResponse,
    correspondencia: RegExpMatchArray | null,
    url: URL
  ) => void | Promise<void>;
}

export interface ServidorMock {
  url: string;
  fechar(): Promise<void>;
}

export async function subirServidorMock(rotas: Rota[]): Promise<ServidorMock> {
  const servidor: Server = createServer((req, res) => {
    void tratar(req, res, rotas);
  });

  await new Promise<void>((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', resolve);
  });

  const endereco = servidor.address();
  if (!endereco || typeof endereco === 'string') {
    throw new Error('Falha ao obter a porta do servidor mock.');
  }

  return {
    url: `http://127.0.0.1:${endereco.port}`,
    fechar: () =>
      new Promise<void>((resolve, reject) => {
        servidor.close((erro) => (erro ? reject(erro) : resolve()));
      })
  };
}

async function tratar(req: IncomingMessage, res: ServerResponse, rotas: Rota[]): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  for (const rota of rotas) {
    if (rota.metodo !== req.method) continue;
    const correspondencia =
      typeof rota.caminho === 'string'
        ? url.pathname === rota.caminho
          ? ([url.pathname] as unknown as RegExpMatchArray)
          : null
        : url.pathname.match(rota.caminho);
    if (!correspondencia) continue;

    try {
      await rota.manipulador(req, res, correspondencia, url);
    } catch (erro) {
      if (!res.headersSent) {
        respostaJson(res, 500, { erro: erro instanceof Error ? erro.message : 'falha no mock' });
      }
    }
    return;
  }

  respostaJson(res, 404, { message: `rota não mockada: ${req.method} ${url.pathname}` });
}

export function respostaJson(
  res: ServerResponse,
  status: number,
  corpo: unknown,
  cabecalhos: Record<string, string> = {}
): void {
  res.writeHead(status, { 'content-type': 'application/json', ...cabecalhos });
  res.end(JSON.stringify(corpo));
}
