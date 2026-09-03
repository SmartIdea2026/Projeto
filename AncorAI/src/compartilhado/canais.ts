/**
 * Nomes dos canais IPC expostos pelo processo main.
 *
 * A fronteira de segurança do sistema é esta lista. Nenhum canal devolve o
 * valor de uma credencial ao renderer (ADR-0003): `credenciais:status` retorna
 * apenas o estado da conexão, e `credenciais:definir` é unidirecional quanto ao
 * segredo — recebe, nunca devolve.
 *
 * Nenhum canal devolve o conteúdo ou o texto de um documento (ADR-0005). O
 * sistema tem acesso ao texto; o usuário final, não. `conteudo:indexar` informa
 * o andamento em contagens, e nada além disso.
 */
export const CANAIS = {
  /** Grava uma credencial. Recebe o segredo; devolve apenas o novo status. */
  credenciaisDefinir: 'credenciais:definir',
  /** Remove a credencial de uma fonte. */
  credenciaisRemover: 'credenciais:remover',
  /** Estado das fontes. Nunca inclui o valor das credenciais. */
  credenciaisStatus: 'credenciais:status',
  /** Revalida as credenciais contra as APIs, ignorando o cache de validação. */
  credenciaisVerificar: 'credenciais:verificar',

  /** Executa uma busca com os filtros informados. */
  buscar: 'busca:executar',
  /** Documentos modificados recentemente em cada fonte configurada. */
  recentes: 'busca:recentes',
  /** Resultado guardado da rotina anterior, para exibição imediata. */
  recentesDoCache: 'busca:recentes-cache',
  /**
   * Reorganiza o resultado já obtido, sem consultar as fontes.
   *
   * Existe porque a especificação exige duas coisas ao mesmo tempo: que a
   * ordenação valha para o resultado inteiro e que trocá-la não gaste cota. O
   * renderer só recebe a página, então quem reordena precisa ser quem tem o
   * conjunto completo em mãos.
   */
  reordenar: 'busca:reordenar',

  /** Autoria e data real dos documentos da página apresentada. */
  detalharDocumentos: 'busca:detalhar',

  /**
   * Dispara a ingestão do conteúdo e devolve **apenas contagens**.
   *
   * O conteúdo dos documentos não atravessa esta fronteira em canal algum
   * (ADR-0005). Este é o único canal que a ingestão expõe, e a resposta dele
   * é a razão de existir de `ProgressoIngestao`: há o que informar sobre o
   * andamento sem informar nada sobre o que foi lido.
   */
  indexarConteudo: 'conteudo:indexar',

  /**
   * Retrato do andamento da sincronização do acervo.
   *
   * Canal de leitura: devolve estado e contagens (`RetratoSincronizacao`), e
   * nada além disso. Como `indexarConteudo`, não atravessa a fronteira da
   * ADR-0005 — o que foi lido dos documentos não acompanha o retrato.
   */
  sincronizacaoEstado: 'sincronizacao:estado',

  /** Grava a chave da LLM. Recebe o segredo; devolve apenas o novo status. */
  llmDefinir: 'llm:definir',
  /** Remove a chave da LLM. */
  llmRemover: 'llm:remover',
  /** Estado do serviço de linguagem. Nunca inclui o valor da chave. */
  llmStatus: 'llm:status',
  /** Registra a decisão do usuário sobre enviar conteúdo a serviço externo. */
  llmConsentir: 'llm:consentir',

  /**
   * Resumo de um documento, gerando-o se necessário.
   *
   * Devolve o resumo produzido pela IA — nunca o texto do documento de onde ele
   * foi extraído. A distinção é a fronteira da ADR-0005.
   */
  resumoDoDocumento: 'resumo:documento',
  /** Resumo já gravado, sem gerar nada nem consumir cota. */
  resumoGravado: 'resumo:gravado',
  /**
   * Garante o texto do documento localmente e informa se já há resumo.
   *
   * Devolve situação, nunca texto. Existe para que a interface distinga a
   * etapa de leitura da etapa de geração sem inventar a transição.
   */
  prepararConteudo: 'resumo:preparar',

  /**
   * Pilha de documentos relacionados ao documento em foco.
   *
   * Canal de leitura, calculado sob demanda a partir dos rótulos de
   * classificação (`assuntos`, `tipo`) já gravados. Devolve identificação, nome
   * e link de cada item — nunca o texto de onde os rótulos saíram (ADR-0005).
   */
  relacionadosDoDocumento: 'relacoes:documento',

  /** Abre o documento na fonte original e registra o acesso. */
  abrirDocumento: 'documento:abrir',
  /** Lista os documentos acessados anteriormente. */
  documentosAcessados: 'documento:acessados',

  /**
   * Transcreve um trecho de áudio capturado na busca por voz (ADR-0008).
   *
   * Recebe PCM (16 kHz mono) e devolve **o texto da fala do próprio usuário** —
   * não o conteúdo de um documento. A restrição da ADR-0005 é sobre o texto dos
   * documentos do acervo; um termo ditado é da mesma natureza de um termo
   * digitado. O áudio é processado localmente e descartado; não sai da máquina.
   */
  vozTranscrever: 'voz:transcrever',
  /** Estado do modelo de voz, da permissão de microfone e da ativação do recurso. */
  vozModeloEstado: 'voz:modelo-estado',
  /** Liga/desliga a busca por voz; ligar dispara o download do modelo. */
  vozAtivar: 'voz:ativar',
  /**
   * Ajusta o microfone da busca por voz: consentimento do primeiro uso e qual
   * dispositivo captar. Recebe `AjusteMicrofoneVoz`, devolve o `EstadoVoz`
   * atualizado — nunca áudio nem transcrição.
   */
  vozMicrofone: 'voz:microfone'
} as const;

export type Canal = (typeof CANAIS)[keyof typeof CANAIS];

/**
 * Eventos emitidos pelo processo principal para o renderer (`webContents.send`).
 *
 * Ficam fora de `CANAIS` de propósito: aquela lista é só de canais `handle`
 * (pedido → resposta), e é isso que o teste de fronteira `fronteira-conteudo`
 * percorre. Um evento não tem handler para percorrer.
 */
export const EVENTOS_VOZ = {
  /** Andamento do download do modelo de voz: `{ recebidos, total, arquivo }`. */
  modeloProgresso: 'voz:modelo-progresso'
} as const;
