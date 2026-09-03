import type { ItemRelacionado, RespostaRelacionados } from '../../compartilhado/tipos';
import {
  documentosClassificados,
  totalNoInventario,
  type DocumentoClassificado
} from '../banco/repositorio';

/**
 * Pilha de documentos relacionados ao documento em foco.
 *
 * A proximidade sai da sobreposição dos `assuntos` que a classificação por IA já
 * gravou por documento — nada é submetido a serviço externo, nada de embeddings
 * ou vetores (ADR-0007). O cálculo roda sob demanda, sobre a coleção já em
 * memória, e nada é persistido: refazê-lo do zero é mais barato que rastrear o
 * que o invalidaria.
 *
 * O que atravessa a fronteira da ADR-0005: identificação, nome, link e os
 * rótulos em comum. O texto de onde os rótulos saíram, nunca.
 */

/**
 * Acréscimo fixo de proximidade quando os dois documentos são da mesma
 * `categoria`.
 *
 * Some por fora do Jaccard (não normalizado): a intenção é desempatar dois
 * candidatos com sobreposição parecida — duas atas, dois ADRs têm afinidade que
 * os assuntos nem sempre capturam —, não deixar a categoria decidir a pilha.
 * Faixa esperada: 0,1–0,3.
 */
export const BONUS_MESMA_CATEGORIA = 0.15;

/**
 * Mínimo de assuntos em comum para um documento entrar na pilha.
 *
 * Abaixo disto só entra quem compartilha um assunto raro (ver
 * `PESO_ASSUNTO_RARO`). Com um único assunto comum em comum, quase todo o acervo
 * se relacionaria com quase todo o acervo.
 */
export const MIN_ASSUNTOS_EM_COMUM = 2;

/**
 * Peso (IDF) a partir do qual um único assunto em comum já basta.
 *
 * `peso(a) = log(total / documentosComOAssunto)`. `log(8) ≈ 2,08`: o assunto
 * aparece em no máximo ~1/8 do acervo. Faixa esperada: 1,5–2,5 — ajustável sem
 * tocar na spec, que fixa "dois assuntos, ou um raro", não o número.
 */
export const PESO_ASSUNTO_RARO = 2;

/** A pilha nunca passa disto: o painel é para leitura, não para uma lista longa. */
export const TETO_PILHA = 5;

function normalizar(rotulo: string): string {
  return rotulo.trim().toLowerCase();
}

/**
 * Peso inverso à frequência: `log(total / contagem)`, o IDF de recuperação de
 * informação.
 *
 * Um assunto em quase todo documento pesa perto de zero; um que aparece em três
 * pesa alto. É o que impede o assunto guarda-chuva do acervo de relacionar tudo
 * com tudo.
 */
export function pesoInverso(total: number, contagem: number): number {
  if (contagem <= 0) return 0;
  return Math.log(total / contagem);
}

/** Peso de cada assunto do acervo, pela sua frequência entre os classificados. */
function pesosDosAssuntos(documentos: DocumentoClassificado[]): Map<string, number> {
  const total = documentos.length;
  const frequencia = new Map<string, number>();
  for (const documento of documentos) {
    for (const assunto of new Set(documento.assuntos.map(normalizar))) {
      frequencia.set(assunto, (frequencia.get(assunto) ?? 0) + 1);
    }
  }

  const peso = new Map<string, number>();
  for (const [assunto, contagem] of frequencia) {
    peso.set(assunto, pesoInverso(total, contagem));
  }
  return peso;
}

export async function pilhaDe(documentoId: string): Promise<RespostaRelacionados> {
  const classificados = await documentosClassificados();
  const foco = classificados.find((documento) => documento.id === documentoId);

  // Sem classificação do documento em foco não há assuntos para cruzar. É um
  // estado distinto de "nenhum relacionado": o painel diz para gerar o resumo.
  if (!foco || foco.assuntos.length === 0) {
    return { pilha: [], semClassificacao: true };
  }

  const peso = pesosDosAssuntos(classificados);
  const pesoDe = (assunto: string): number => peso.get(normalizar(assunto)) ?? 0;

  const assuntosFoco = new Set(foco.assuntos.map(normalizar));
  const categoriaFoco = normalizar(foco.categoria);

  const candidatos: ItemRelacionado[] = [];
  for (const candidato of classificados) {
    if (candidato.id === documentoId) continue;

    const assuntosCandidato = new Set(candidato.assuntos.map(normalizar));
    const emComum = [...assuntosFoco].filter((assunto) => assuntosCandidato.has(assunto));
    if (emComum.length === 0) continue;

    const temAssuntoRaro = emComum.some((assunto) => pesoDe(assunto) >= PESO_ASSUNTO_RARO);
    if (emComum.length < MIN_ASSUNTOS_EM_COMUM && !temAssuntoRaro) continue;

    const uniao = new Set([...assuntosFoco, ...assuntosCandidato]);
    const numerador = emComum.reduce((soma, assunto) => soma + pesoDe(assunto), 0);
    const denominador = [...uniao].reduce((soma, assunto) => soma + pesoDe(assunto), 0);
    const jaccard = denominador > 0 ? numerador / denominador : 0;

    const mesmaCategoria =
      categoriaFoco !== '' && normalizar(candidato.categoria) === categoriaFoco;
    const score = jaccard + (mesmaCategoria ? BONUS_MESMA_CATEGORIA : 0);

    candidatos.push({
      id: candidato.id,
      nome: candidato.nome,
      fonte: candidato.fonte,
      link: candidato.link,
      score
    });
  }

  candidatos.sort((a, b) => b.score - a.score || a.nome.localeCompare(b.nome));

  const total = await totalNoInventario();
  const semClassificacao = Math.max(0, total - classificados.length);
  const aviso =
    semClassificacao > 0
      ? {
          fonte: 'github' as const,
          mensagem:
            `${semClassificacao} documento(s) ainda sem classificação por IA ficaram ` +
            'fora da análise de relacionados.'
        }
      : undefined;

  return {
    pilha: candidatos.slice(0, TETO_PILHA),
    semClassificacao: false,
    ...(aviso ? { aviso } : {})
  };
}
