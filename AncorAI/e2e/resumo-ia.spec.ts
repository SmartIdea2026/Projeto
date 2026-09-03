import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { Documento } from '../src/compartilhado/tipos';
import { lancarApp, type AppE2E } from './apoio/lancarApp';
import { subirServidorGemini } from './apoio/servidorMockGemini';
import type { ServidorMock } from './apoio/servidorHttp';
import { semearComTexto } from './semear';

/**
 * Fluxo de resumo por IA — `PainelResumo.tsx` + `resumos.ts`.
 *
 * O documento é semeado com texto já local (`semearComTexto`, sem
 * `versaoConteudo`), então nenhum mock de GitHub é necessário — só o Gemini
 * (design.md - Decisão 3). A chave é salva pela tela de configurações contra
 * o mock, e o consentimento de envio é sempre exigido antes do primeiro
 * resumo, mesmo com a chave já configurada.
 */

const DOCUMENTO: Documento = {
  id: 'e2e-resumo-doc',
  nome: 'ata-resumo-e2e.md',
  extensao: 'md',
  fonte: 'github',
  dataModificacao: '2026-07-01T00:00:00.000Z',
  link: 'https://github.com/exemplo/resumo/blob/main/ata-resumo-e2e.md',
  repositorio: 'exemplo/resumo'
};

const TEXTO = 'Ata de reunião de planejamento do time, com decisões e próximos passos.';

const paraFechar: Array<{ fechar(): Promise<void> }> = [];

test.afterEach(async () => {
  await Promise.all(paraFechar.map((item) => item.fechar()));
  paraFechar.length = 0;
});

/** Semeia o documento, lança o app e salva a chave do Gemini pela UI. */
async function prepararComGemini(geminiUrl: string): Promise<AppE2E> {
  const diretorioDados = mkdtempSync(join(tmpdir(), 'ancorai-e2e-'));
  await semearComTexto(diretorioDados, { documento: DOCUMENTO, texto: TEXTO });

  const instancia = await lancarApp({ diretorioDados, geminiBaseUrl: geminiUrl });
  const janela = instancia.janela;

  await janela.getByRole('button', { name: 'Configurações', exact: true }).click();
  await janela.getByLabel('Chave da API do Gemini').fill('chave-e2e-valida');
  await janela.getByRole('button', { name: 'Salvar chave' }).click();
  await expect(janela.getByText('Modelo em uso:')).toBeVisible();
  await janela.getByRole('button', { name: 'Fechar' }).click();

  return instancia;
}

async function focarDocumento(instancia: AppE2E): Promise<void> {
  const janela = instancia.janela;
  await janela
    .getByRole('searchbox', { name: 'Buscar pelo nome do documento' })
    .fill('resumo-e2e');
  await janela.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(janela.locator('.cartao')).toHaveCount(1);
}

test('exige consentimento antes do primeiro resumo e gera o resumo ao permitir', async () => {
  const gemini: ServidorMock = await subirServidorGemini({
    gerar: {
      resumo: {
        resumo: 'Um resumo de teste gerado para o documento e2e.',
        categoria: 'Ata',
        assuntos: ['reuniao', 'planejamento'],
        destaques: ['Primeiro destaque.', 'Segundo destaque.']
      }
    }
  });
  paraFechar.push(gemini);
  const instancia = await prepararComGemini(gemini.url);
  paraFechar.push(instancia);
  const janela = instancia.janela;

  await focarDocumento(instancia);

  await expect(
    janela.getByText('texto dele é enviado ao Google Gemini')
  ).toBeVisible();
  await janela.getByRole('button', { name: 'Permitir e gerar resumos' }).click();

  await expect(janela.getByText('Um resumo de teste gerado para o documento e2e.')).toBeVisible();
  await expect(janela.getByText('reuniao, planejamento')).toBeVisible();
  await expect(janela.getByText('Primeiro destaque.')).toBeVisible();
  await expect(janela.getByText('Segundo destaque.')).toBeVisible();
});

test('cota excedida mostra o painel indisponível com opção de tentar novamente', async () => {
  const gemini: ServidorMock = await subirServidorGemini({ gerar: { status: 429 } });
  paraFechar.push(gemini);
  const instancia = await prepararComGemini(gemini.url);
  paraFechar.push(instancia);
  const janela = instancia.janela;

  await focarDocumento(instancia);
  await janela.getByRole('button', { name: 'Permitir e gerar resumos' }).click();

  await expect(
    janela.getByText('O limite de requisições da chave gratuita foi atingido.')
  ).toBeVisible();
  await expect(janela.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
});
