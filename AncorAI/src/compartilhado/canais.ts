/**
 * Nomes dos canais IPC expostos pelo processo main.
 *
 * A fronteira de segurança do sistema é esta lista (ADR-0003): nenhum canal
 * devolve o valor de uma credencial ao renderer. `credenciais:status` retorna
 * apenas o estado da conexão, e `credenciais:definir` é unidirecional quanto ao
 * segredo — recebe, nunca devolve.
 */
export const CANAIS = {
  /** Grava uma credencial. Recebe o segredo; devolve apenas o novo status. */
  credenciaisDefinir: 'credenciais:definir',
  /** Remove a credencial de uma fonte. */
  credenciaisRemover: 'credenciais:remover',
  /** Estado das duas fontes. Nunca inclui o valor das credenciais. */
  credenciaisStatus: 'credenciais:status',
  /** Revalida as credenciais contra as APIs, ignorando o cache de validação. */
  credenciaisVerificar: 'credenciais:verificar',

  /** Inicia o fluxo OAuth do Google Drive e aguarda o consentimento. */
  driveAutorizar: 'drive:autorizar',
  /** Grava o Client ID do cliente OAuth do tipo Desktop app. */
  driveDefinirCliente: 'drive:definir-cliente',

  /** Executa uma busca com os filtros informados. */
  buscar: 'busca:executar',
  /** Documentos modificados recentemente em cada fonte configurada. */
  recentes: 'busca:recentes',
  /** Resultado guardado da rotina anterior, para exibição imediata. */
  recentesDoCache: 'busca:recentes-cache',

  /** Abre o documento na fonte original e registra o acesso. */
  abrirDocumento: 'documento:abrir',
  /** Lista os documentos acessados anteriormente. */
  documentosAcessados: 'documento:acessados'
} as const;

export type Canal = (typeof CANAIS)[keyof typeof CANAIS];
