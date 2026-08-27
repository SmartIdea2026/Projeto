/**
 * Tipos compartilhados entre os processos main, preload e renderer.
 *
 * Nenhum tipo aqui carrega credencial: o renderer nunca recebe o valor de um
 * token, apenas o estado da conexão (ADR-0003).
 */

export type Fonte = 'github' | 'drive';

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
  /** Caminho dentro do repositório, quando a fonte é o GitHub. */
  caminho?: string;
  /** Repositório de origem, quando a fonte é o GitHub. */
  repositorio?: string;
}

export type Ordenacao = 'a-z' | 'z-a' | 'data-asc' | 'data-desc';

export interface Filtros {
  termo: string;
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

export interface ResultadoBusca {
  documentos: Documento[];
  falhas: FalhaFonte[];
  /** Verdadeiro quando os dados vieram do cache local, sem consultar a rede. */
  doCache: boolean;
}

export interface DocumentoAcessado {
  id: string;
  nome: string;
  fonte: Fonte;
  link: string;
  acessadoEm: string;
}
