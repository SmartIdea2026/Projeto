import { expect, test } from '@playwright/test';
import { lancarApp, type AppE2E } from './apoio/lancarApp';
import { subirServidorGithub } from './apoio/servidorMockGithub';
import type { ServidorMock } from './apoio/servidorHttp';

/**
 * Fluxo de sincronização do acervo — `BotaoSincronizar.tsx` + `ingerirAcervo()`
 * (`conteudo/ingestao.ts`). É o único fluxo desta suíte que precisa exercitar
 * `github.ts` de ponta a ponta: listagem de repositórios, árvore, autoria e
 * conteúdo de blob (design.md - Decisão 2).
 *
 * A credencial é salva pela tela de configurações contra o mock, não semeada
 * diretamente (design.md - Decisão 5a) — o que agora funciona de verdade
 * graças a `lancarApp` (Decisão 5b).
 */

const REPO = {
  name: 'sincroniza',
  full_name: 'exemplo/sincroniza',
  default_branch: 'main',
  owner: { login: 'exemplo' },
  pushed_at: '2026-08-01T00:00:00.000Z'
};

const paraFechar: Array<{ fechar(): Promise<void> }> = [];

test.afterEach(async () => {
  await Promise.all(paraFechar.map((item) => item.fechar()));
  paraFechar.length = 0;
});

async function conectarGithub(instancia: AppE2E): Promise<void> {
  const janela = instancia.janela;
  await janela.getByRole('button', { name: 'Configurações', exact: true }).click();
  await janela.getByLabel('Token do GitHub').fill('ghp_token-sincronizacao');
  await janela.getByRole('button', { name: 'Salvar token' }).click();
  await expect(janela.getByText('Conectada')).toBeVisible();
  await janela.getByRole('button', { name: 'Fechar' }).click();
}

test('sincronização completa ingere o documento do mock e conclui', async () => {
  const github: ServidorMock = await subirServidorGithub({
    usuario: { login: 'fulana-e2e' },
    repositorios: { itens: [REPO] },
    arvores: { 'exemplo/sincroniza:main': { arquivos: [{ path: 'nota.md', sha: 'sha-nota' }] } },
    autoria: { 'exemplo/sincroniza\nnota.md': { autor: 'fulana', data: '2026-08-02T00:00:00.000Z' } },
    blobs: { 'sha-nota': '# Nota\n\nConteúdo de teste para a sincronização e2e.' }
  });
  paraFechar.push(github);
  const instancia = await lancarApp({ githubBaseUrl: github.url });
  paraFechar.push(instancia);
  const janela = instancia.janela;

  await conectarGithub(instancia);

  const botao = janela.getByRole('button', { name: 'Sincronizar o acervo de documentos' });
  await botao.click();

  // Otimista: o botão já indica "em andamento" antes de qualquer resposta do mock.
  await expect(botao).toHaveAttribute('data-estado', 'em-andamento');

  await expect(botao).toHaveAttribute('data-estado', 'concluida');
  await expect(janela.getByText('Acervo sincronizado')).toBeVisible();
  await expect(
    janela.getByText('1 documento(s): 1 com texto obtido, 0 reaproveitado(s), 0 sem texto, 0 falha(s)')
  ).toBeVisible();
});

test('falha ao obter o inventário suspende a sincronização com o motivo correto', async () => {
  const github: ServidorMock = await subirServidorGithub({
    usuario: { login: 'fulana-e2e' },
    repositorios: { status: 401 }
  });
  paraFechar.push(github);
  const instancia = await lancarApp({ githubBaseUrl: github.url });
  paraFechar.push(instancia);
  const janela = instancia.janela;

  await conectarGithub(instancia);

  const botao = janela.getByRole('button', { name: 'Sincronizar o acervo de documentos' });
  await botao.click();

  await expect(botao).toHaveAttribute('data-estado', 'suspensa');
  await expect(
    janela.getByText('Não foi possível obter a lista de documentos do GitHub.')
  ).toBeVisible();
});
