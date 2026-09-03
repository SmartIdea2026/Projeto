import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Page } from 'playwright-core';
import { lancarApp, type AppE2E } from './apoio/lancarApp';
import {
  DOC_ALFA,
  DOC_BETA,
  DOC_DELTA,
  DOC_GAMA,
  DOC_SO_CONTEUDO,
  semearParaFiltros,
  TERMO_COMUM,
  TERMO_SO_CONTEUDO
} from './apoio/semearFiltros';

/**
 * Cobre cada filtro de `Filtros.tsx` isoladamente, sobre o snapshot local
 * semeado por `semearParaFiltros` (design.md - Decisão 6). Sem mock de rede:
 * a busca sobre snapshot (`buscar()`/`executarBusca`) nunca toca o GitHub.
 *
 * `aoAlterarFiltros` (`App.tsx`) só reconsulta automaticamente ao trocar
 * extensão/período quando há uma credencial de GitHub validada — e gravar uma
 * credencial depende de `safeStorage`, indisponível para o app lançado via
 * `_electron.launch()` nesta suíte (ver design.md - Risco de `safeStorage`).
 * Por isso cada teste, depois de ajustar um filtro pelo controle da UI (que
 * sempre atualiza o estado local, ainda que a reconsulta automática fique
 * bloqueada), reenvia o formulário de busca (`aoSubmeter`) — que consulta o
 * snapshot incondicionalmente, sem depender de credencial alguma — para obter
 * o resultado já filtrado. O critério de ordenação não tem esse problema:
 * `reordenar` nunca é condicionado a credencial.
 */

let instancia: AppE2E;

test.beforeEach(async () => {
  const diretorioDados = mkdtempSync(join(tmpdir(), 'ancorai-e2e-'));
  await semearParaFiltros(diretorioDados);
  instancia = await lancarApp({ diretorioDados });
});

test.afterEach(async () => {
  await instancia.fechar();
});

/** Reenvia o formulário de busca com o termo atual, aplicando os filtros já selecionados. */
async function reenviarBusca(janela: Page): Promise<void> {
  await janela.getByRole('button', { name: 'Buscar', exact: true }).click();
}

async function buscarTermoComum(janela: Page): Promise<void> {
  const campoBusca = janela.getByRole('searchbox', { name: 'Buscar pelo nome do documento' });
  await campoBusca.fill(TERMO_COMUM);
  await reenviarBusca(janela);
  await expect(janela.locator('.cartao')).toHaveCount(4);
}

function nomesDosCartoes(janela: Page) {
  return janela.locator('.cartao .cartao__nome').allTextContents();
}

test('filtro de extensão mostra só os documentos com a extensão escolhida', async () => {
  const janela = instancia.janela;
  await buscarTermoComum(janela);

  await janela.getByLabel('Extensão:').selectOption('pdf');
  await reenviarBusca(janela);

  await expect(janela.locator('.cartao')).toHaveCount(1);
  await expect(janela.locator('.cartao .cartao__nome')).toHaveText(DOC_BETA.nome);
});

test('filtro de extensão sem correspondência mostra lista vazia', async () => {
  const janela = instancia.janela;
  await buscarTermoComum(janela);

  await janela.getByLabel('Extensão:').selectOption('epub');
  await reenviarBusca(janela);

  await expect(janela.locator('.cartao')).toHaveCount(0);
});

test('filtro de período mostra só os documentos dentro do intervalo', async () => {
  const janela = instancia.janela;
  await buscarTermoComum(janela);

  await janela.getByRole('button', { name: 'Período' }).click();
  await janela.getByLabel('De', { exact: true }).fill('2026-02-01');
  await janela.getByLabel('Até', { exact: true }).fill('2026-07-01');
  await reenviarBusca(janela);

  await expect(janela.locator('.cartao')).toHaveCount(2);
  const nomes = await nomesDosCartoes(janela);
  expect(nomes.sort()).toEqual([DOC_BETA.nome, DOC_GAMA.nome].sort());
});

test('filtro de período sem correspondência mostra lista vazia', async () => {
  const janela = instancia.janela;
  await buscarTermoComum(janela);

  await janela.getByRole('button', { name: 'Período' }).click();
  await janela.getByLabel('De', { exact: true }).fill('2025-01-01');
  await janela.getByLabel('Até', { exact: true }).fill('2025-12-31');
  await reenviarBusca(janela);

  await expect(janela.locator('.cartao')).toHaveCount(0);
});

test('combinação de extensão e período aplica interseção, não união', async () => {
  const janela = instancia.janela;
  await buscarTermoComum(janela);

  // alfa (md) também está neste período, mas some por não ser pdf — prova de
  // que os dois filtros se combinam por E, não por OU.
  await janela.getByRole('button', { name: 'Período' }).click();
  await janela.getByLabel('De', { exact: true }).fill('2026-01-01');
  await janela.getByLabel('Até', { exact: true }).fill('2026-04-01');
  await janela.getByLabel('Extensão:').selectOption('pdf');
  await reenviarBusca(janela);

  await expect(janela.locator('.cartao')).toHaveCount(1);
  await expect(janela.locator('.cartao .cartao__nome')).toHaveText(DOC_BETA.nome);
});

test('cada critério de ordenação apresenta a lista na ordem esperada', async () => {
  const janela = instancia.janela;
  await buscarTermoComum(janela);

  const esperado: Record<string, string[]> = {
    'Nome (A–Z)': [DOC_ALFA.nome, DOC_BETA.nome, DOC_DELTA.nome, DOC_GAMA.nome],
    'Nome (Z–A)': [DOC_GAMA.nome, DOC_DELTA.nome, DOC_BETA.nome, DOC_ALFA.nome],
    'Data crescente': [DOC_ALFA.nome, DOC_BETA.nome, DOC_GAMA.nome, DOC_DELTA.nome],
    'Data decrescente': [DOC_DELTA.nome, DOC_GAMA.nome, DOC_BETA.nome, DOC_ALFA.nome]
  };

  for (const [opcao, ordem] of Object.entries(esperado)) {
    await janela.getByLabel('Ordenação').selectOption({ label: opcao });
    await expect(janela.locator('.cartao')).toHaveCount(4);
    await expect(janela.locator('.cartao .cartao__nome')).toHaveText(ordem);
  }
});

test('alternância "Buscar no conteúdo" só encontra o termo no corpo quando ligada', async () => {
  const janela = instancia.janela;

  const campoBusca = janela.getByRole('searchbox', { name: 'Buscar pelo nome do documento' });
  await campoBusca.fill(TERMO_SO_CONTEUDO);
  await reenviarBusca(janela);

  // Desligado (padrão): o termo só existe no conteúdo, não no nome — sem resultado.
  await expect(janela.locator('.cartao')).toHaveCount(0);

  // O clique no botão passa por `aoAlterarFiltros` (gated por credencial) e só
  // atualiza o estado local — por isso o reenvio do formulário é o que de fato
  // aplica o filtro à consulta.
  await janela.getByRole('button', { name: 'Buscar no conteúdo' }).click();
  await reenviarBusca(janela);

  await expect(janela.locator('.cartao')).toHaveCount(1);
  await expect(janela.locator('.cartao .cartao__nome')).toHaveText(DOC_SO_CONTEUDO.nome);
  await expect(janela.getByText('Encontrado no conteúdo')).toBeVisible();
});
