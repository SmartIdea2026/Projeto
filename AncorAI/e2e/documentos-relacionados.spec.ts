import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Documento } from '../src/compartilhado/tipos';
import { lancarApp, type AppE2E } from './apoio/lancarApp';
import { semearComResumo } from './semear';

/**
 * Fluxo de documentos relacionados — `pilha.ts` + o bloco "Documentos
 * relacionados" de `PainelResumo.tsx`. Puramente local (rótulos já gravados
 * no NeDB via `semearComResumo`): nenhum mock de rede é necessário
 * (design.md - Decisão 2/3).
 */

const DOC_A: Documento = {
  id: 'e2e-rel-a',
  nome: 'ata-relacionados-a.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-01-10T00:00:00.000Z',
  link: 'https://github.com/exemplo/relacionados/blob/main/a.md',
  repositorio: 'exemplo/relacionados'
};

const DOC_B: Documento = {
  id: 'e2e-rel-b',
  nome: 'ata-relacionados-b.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-01-11T00:00:00.000Z',
  link: 'https://github.com/exemplo/relacionados/blob/main/b.md',
  repositorio: 'exemplo/relacionados'
};

const DOC_C: Documento = {
  id: 'e2e-rel-c',
  nome: 'relatorio-relacionados-c.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-01-12T00:00:00.000Z',
  link: 'https://github.com/exemplo/relacionados/blob/main/c.md',
  repositorio: 'exemplo/relacionados'
};

let instancia: AppE2E;

test.beforeEach(async () => {
  const diretorioDados = mkdtempSync(join(tmpdir(), 'ancorai-e2e-'));

  // A e B compartilham 2 assuntos (o mínimo exigido por `MIN_ASSUNTOS_EM_COMUM`
  // sem um assunto raro) — C não compartilha nenhum com A.
  await semearComResumo(diretorioDados, {
    documento: DOC_A,
    resumo: 'Resumo do documento A.',
    categoria: 'Ata',
    assuntos: ['orcamento', 'planejamento', 'equipe'],
    destaques: ['Destaque A.']
  });
  await semearComResumo(diretorioDados, {
    documento: DOC_B,
    resumo: 'Resumo do documento B.',
    categoria: 'Ata',
    assuntos: ['orcamento', 'planejamento'],
    destaques: ['Destaque B.']
  });
  await semearComResumo(diretorioDados, {
    documento: DOC_C,
    resumo: 'Resumo do documento C.',
    categoria: 'Relatório',
    assuntos: ['viagem', 'ferias'],
    destaques: ['Destaque C.']
  });

  instancia = await lancarApp({ diretorioDados });
});

test.afterEach(async () => {
  await instancia.fechar();
});

test('a pilha lista o documento com assuntos em comum e não lista o sem relação', async () => {
  const janela = instancia.janela;

  await janela
    .getByRole('searchbox', { name: 'Buscar pelo nome do documento' })
    .fill('relacionados-a');
  await janela.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(janela.locator('.cartao')).toHaveCount(1);

  // O consentimento bloqueia a exibição do painel mesmo com o resumo já
  // gravado (`App.tsx` força o motivo `sem-consentimento` independente de
  // `resumo` já estar carregado) — depois de consentir, o resumo já gravado
  // aparece direto, sem gerar nada de novo (sem mock de Gemini).
  await janela.getByRole('button', { name: 'Permitir e gerar resumos' }).click();
  await expect(janela.getByText('Resumo do documento A.')).toBeVisible();

  const pilha = janela.locator('.painel__pilha');
  await expect(pilha.getByRole('button', { name: DOC_B.nome })).toBeVisible();
  await expect(pilha.getByRole('button', { name: DOC_C.nome })).not.toBeVisible();
});

test('clicar em um item da pilha leva aquele documento ao painel sem alterar a lista de resultados', async () => {
  const janela = instancia.janela;

  await janela
    .getByRole('searchbox', { name: 'Buscar pelo nome do documento' })
    .fill('relacionados-a');
  await janela.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(janela.locator('.cartao')).toHaveCount(1);

  await janela.getByRole('button', { name: 'Permitir e gerar resumos' }).click();
  await janela.locator('.painel__pilha').getByRole('button', { name: DOC_B.nome }).click();

  await expect(janela.getByRole('heading', { name: DOC_B.nome })).toBeVisible();
  await expect(janela.getByText('Resumo do documento B.')).toBeVisible();
  // A lista de resultados da busca continua com o mesmo documento (A).
  await expect(janela.locator('.cartao')).toHaveCount(1);
  await expect(janela.locator('.cartao .cartao__nome')).toHaveText(DOC_A.nome);
});
