import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

/**
 * Lançamento do app Electron real para a suíte E2E.
 *
 * Não usa `_electron.launch()` do Playwright: descoberto durante a
 * implementação que, nesta máquina, `safeStorage.isEncryptionAvailable()`
 * volta sempre `false` para um processo lançado por `_electron.launch()`
 * (backend `basic_text`), mas `true` (`gnome_libsecret`) para o mesmo binário,
 * com os mesmos argumentos e o mesmo ambiente, lançado como processo comum —
 * o mesmo princípio do wrapper local `ancorai-dev` (`unset
 * ELECTRON_RUN_AS_NODE` + `exec` direto, sem infraestrutura de automação
 * envolvida na inicialização). Qualquer teste que precise gravar uma
 * credencial de verdade (`cofre.definir`) depende de `safeStorage` funcionar.
 *
 * Por isso o app aqui é gerado via `child_process.spawn` — como `ancorai-dev`
 * faz — com `--remote-debugging-port`, e o Playwright se conecta a ele depois
 * via CDP (`chromium.connectOverCDP`), em vez de ser quem o lança. A
 * `busca-local.spec.ts` original (`_electron.launch()`) continua como está:
 * não depende de credencial, e não há motivo para arriscar o teste que já
 * passa (ver design.md - Non-Goals).
 *
 * Isolamento de dados via `ANCORAI_E2E_USER_DATA_DIR`, mesmo mecanismo da PoC.
 */

export interface OpcoesLancamento {
  /** Diretório de dados a reaproveitar; por padrão, um novo diretório temporário. */
  diretorioDados?: string;
  githubBaseUrl?: string;
  geminiBaseUrl?: string;
}

export interface AppE2E {
  /** Janela principal, já pronta para interação. */
  janela: Page;
  diretorioDados: string;
  /** Fecha o app e remove o diretório temporário, incondicionalmente. */
  fechar(): Promise<void>;
}

/** Porta TCP livre nesta máquina, para `--remote-debugging-port`. */
async function portaLivre(): Promise<number> {
  return new Promise((resolve, reject) => {
    const servidor = createServer();
    servidor.once('error', reject);
    servidor.listen(0, '127.0.0.1', () => {
      const endereco = servidor.address();
      const porta = typeof endereco === 'object' && endereco ? endereco.port : null;
      servidor.close(() => (porta ? resolve(porta) : reject(new Error('sem porta livre'))));
    });
  });
}

/** Aguarda o endpoint de depuração remota do Electron responder. */
async function aguardarCdp(porta: number, processo: ChildProcess, saida: () => string): Promise<void> {
  const prazo = Date.now() + 15_000;
  for (;;) {
    if (processo.exitCode !== null) {
      throw new Error(`o app encerrou antes de abrir a porta de depuração:\n${saida()}`);
    }
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (resposta.ok) return;
    } catch {
      // porta ainda não está aceitando conexões
    }
    if (Date.now() > prazo) {
      throw new Error(`tempo esgotado esperando a porta de depuração:\n${saida()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

export async function lancarApp(opcoes: OpcoesLancamento = {}): Promise<AppE2E> {
  const diretorioDados = opcoes.diretorioDados ?? mkdtempSync(join(tmpdir(), 'ancorai-e2e-'));
  const raizProjeto = join(__dirname, '../..');
  const porta = await portaLivre();

  // A mesma pegadinha que `ancorai-dev`/`iniciar.sh` já limpam: com
  // `ELECTRON_RUN_AS_NODE` herdado, o binário do Electron roda como Node puro,
  // sem `app`/`BrowserWindow`.
  const { ELECTRON_RUN_AS_NODE: _ignorado, ...ambienteBase } = process.env;

  const processo = spawn(
    './node_modules/.bin/electron',
    // Aponta para o diretório do projeto (`.`), não para `out/main/index.js`
    // diretamente: só assim `app.getAppPath()` resolve para a raiz do projeto
    // via o campo `main` do `package.json` — apontar para o arquivo faz
    // `getAppPath()` resolver para `out/main/`, quebrando `lerInstrucao()`
    // (`instrucoes/resumo.md` nunca é encontrado). Descoberto ao implementar
    // o teste de resumo por IA; afeta igualmente `_electron.launch()`, mas
    // nenhum teste até agora exercia esse caminho.
    ['--ozone-platform=x11', `--remote-debugging-port=${porta}`, '.'],
    {
      cwd: raizProjeto,
      env: {
        ...ambienteBase,
        ANCORAI_E2E_USER_DATA_DIR: diretorioDados,
        ...(opcoes.githubBaseUrl ? { ANCORAI_E2E_GITHUB_BASE_URL: opcoes.githubBaseUrl } : {}),
        ...(opcoes.geminiBaseUrl ? { ANCORAI_E2E_GEMINI_BASE_URL: opcoes.geminiBaseUrl } : {})
      },
      stdio: 'pipe'
    }
  );

  let saida = '';
  processo.stdout?.on('data', (dado: Buffer) => (saida += dado.toString()));
  processo.stderr?.on('data', (dado: Buffer) => (saida += dado.toString()));

  let browser: Browser;
  try {
    await aguardarCdp(porta, processo, () => saida);
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${porta}`);
  } catch (erro) {
    processo.kill();
    rmSync(diretorioDados, { recursive: true, force: true });
    throw erro;
  }

  const contexto = browser.contexts()[0] ?? (await browser.waitForEvent('context'));
  const janela = contexto.pages()[0] ?? (await contexto.waitForEvent('page'));
  await janela.waitForLoadState();

  return {
    janela,
    diretorioDados,
    async fechar() {
      await browser.close().catch(() => undefined);
      processo.kill();
      await new Promise((resolve) => processo.once('exit', resolve));
      rmSync(diretorioDados, { recursive: true, force: true });
    }
  };
}
