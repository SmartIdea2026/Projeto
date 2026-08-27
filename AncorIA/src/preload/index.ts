import { contextBridge, ipcRenderer } from 'electron';
import { CANAIS } from '../compartilhado/canais';
import type {
  Documento,
  DocumentoAcessado,
  Filtros,
  Fonte,
  ResultadoBusca,
  StatusFonte
} from '../compartilhado/tipos';

/**
 * Superfície exposta ao renderer.
 *
 * Esta é a fronteira da ADR-0003. Nenhuma função aqui devolve o valor de uma
 * credencial: `definirCredencial` recebe o segredo e responde apenas com o novo
 * status, e não existe operação de leitura de credencial. O renderer não tem
 * como obter um token, nem por engano.
 */
const api = {
  definirCredencial: (fonte: Fonte, valor: string): Promise<StatusFonte[]> =>
    ipcRenderer.invoke(CANAIS.credenciaisDefinir, fonte, valor),

  removerCredencial: (fonte: Fonte): Promise<StatusFonte[]> =>
    ipcRenderer.invoke(CANAIS.credenciaisRemover, fonte),

  status: (): Promise<StatusFonte[]> => ipcRenderer.invoke(CANAIS.credenciaisStatus),

  verificarCredenciais: (): Promise<StatusFonte[]> =>
    ipcRenderer.invoke(CANAIS.credenciaisVerificar),

  definirClienteDrive: (clientId: string): Promise<StatusFonte[]> =>
    ipcRenderer.invoke(CANAIS.driveDefinirCliente, clientId),

  autorizarDrive: (): Promise<StatusFonte[]> => ipcRenderer.invoke(CANAIS.driveAutorizar),

  buscar: (filtros: Filtros): Promise<ResultadoBusca> =>
    ipcRenderer.invoke(CANAIS.buscar, filtros),

  recentes: (filtros?: Filtros): Promise<ResultadoBusca> =>
    ipcRenderer.invoke(CANAIS.recentes, filtros),

  recentesDoCache: (filtros?: Filtros): Promise<ResultadoBusca | null> =>
    ipcRenderer.invoke(CANAIS.recentesDoCache, filtros),

  abrirDocumento: (documento: Documento): Promise<void> =>
    ipcRenderer.invoke(CANAIS.abrirDocumento, documento),

  documentosAcessados: (): Promise<DocumentoAcessado[]> =>
    ipcRenderer.invoke(CANAIS.documentosAcessados)
};

export type ApiAncorIA = typeof api;

contextBridge.exposeInMainWorld('ancoria', api);
