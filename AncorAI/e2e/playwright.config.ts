import { defineConfig } from '@playwright/test';

/**
 * Config mínima para a PoC de viabilidade do Playwright (ver
 * openspec/changes/poc-viabilidade-playwright/).
 *
 * Sem `webServer`/`baseURL`: o alvo é o app Electron real, lançado dentro do
 * próprio teste via `_electron.launch()` — não um browser apontando para uma URL.
 */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  // `fullyParallel: false` só serializa os testes DENTRO de um arquivo; o
  // Playwright ainda usa vários workers entre arquivos por padrão. Com vários
  // processos Electron lançados ao mesmo tempo (ver `apoio/lancarApp.ts`),
  // isso expôs uma corrida real na alocação de porta de depuração remota
  // (duas instâncias resolvendo a mesma porta livre entre o teste e o bind do
  // Electron). Um worker mantém a suíte inteira serial e determinística —
  // aceitável dado o volume de testes desta suíte (ver design.md - Trade-offs).
  workers: 1
});