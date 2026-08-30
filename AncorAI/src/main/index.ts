import { app, BrowserWindow } from 'electron';
import { abrirBanco, fecharBanco } from './banco/repositorio';
import { inicializarCofre } from './credenciais/cofre';
import { ingerirAcervo } from './conteudo/ingestao';
import { registrarCanais } from './ipc';
import { inicializarInstrucao } from './llm/instrucao';
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

  // A instrução de redação do resumo é lida do disco, não embutida no código.
  // Empacotada, ela vem em `resources/`; em desenvolvimento, da raiz do projeto.
  inicializarInstrucao(process.resourcesPath, app.getAppPath());

  registrarCanais();
  criarJanela();

  // A ingestão do conteúdo roda em segundo plano, sem bloquear a abertura.
  // Ela cede a vez a qualquer busca em andamento, então começar já é seguro:
  // a rotina de inicialização atende primeiro. Falhas viram `suspensa` no
  // resultado e não sobem como exceção — um acervo que não pôde ser ingerido
  // não é motivo para a aplicação deixar de abrir.
  void ingerirAcervo();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', fecharBanco);
