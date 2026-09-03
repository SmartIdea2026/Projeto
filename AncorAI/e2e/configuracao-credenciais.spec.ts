import { expect, test } from '@playwright/test';
import { lancarApp, type AppE2E } from './apoio/lancarApp';
import { subirServidorGithub } from './apoio/servidorMockGithub';
import { subirServidorGemini } from './apoio/servidorMockGemini';
import type { ServidorMock } from './apoio/servidorHttp';

/**
 * Fluxo de configuração de credenciais (GitHub + Gemini) — `Configuracoes.tsx`.
 *
 * Usa `lancarApp` (child_process + CDP, ver `apoio/lancarApp.ts`), não
 * `_electron.launch()`: é o mecanismo que faz `safeStorage` funcionar nesta
 * máquina, necessário para gravar uma credencial de verdade.
 */

/** Tudo que o teste precisa fechar ao final — evita fechar o mesmo servidor duas vezes. */
const paraFechar: Array<{ fechar(): Promise<void> }> = [];

test.afterEach(async () => {
  await Promise.all(paraFechar.map((item) => item.fechar()));
  paraFechar.length = 0;
});

test('salvar um token válido do GitHub conecta a fonte', async () => {
  const github: ServidorMock = await subirServidorGithub({ usuario: { login: 'fulana-e2e' } });
  paraFechar.push(github);
  const instancia: AppE2E = await lancarApp({ githubBaseUrl: github.url });
  paraFechar.push(instancia);
  const janela = instancia.janela;

  await janela.getByRole('button', { name: 'Configurações', exact: true }).click();
  await janela.getByLabel('Token do GitHub').fill('ghp_token-valido');
  await janela.getByRole('button', { name: 'Salvar token' }).click();

  await expect(janela.getByText('Conectada')).toBeVisible();
  await expect(janela.getByText('Conectado como fulana-e2e')).toBeVisible();
  // O campo é limpo depois de salvar — a credencial nunca reaparece na interface (ADR-0003).
  await expect(janela.getByLabel('Token do GitHub')).toHaveValue('');
});

test('token inválido do GitHub mostra o erro correspondente e não conecta', async () => {
  const github: ServidorMock = await subirServidorGithub({ usuario: { status: 401 } });
  paraFechar.push(github);
  const instancia: AppE2E = await lancarApp({ githubBaseUrl: github.url });
  paraFechar.push(instancia);
  const janela = instancia.janela;

  await janela.getByRole('button', { name: 'Configurações', exact: true }).click();
  await janela.getByLabel('Token do GitHub').fill('ghp_token-invalido');
  await janela.getByRole('button', { name: 'Salvar token' }).click();

  await expect(janela.getByText('A credencial do GitHub não é válida.')).toBeVisible();
  await expect(janela.getByText('Conectada')).not.toBeVisible();
});

test('salvar e remover a chave do Gemini atualiza o estado exibido', async () => {
  const gemini: ServidorMock = await subirServidorGemini({ modelos: { nomes: ['gemini-3.1-flash'] } });
  paraFechar.push(gemini);
  const instancia: AppE2E = await lancarApp({ geminiBaseUrl: gemini.url });
  paraFechar.push(instancia);
  const janela = instancia.janela;

  await janela.getByRole('button', { name: 'Configurações', exact: true }).click();
  await janela.getByLabel('Chave da API do Gemini').fill('chave-e2e-valida');
  await janela.getByRole('button', { name: 'Salvar chave' }).click();

  await expect(janela.getByText('Modelo em uso:')).toBeVisible();
  await expect(janela.getByText('gemini-3.1-flash')).toBeVisible();

  await janela.getByRole('button', { name: 'Remover' }).click();
  await expect(janela.getByText('Modelo em uso:')).not.toBeVisible();
});
