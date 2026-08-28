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

export interface ResultadoBusca {
  documentos: Documento[];
  falhas: FalhaFonte[];
  /** Resultados vieram, mas podem estar incompletos ou imprecisos. */
  avisos: AvisoFonte[];
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
