import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { shell } from 'electron';
import { ErroFonte } from '../fontes/comum';

/**
 * Fluxo OAuth 2.0 do Google para aplicativos instalados.
 *
 * Uma chave de API não serve ao Drive: chaves autenticam o projeto, não o
 * usuário, e `files.list` recusa conteúdo privado. Por isso o acesso exige
 * consentimento do usuário.
 *
 * O fluxo segue o modelo de loopback recomendado para aplicativos instalados:
 * um servidor HTTP efêmero em 127.0.0.1 recebe o redirecionamento. Como o
 * "client secret" de um aplicativo instalado não é de fato secreto — ele viaja
 * dentro do binário distribuído —, usa-se PKCE, que dispensa o segredo e
 * protege a troca do código.
 */

const ESCOPO = 'https://www.googleapis.com/auth/drive.readonly';
const AUTORIZACAO = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';

interface RespostaToken {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

function gerarVerificador(): { verificador: string; desafio: string } {
  const verificador = randomBytes(32).toString('base64url');
  const desafio = createHash('sha256').update(verificador).digest('base64url');
  return { verificador, desafio };
}

const PAGINA_SUCESSO = `<!doctype html><meta charset="utf-8">
<title>AncorAI</title>
<body style="font-family:system-ui;background:#F4F2EA;color:#14432F;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h1 style="margin:0 0 .5rem">Tudo certo</h1>
<p style="color:#2E7A5A">O Google Drive foi conectado. Você já pode fechar esta aba.</p>
</div></body>`;

const PAGINA_ERRO = `<!doctype html><meta charset="utf-8">
<title>AncorAI</title>
<body style="font-family:system-ui;background:#F4F2EA;color:#14432F;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h1 style="margin:0 0 .5rem">Não foi possível conectar</h1>
<p style="color:#2E7A5A">Volte ao AncorAI e tente novamente.</p>
</div></body>`;

/**
 * Abre o consentimento no navegador e aguarda o retorno.
 *
 * Devolve o refresh token, que é o que permite renovar o acesso sem repetir o
 * consentimento a cada abertura do aplicativo.
 */
export function autorizar(clientId: string): Promise<string> {
  const { verificador, desafio } = gerarVerificador();
  const estado = randomBytes(16).toString('base64url');

  return new Promise<string>((resolver, rejeitar) => {
    const servidor = createServer(async (requisicao, resposta) => {
      const url = new URL(requisicao.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        resposta.writeHead(404).end();
        return;
      }

      const codigo = url.searchParams.get('code');
      const estadoRecebido = url.searchParams.get('state');
      const erro = url.searchParams.get('error');

      const encerrar = (pagina: string) => {
        resposta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        resposta.end(pagina);
        servidor.close();
      };

      if (erro || !codigo) {
        encerrar(PAGINA_ERRO);
        rejeitar(new ErroFonte('drive', 'A autorização foi recusada ou cancelada.'));
        return;
      }

      // Protege contra um retorno forjado por outra origem local.
      if (estadoRecebido !== estado) {
        encerrar(PAGINA_ERRO);
        rejeitar(new ErroFonte('drive', 'A resposta de autorização não pôde ser validada.'));
        return;
      }

      try {
        const porta = (servidor.address() as AddressInfo).port;
        const tokens = await trocarCodigo(clientId, codigo, verificador, porta);
        if (!tokens.refresh_token) {
          encerrar(PAGINA_ERRO);
          rejeitar(
            new ErroFonte(
              'drive',
              'O Google não devolveu um token de renovação. Remova o acesso do ' +
                'AncorAI na conta Google e autorize novamente.'
            )
          );
          return;
        }
        encerrar(PAGINA_SUCESSO);
        resolver(tokens.refresh_token);
      } catch (falha) {
        encerrar(PAGINA_ERRO);
        rejeitar(falha);
      }
    });

    servidor.on('error', () =>
      rejeitar(new ErroFonte('drive', 'Não foi possível iniciar o servidor de autorização.'))
    );

    servidor.listen(0, '127.0.0.1', () => {
      const porta = (servidor.address() as AddressInfo).port;
      const parametros = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `http://127.0.0.1:${porta}/callback`,
        response_type: 'code',
        scope: ESCOPO,
        code_challenge: desafio,
        code_challenge_method: 'S256',
        state: estado,
        // Sem `offline` o Google não devolve refresh token; sem `consent` ele
        // deixa de devolvê-lo em autorizações repetidas.
        access_type: 'offline',
        prompt: 'consent'
      });
      void shell.openExternal(`${AUTORIZACAO}?${parametros}`);
    });

    // Evita um servidor local pendurado indefinidamente caso o usuário abandone
    // o consentimento no navegador.
    setTimeout(
      () => {
        if (servidor.listening) {
          servidor.close();
          rejeitar(new ErroFonte('drive', 'O tempo para concluir a autorização expirou.'));
        }
      },
      5 * 60 * 1000
    ).unref();
  });
}

async function trocarCodigo(
  clientId: string,
  codigo: string,
  verificador: string,
  porta: number
): Promise<RespostaToken> {
  const resposta = await fetch(TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      code: codigo,
      code_verifier: verificador,
      grant_type: 'authorization_code',
      redirect_uri: `http://127.0.0.1:${porta}/callback`
    })
  });

  const dados = (await resposta.json()) as RespostaToken;
  if (!resposta.ok) {
    throw new ErroFonte(
      'drive',
      dados.error_description ?? 'Não foi possível concluir a autorização com o Google.'
    );
  }
  return dados;
}

interface AcessoVigente {
  token: string;
  expiraEm: number;
}

let acessoEmMemoria: AcessoVigente | null = null;

/**
 * Devolve um access token válido, renovando quando necessário.
 *
 * O access token vive apenas em memória: só o refresh token é persistido, e ele
 * fica no cofre cifrado.
 */
export async function obterAcesso(clientId: string, refreshToken: string): Promise<string> {
  const agora = Date.now();
  if (acessoEmMemoria && acessoEmMemoria.expiraEm > agora + 60_000) {
    return acessoEmMemoria.token;
  }

  let resposta: Response;
  try {
    resposta = await fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
  } catch {
    throw new ErroFonte('drive', 'Não foi possível alcançar o Google.');
  }

  const dados = (await resposta.json()) as RespostaToken;
  if (!resposta.ok) {
    throw new ErroFonte(
      'drive',
      'A autorização do Google Drive expirou. É necessário conectar novamente.'
    );
  }

  acessoEmMemoria = {
    token: dados.access_token,
    expiraEm: agora + dados.expires_in * 1000
  };
  return dados.access_token;
}

export function esquecerAcesso(): void {
  acessoEmMemoria = null;
}
