import { app, BrowserWindow } from 'electron';
import { abrirBanco, fecharBanco } from './banco/repositorio';
import { inicializarCofre } from './credenciais/cofre';
import { registrarCanais } from './ipc';
import { criarJanela } from './janela';

/**
 * Ponto de entrada do processo principal.
 *
 * Cuida apenas do ciclo de vida da aplicação. A criação da janela está em
 * `janela.ts` e o registro dos canais IPC em `ipc.ts`.
 */

void app.whenReady().then(async () => {
  // O cofre e o banco precisam existir antes de qualquer canal responder.
  inicializarCofre(app.getPath('userData'));
  await abrirBanco(app.getPath('userData'));

  registrarCanais();
  criarJanela();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', fecharBanco);
