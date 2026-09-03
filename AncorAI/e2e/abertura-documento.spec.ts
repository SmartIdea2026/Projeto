import { expect, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBanco, fecharBanco, listarAcessados } from '../src/main/banco/repositorio';
import { lancarApp, type AppE2E } from './apoio/lancarApp';
import { NOME_DOCUMENTO_ALVO, semearAcervo, TERMO_DISTINTIVO } from './semear';

/**
 * Fluxo de abertura de documento — `documento:abrir` (`ipc.ts`).
 *
 * Sem mock de rede: fluxo puramente local. `shell.openExternal` é desligado
 * sob `ANCORAI_E2E_USER_DATA_DIR` (design.md - Decisão 4) para não abrir um
 * navegador de verdade; o efeito verificável é o registro de acesso, lido
 * diretamente do NeDB — não há nenhuma superfície na UI para
 * `documentosAcessados` hoje (mesma decisão).
 */

let instancia: AppE2E;
let diretorioDados: string;

test.beforeEach(async () => {
  diretorioDados = mkdtempSync(join(tmpdir(), 'ancorai-e2e-'));
  await semearAcervo(diretorioDados);
  instancia = await lancarApp({ diretorioDados });
});

test.afterEach(async () => {
  await instancia.fechar();
});

test('abrir um documento registra o acesso sem apresentar o link como falha', async () => {
  const janela = instancia.janela;

  await janela
    .getByRole('searchbox', { name: 'Buscar pelo nome do documento' })
    .fill(TERMO_DISTINTIVO);
  await janela.getByRole('button', { name: 'Buscar', exact: true }).click();

  const cartao = janela.locator('.cartao', { hasText: NOME_DOCUMENTO_ALVO });
  await expect(cartao).toBeVisible();
  await cartao.getByRole('button', { name: 'Abrir em', exact: false }).click();

  // Sem indicador de erro na tela: o clique não deve produzir um estado de falha visível.
  await expect(janela.getByRole('alert')).toHaveCount(0);

  await abrirBanco(diretorioDados);
  const acessados = await listarAcessados();
  fecharBanco();

  expect(acessados.map((item) => item.nome)).toContain(NOME_DOCUMENTO_ALVO);
});
