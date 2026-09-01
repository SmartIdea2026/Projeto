import { vi } from 'vitest';
import type {
  Documento,
  ResultadoBusca,
  ResumoDocumento,
  StatusFonte,
  StatusLLM
} from '../../src/compartilhado/tipos';

/**
 * Dublê da ponte `window.ancorai` para os testes de interface.
 *
 * Existe em um lugar só de propósito. Antes, cada arquivo de teste montava o
 * seu próprio objeto com a lista completa de funções — e acrescentar um canal
 * ao preload quebrava cinco arquivos de uma vez, sempre pelo mesmo motivo:
 * `window.ancorai.algo is not a function`. Concentrar a montagem aqui faz um
 * canal novo custar uma linha, e no lugar certo.
 *
 * Cada teste sobrescreve só o que lhe interessa.
 */

export const CONECTADO: StatusFonte[] = [
  { fonte: 'github', estado: 'conectada', conta: 'equipe' }
];

/** Chave configurada e envio autorizado: o caminho normal do painel. */
export const LLM_PRONTA: StatusLLM = { estado: 'conectada', consentido: true };

/** Nenhuma chave configurada: o painel informa e a busca segue funcionando. */
export const LLM_AUSENTE: StatusLLM = { estado: 'nao-configurada', consentido: false };

export function resumoDe(documento: Documento): ResumoDocumento {
  return {
    documentoId: documento.id,
    resumo: `Resumo de ${documento.nome}.`,
    tipo: 'Documento',
    assuntos: ['exemplo'],
    destaques: ['Primeiro ponto', 'Segundo ponto'],
    geradoEm: '2026-08-28T12:00:00Z',
    desatualizado: false,
    baseTruncada: false
  };
}

type Sobrescritas = Partial<Record<string, unknown>>;

/**
 * Monta o dublê completo, com um resultado de busca e ajustes opcionais.
 *
 * O padrão é o caminho feliz: credencial válida, chave de IA configurada,
 * consentimento dado e resumo disponível de imediato. Um teste que queira
 * exercitar a espera, a recusa ou a falha sobrescreve a função em questão.
 */
export function montarApi(resultado: ResultadoBusca, sobrescritas: Sobrescritas = {}) {
  return {
    status: vi.fn(async () => CONECTADO),
    recentesDoCache: vi.fn(async () => null),
    recentes: vi.fn(async () => resultado),
    buscar: vi.fn(async () => resultado),
    // Reorganiza o resultado já obtido. Um teste que exercite a ordenação
    // sobre várias páginas sobrescreve com um dublê que ordena e pagina.
    reordenar: vi.fn(async () => resultado),
    verificarCredenciais: vi.fn(async () => CONECTADO),
    definirCredencial: vi.fn(async () => CONECTADO),
    removerCredencial: vi.fn(async () => CONECTADO),
    detalharDocumentos: vi.fn(async (docs: Documento[]) => docs),
    indexarConteudo: vi.fn(async () => ({
      total: 0,
      ingeridos: 0,
      reaproveitados: 0,
      semTexto: 0,
      falhas: 0,
      suspensa: false
    })),
    progressoIndice: vi.fn(async () => ({
      total: 0,
      classificados: 0,
      reaproveitados: 0,
      semTexto: 0,
      falhas: 0,
      suspensa: false,
      emAndamento: false
    })),
    abrirDocumento: vi.fn(),
    documentosAcessados: vi.fn(async () => []),

    statusLLM: vi.fn(async () => LLM_PRONTA),
    definirChaveLLM: vi.fn(async () => LLM_PRONTA),
    removerChaveLLM: vi.fn(async () => LLM_AUSENTE),
    consentirEnvio: vi.fn(async () => LLM_PRONTA),
    resumoGravado: vi.fn(async (documento: Documento) => resumoDe(documento)),
    prepararConteudo: vi.fn(async () => ({ pronto: true, temResumo: true })),
    resumoDoDocumento: vi.fn(async (documento: Documento) => ({
      resumo: resumoDe(documento)
    })),

    ...sobrescritas
  };
}

/** Instala o dublê em `window`, como o preload faria. */
export function instalarApi(api: unknown): void {
  Object.defineProperty(window, 'ancorai', {
    value: api,
    writable: true,
    configurable: true
  });
}
