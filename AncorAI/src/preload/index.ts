import { contextBridge, ipcRenderer } from 'electron';
import { CANAIS } from '../compartilhado/canais';
import type {
  Documento,
  DocumentoAcessado,
  Filtros,
  Fonte,
  PreparoConteudo,
  ProgressoIngestao,
  RespostaResumo,
  ResultadoBusca,
  ResumoDocumento,
  StatusLLM,
  StatusFonte
} from '../compartilhado/tipos';

/**
 * Superfície exposta ao renderer.
 *
 * Esta é a fronteira das ADR-0003 e ADR-0005. Nenhuma função aqui devolve o
 * valor de uma credencial: `definirCredencial` recebe o segredo e responde
 * apenas com o novo status, e não existe operação de leitura de credencial. O
 * renderer não tem como obter um token, nem por engano.
 *
 * Pela mesma razão não existe operação de leitura de conteúdo. `indexarConteudo`
 * dispara a ingestão e responde com contagens; o texto dos documentos não é
 * alcançável a partir daqui.
 */
const api = {
  definirCredencial: (fonte: Fonte, valor: string): Promise<StatusFonte[]> =>
    ipcRenderer.invoke(CANAIS.credenciaisDefinir, fonte, valor),

  removerCredencial: (fonte: Fonte): Promise<StatusFonte[]> =>
    ipcRenderer.invoke(CANAIS.credenciaisRemover, fonte),

  status: (): Promise<StatusFonte[]> => ipcRenderer.invoke(CANAIS.credenciaisStatus),

  verificarCredenciais: (): Promise<StatusFonte[]> =>
    ipcRenderer.invoke(CANAIS.credenciaisVerificar),

  buscar: (filtros: Filtros): Promise<ResultadoBusca> =>
    ipcRenderer.invoke(CANAIS.buscar, filtros),

  recentes: (filtros?: Filtros): Promise<ResultadoBusca> =>
    ipcRenderer.invoke(CANAIS.recentes, filtros),

  recentesDoCache: (filtros?: Filtros): Promise<ResultadoBusca | null> =>
    ipcRenderer.invoke(CANAIS.recentesDoCache, filtros),

  reordenar: (filtros: Filtros): Promise<ResultadoBusca> =>
    ipcRenderer.invoke(CANAIS.reordenar, filtros),

  detalharDocumentos: (documentos: Documento[]): Promise<Documento[]> =>
    ipcRenderer.invoke(CANAIS.detalharDocumentos, documentos),

  indexarConteudo: (): Promise<ProgressoIngestao> =>
    ipcRenderer.invoke(CANAIS.indexarConteudo),

  definirChaveLLM: (valor: string): Promise<StatusLLM> =>
    ipcRenderer.invoke(CANAIS.llmDefinir, valor),

  removerChaveLLM: (): Promise<StatusLLM> => ipcRenderer.invoke(CANAIS.llmRemover),

  statusLLM: (): Promise<StatusLLM> => ipcRenderer.invoke(CANAIS.llmStatus),

  consentirEnvio: (valor: boolean): Promise<StatusLLM> =>
    ipcRenderer.invoke(CANAIS.llmConsentir, valor),

  resumoDoDocumento: (documento: Documento, regerar?: boolean): Promise<RespostaResumo> =>
    ipcRenderer.invoke(CANAIS.resumoDoDocumento, documento, regerar),

  resumoGravado: (documento: Documento): Promise<ResumoDocumento | null> =>
    ipcRenderer.invoke(CANAIS.resumoGravado, documento),

  prepararConteudo: (documento: Documento): Promise<PreparoConteudo> =>
    ipcRenderer.invoke(CANAIS.prepararConteudo, documento),

  abrirDocumento: (documento: Documento): Promise<void> =>
    ipcRenderer.invoke(CANAIS.abrirDocumento, documento),

  documentosAcessados: (): Promise<DocumentoAcessado[]> =>
    ipcRenderer.invoke(CANAIS.documentosAcessados)
};

export type ApiAncorAI = typeof api;

contextBridge.exposeInMainWorld('ancorai', api);
