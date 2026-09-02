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
  reporter: 'list'
});
