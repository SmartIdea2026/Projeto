import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';

/** Fundo creme da identidade visual, aplicado também à janela (ui-spec §6). */
const FUNDO = '#F4F2EA';

export function criarJanela(): BrowserWindow {
  const janela = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: FUNDO,
    title: 'AncorAI',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // A fronteira de segurança da ADR-0003 depende destes três ajustes: o
      // renderer não acessa Node, e só enxerga a API exposta pelo preload.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Evita o clarão branco entre abrir a janela e a interface renderizar.
  janela.once('ready-to-show', () => janela.show());

  // Links externos abrem no navegador, nunca dentro da janela da aplicação.
  janela.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    void janela.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void janela.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return janela;
}
