/**
 * Tipos compartilhados entre os processos main, preload e renderer.
 *
 * Nenhum tipo aqui carrega credencial: o renderer nunca recebe o valor de um
 * token, apenas o estado da conexão (ADR-0003).
 */

/**
 * Fontes de documentos disponíveis.
 *
 * O Google Drive foi retirado do MVP (ADR-0004): o escopo `drive.readonly` é
 * restrito pelo Google e exigiria avaliação de segurança para ser publicado.
 * O tipo segue sendo uma união, e toda a orquestração continua plural, para que
 * uma segunda fonte volte a caber sem reescrever a busca.
 */
export type Fonte = 'github';

/** Extensões aceitas, conforme a ata de 24/08/2026 e o design, seção 5. */
export const EXTENSOES_ACEITAS = [
  'md',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'pdf',
  'epub',
  'txt'
] as const;

export type ExtensaoAceita = (typeof EXTENSOES_ACEITAS)[number];

/** Formato unificado para documentos das duas fontes (design, seção 4). */
export interface Documento {
  id: string;
  nome: string;
  extensao: string;
  fonte: Fonte;
  /** ISO 8601. Campo canônico de ordenação temporal. */
  dataModificacao: string;
  /** ISO 8601. Ausente no GitHub, que não expõe data de criação por arquivo. */
  dataCriacao?: string;
  /** URL de redirecionamento para a fonte original. */
  link: string;
  /**
   * Verdadeiro quando `dataModificacao` é aproximada, e não a data real de
   * alteração do arquivo.
   *
   * A árvore Git não carrega data por arquivo, então a busca no GitHub usa o
   * `pushed_at` do repositório: todos os documentos de um mesmo repositório
   * recebem a mesma data. Obter a data real exigiria uma requisição por
   * arquivo, custo que o design descartou. A lista de recentes não tem essa
   * limitação, porque vem dos commits.
   */
  dataAproximada?: boolean;
  /**
   * Quem realizou a última alteração.
   *
   * Identifica o autor do último commit que tocou o arquivo — que pode ter
   * apenas movido ou reformatado o documento. É autoria da alteração, não
   * autoria intelectual, e a interface rotula assim.
   */
  autor?: string;
  /** Caminho dentro do repositório, quando a fonte é o GitHub. */
  caminho?: string;
  /** Repositório de origem, quando a fonte é o GitHub. */
  repositorio?: string;
  /**
   * Identidade do conteúdo do documento na fonte.
   *
   * No GitHub é o `sha` do blob, que é o hash do próprio conteúdo: muda
   * exatamente quando os bytes mudam, e não muda quando o arquivo é apenas
   * tocado por um commit vizinho. É por isso que ele, e não a data, decide se
   * o texto já armazenado ainda vale — `dataModificacao` no inventário é o
   * `pushed_at` do repositório, igual para todos os arquivos dele, e avançaria
   * para o acervo inteiro a cada push (ver `dataAproximada`).
   *
   * Ausente nos documentos que vêm dos commits, que não passam pela árvore.
   */
  versaoConteudo?: string;
  /**
   * Tamanho do arquivo em bytes, quando a fonte o informa.
   *
   * Vem junto do inventário, o que permite descartar um arquivo grande demais
   * sem gastar requisição alguma para descobrir o tamanho.
   */
  tamanho?: number;
  /**
   * Tipo do documento identificado pela classificação por IA (`indice-local`),
   * como "ata" ou "especificação". Ausente para documento ainda não
   * classificado — a busca continua alcançando-o pelo nome.
   */
  tipo?: string;
  /** Assuntos identificados pela classificação por IA, para a busca por contexto. */
  assuntos?: string[];
  /** Etiquetas identificadas pela classificação por IA, para a busca por contexto. */
  etiquetas?: string[];
}

export type Ordenacao = 'a-z' | 'z-a' | 'data-asc' | 'data-desc';

export interface Filtros {
  termo: string;
  /** Página desejada, começando em 1. Ausente significa a primeira. */
  pagina?: number;
  /** Lista vazia significa todas as fontes (RN04). */
  fontes: Fonte[];
  /** Lista vazia significa todas as extensões aceitas. */
  extensoes: string[];
  dataInicial?: string;
  dataFinal?: string;
  ordenacao: Ordenacao;
}

export const FILTROS_PADRAO: Filtros = {
  termo: '',
  fontes: [],
  extensoes: [],
  ordenacao: 'data-desc'
};

/**
 * Estado da conexão de uma fonte.
 *
 * `invalida` e `sem-conexao` são estados distintos de propósito: o usuário
 * precisa saber se deve corrigir a credencial ou verificar a rede.
 */
export type EstadoConexao =
  | 'conectada'
  | 'invalida'
  | 'nao-configurada'
  | 'sem-conexao'
  | 'verificando';

export interface StatusFonte {
  fonte: Fonte;
  estado: EstadoConexao;
  /** Identificação legível da conta conectada, quando disponível. */
  conta?: string;
  mensagem?: string;
}

/** Falha atribuída a uma fonte específica, para o aviso parcial (CB05). */
export interface FalhaFonte {
  fonte: Fonte;
  mensagem: string;
  /** Verdadeiro quando a fonte recusou por limite de requisições. */
  limiteExcedido?: boolean;
}

/**
 * Aviso de resultado incompleto ou impreciso.
 *
 * Distinto de `FalhaFonte`: a consulta funcionou e trouxe documentos, mas não
 * necessariamente todos, ou não com a precisão que o filtro pressupõe. A
 * separação importa porque a interface trata ausência total de resultado e
 * resultado parcial de formas diferentes.
 */
export interface AvisoFonte {
  fonte: Fonte;
  mensagem: string;
}

/** Quantidade de documentos apresentados por página. */
export const POR_PAGINA = 10;

export interface ResultadoBusca {
  /** Apenas a fatia apresentada, com no máximo `POR_PAGINA` documentos. */
  documentos: Documento[];
  /**
   * Total encontrado na consulta, e não o tamanho da página.
   *
   * O contador da interface precisa do total: informar o tamanho da fatia diria
   * sempre "10 resultados" a partir da décima primeira correspondência.
   */
  total: number;
  /** Página apresentada, começando em 1. */
  pagina: number;
  falhas: FalhaFonte[];
  /** Resultados vieram, mas podem estar incompletos ou imprecisos. */
  avisos: AvisoFonte[];
  /** Verdadeiro quando os dados vieram do cache local, sem consultar a rede. */
  doCache: boolean;
}

/**
 * Andamento da ingestão de conteúdo.
 *
 * São contagens e mensagens do sistema — nunca texto de documento. O conteúdo
 * fica confinado ao processo principal (ADR-0005), e este tipo existe
 * justamente para que haja o que devolver ao renderer sem devolver conteúdo.
 */
export interface ProgressoIngestao {
  /** Documentos do inventário considerados. */
  total: number;
  /** Documentos cujo texto foi obtido e gravado agora. */
  ingeridos: number;
  /** Documentos cujo registro já estava vigente e foi reaproveitado. */
  reaproveitados: number;
  /** Documentos registrados sem texto: formato não lido, vazio ou grande demais. */
  semTexto: number;
  /** Documentos em que a obtenção ou a leitura falhou. */
  falhas: number;
  suspensa: boolean;
  /** Mensagem do sistema explicando a suspensão, quando houver. */
  motivoSuspensao?: string;
}

/**
 * Resumo de um documento produzido por modelo de linguagem.
 *
 * `tipo`, `assuntos` e `destaques` vêm da **mesma** submissão que produz o
 * resumo em prosa: pedir separadamente custaria mais cota e abriria espaço
 * para os quatro discordarem entre si.
 */
export interface ResumoDocumento {
  documentoId: string;
  resumo: string;
  tipo: string;
  assuntos: string[];
  destaques: string[];
  /** ISO 8601. */
  geradoEm: string;
  /** O conteúdo mudou na fonte depois que o resumo foi gerado. */
  desatualizado: boolean;
  /** O texto de origem havia sido cortado no limite por documento. */
  baseTruncada: boolean;
}

/**
 * Por que não há resumo a apresentar.
 *
 * Os motivos são distintos porque exigem coisas distintas de quem lê:
 * configurar uma chave, corrigir uma chave, esperar, ou nada — no caso de um
 * documento que simplesmente não tem texto.
 */
export type MotivoSemResumo =
  | 'sem-credencial'
  | 'credencial-invalida'
  | 'cota-excedida'
  | 'sem-conexao'
  | 'sem-consentimento'
  | 'sem-texto'
  | 'falha';

/**
 * Resultado de preparar o texto de um documento para o resumo.
 *
 * Existe para que a interface possa distinguir **duas etapas reais** —
 * obter o texto e submetê-lo à LLM — em vez de inventar a transição entre
 * elas. Cada uma é aguardada separadamente, então cada mensagem apresentada
 * corresponde a trabalho efetivamente em curso.
 */
export interface PreparoConteudo {
  pronto: boolean;
  /** Já existe resumo vigente gravado para este documento. */
  temResumo: boolean;
  motivo?: MotivoSemResumo;
  mensagem?: string;
}

export interface RespostaResumo {
  resumo: ResumoDocumento | null;
  motivo?: MotivoSemResumo;
  mensagem?: string;
}

/**
 * Estado do serviço de linguagem.
 *
 * Separado de `StatusFonte` de propósito: a LLM não é uma fonte de documentos.
 * Ela não fornece nada à busca, e sua ausência não torna fonte alguma
 * indisponível — apenas desliga o painel de resumo.
 */
export interface StatusLLM {
  estado: EstadoConexao;
  mensagem?: string;
  /** O usuário já autorizou o envio de conteúdo a serviço externo. */
  consentido: boolean;
  /**
   * Modelo escolhido nesta execução, quando já resolvido.
   *
   * Apresentado na tela de configurações: o modelo é descoberto na API, não
   * fixado no código, então saber qual está em uso é a diferença entre
   * diagnosticar um resumo ruim e adivinhar.
   */
  modelo?: string;
}

/**
 * Andamento da classificação por IA do acervo (`indice-local`).
 *
 * Mesma disciplina de `ProgressoIngestao`: contagens e mensagens do sistema,
 * nunca o texto submetido nem o resultado da classificação em si.
 */
export interface ProgressoIndexacao {
  /** Documentos indexados considerados nesta passagem. */
  total: number;
  /** Documentos classificados agora. */
  classificados: number;
  /** Documentos cuja classificação já estava vigente e foi reaproveitada. */
  reaproveitados: number;
  /** Documentos sem texto disponível para classificar. */
  semTexto: number;
  falhas: number;
  suspensa: boolean;
  motivoSuspensao?: string;
  /** Verdadeiro enquanto esta passagem ainda está em curso. */
  emAndamento: boolean;
}

export interface DocumentoAcessado {
  id: string;
  nome: string;
  fonte: Fonte;
  link: string;
  acessadoEm: string;
}
