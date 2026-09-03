import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright-core';
import { NOME_DOCUMENTO_ALVO, semearAcervo, TERMO_DISTINTIVO } from './semear';

/**
 * PoC de viabilidade do Playwright (ver openspec/changes/poc-viabilidade-playwright/).
 *
 * Um único fluxo, sem mock de rede: os documentos vêm de um snapshot local
 * pré-semeado (`acervo_documentos`), servido diretamente pela busca sem tocar
 * GitHub nem credenciais (ver `src/main/busca/servico.ts` - `buscarNoSnapshot`).
 */

let diretorioDados: string;
let app: ElectronApplication;

test.beforeEach(async () => {
  diretorioDados = mkdtempSync(join(tmpdir(), 'ancorai-e2e-'));
  await semearAcervo(diretorioDados);

  // `ELECTRON_RUN_AS_NODE` faz o binário do Electron rodar como Node puro, sem
  // `app`/`BrowserWindow` — a mesma pegadinha que `iniciar.sh` já limpa para o
  // modo dev. Precisa sair do ambiente herdado por `_electron.launch()` também.
  const { ELECTRON_RUN_AS_NODE: _ignorado, ...ambienteBase } = process.env;

  app = await electron.launch({
    // `--ozone-platform=x11`: nesta máquina (Wayland nativo), o Ozone do
    // Chromium/Electron travava com SIGSEGV ao criar a janela. Forçar X11 (via
    // XWayland, já disponível como DISPLAY) evitou o crash.
    args: ['--ozone-platform=x11', join(__dirname, '../out/main/index.js')],
    env: { ...ambienteBase, ANCORAI_E2E_USER_DATA_DIR: diretorioDados }
  });
});

test.afterEach(async () => {
  await app?.close();
  rmSync(diretorioDados, { recursive: true, force: true });
});

test('busca por um termo encontra o documento correspondente no snapshot local', async () => {
  const janela = await app.firstWindow();

  const campoBusca = janela.getByRole('searchbox', { name: 'Buscar pelo nome do documento' });
  await campoBusca.fill(TERMO_DISTINTIVO);
  // `exact: true`: o filtro "Buscar no conteúdo" (adicionado depois desta PoC)
  // também casa com "Buscar" por substring.
  await janela.getByRole('button', { name: 'Buscar', exact: true }).click();

  // O nome do documento também aparece no painel de resumo (que passa a
  // acompanhar o primeiro resultado automaticamente) — por isso o locator é
  // restrito ao cartão da lista, e não a qualquer texto na tela.
  await expect(janela.locator('.cartao .cartao__nome', { hasText: NOME_DOCUMENTO_ALVO })).toBeVisible();
});

test('busca por um termo sem correspondência não retorna resultados', async () => {
  const janela = await app.firstWindow();

  const campoBusca = janela.getByRole('searchbox', { name: 'Buscar pelo nome do documento' });
  await campoBusca.fill('termo-sem-nenhuma-correspondencia-9x8z');
  // `exact: true`: o filtro "Buscar no conteúdo" (adicionado depois desta PoC)
  // também casa com "Buscar" por substring.
  await janela.getByRole('button', { name: 'Buscar', exact: true }).click();

  // Sem credencial do GitHub configurada — fora do escopo desta PoC —, a
  // mensagem "Nenhum documento encontrado" não aparece: ela é condicionada a
  // `temCredencial` em App.tsx, e o aviso "Configure o acesso ao GitHub"
  // aparece por cima independente do resultado da busca. O sinal confiável de
  // "sem resultado" aqui é a ausência de qualquer cartão de documento.
  await expect(janela.getByText(NOME_DOCUMENTO_ALVO)).not.toBeVisible();
  await expect(janela.locator('.cartao')).toHaveCount(0);
});
