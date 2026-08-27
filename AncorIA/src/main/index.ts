import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { CANAIS } from '../compartilhado/canais';
import type { Documento, Filtros, Fonte } from '../compartilhado/tipos';
import { FILTROS_PADRAO } from '../compartilhado/tipos';
import { abrirBanco, fecharBanco, listarAcessados, registrarAcesso } from './banco/indice';
import * as cofre from './credenciais/cofre';
import * as servico from './fontes/servico';
import { autorizar, esquecerAcesso } from './oauth/google';

/** Fundo creme da identidade visual, aplicado também à janela (ui-spec §6). */
const FUNDO = '#F4F2EA';

function criarJanela(): void {
  const janela = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: FUNDO,
    title: 'AncorIA',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // A fronteira de segurança da ADR-0003 depende destes três ajustes: o
      // renderer não acessa Node, e só enxerga a API exposta pelo preload.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

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
}

function registrarCanais(): void {
  ipcMain.handle(
    CANAIS.credenciaisDefinir,
    async (_evento, fonte: Fonte, valor: string) => {
      if (fonte === 'github') {
        // Valida antes de gravar: evita persistir uma credencial que já se sabe
        // inválida e permite devolver o erro imediatamente ao usuário.
        await servico.validarTokenGithub(valor);
        cofre.definir('github.token', valor);
      } else {
        cofre.definir('drive.clientId', valor);
      }
      return servico.status();
    }
  );

  ipcMain.handle(CANAIS.credenciaisRemover, async (_evento, fonte: Fonte) => {
    if (fonte === 'github') {
      cofre.remover('github.token');
    } else {
      cofre.remover('drive.clientId');
      cofre.remover('drive.refreshToken');
      esquecerAcesso();
    }
    return servico.status();
  });

  ipcMain.handle(CANAIS.credenciaisStatus, () => servico.status());
  ipcMain.handle(CANAIS.credenciaisVerificar, () => servico.status(false));

  ipcMain.handle(CANAIS.driveDefinirCliente, async (_evento, clientId: string) => {
    cofre.definir('drive.clientId', clientId);
    return servico.status();
  });

  ipcMain.handle(CANAIS.driveAutorizar, async () => {
    const clientId = cofre.obter('drive.clientId');
    if (!clientId) {
      throw new Error('Informe o Client ID do Google antes de conectar.');
    }
    const refreshToken = await autorizar(clientId);
    cofre.definir('drive.refreshToken', refreshToken);
    await servico.validarDrive(clientId, refreshToken);
    return servico.status();
  });

  ipcMain.handle(CANAIS.buscar, (_evento, filtros: Filtros) =>
    servico.buscar({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.recentes, (_evento, filtros?: Filtros) =>
    servico.recentes({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.recentesDoCache, (_evento, filtros?: Filtros) =>
    servico.recentesDoCache({ ...FILTROS_PADRAO, ...filtros })
  );

  ipcMain.handle(CANAIS.abrirDocumento, async (_evento, documento: Documento) => {
    await registrarAcesso(documento);
    await shell.openExternal(documento.link);
  });

  ipcMain.handle(CANAIS.documentosAcessados, () => listarAcessados());
}

void app.whenReady().then(async () => {
  cofre.inicializarCofre(app.getPath('userData'));
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
