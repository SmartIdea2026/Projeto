import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/main/index.ts'),
          // Corpo do utilityProcess de transcrição de voz (ADR-0008). Entrada
          // separada: roda como processo próprio, não é importado pelo main.
          'voz-worker': resolve('src/main/voz/worker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve('src/preload/index.ts') } } }
  },
  renderer: {
    root: resolve('src/renderer'),
    plugins: [react()],
    resolve: { alias: { '@compartilhado': resolve('src/compartilhado') } },
    build: { rollupOptions: { input: { index: resolve('src/renderer/index.html') } } }
  }
});
