import type { Documento, ProgressoIndexacao } from '../../compartilhado/tipos';
import {
  gravarClassificacao,
  idsSemClassificacao,
  lerConteudo,
  registrarNoIndice
} from '../banco/repositorio';
import * as cofre from '../credenciais/cofre';
import { aguardarVez } from '../conteudo/prioridade';
import { ErroFonte } from '../fontes/comum';
import * as github from '../fontes/github';
import { classificar, ErroLLM } from '../llm/gemini';
import { enfileirar } from '../llm/fila';

/**
 * Índice local de documentos e classificação por IA (`indice-local`).
 *
 * Duas etapas, sempre nesta ordem: registrar no índice os metadados do
 * inventário obtido das fontes, e então classificar o que ainda não tem
 * classificação vigente. A classificação lê o texto já armazenado por
 * `ingerir-conteudo-dos-documentos` — nunca o baixa de novo — e por isso um
 * documento cujo texto ainda não chegou fica sem classificação nesta
 * passagem, sem erro algum: a próxima passagem o alcança.
 *
 * Mesma disciplina de `conteudo/ingestao.ts`: trabalho de fundo, incremental,
 * retomável, e que cede a vez a qualquer operação interativa — a fila de
 * submissões à LLM é a mesma que o resumo do documento em foco usa, e quem
 * está olhando o painel não deve esperar a indexação de fundo drenar.
 */

let cancelada = false;

/** Interrompe a indexação de fundo em curso, sem perder o já classificado. */
export function cancelarIndexacao(): void {
  cancelada = true;
}

const VAZIO: ProgressoIndexacao = {
  total: 0,
  classificados: 0,
  reaproveitados: 0,
  semTexto: 0,
  falhas: 0,
  suspensa: false,
  emAndamento: false
};

let atual: ProgressoIndexacao = VAZIO;

/**
 * Andamento da passagem em curso, ou da última concluída.
 *
 * Existe para que a interface possa apresentar progresso ao vivo, e não
 * apenas o resultado final: sem isto não haveria o que exibir enquanto a
 * indexação ainda está acontecendo.
 */
export function progressoIndexacao(): ProgressoIndexacao {
  return atual;
}

function suspender(motivo: string): ProgressoIndexacao {
  atual = { ...atual, suspensa: true, motivoSuspensao: motivo, emAndamento: false };
  return atual;
}

/**
 * Classifica um único documento indexado, reaproveitando a classificação
 * vigente quando já houver.
 *
 * Não baixa texto algum: lê o que `ingerir-conteudo-dos-documentos` já
 * guardou, e desiste sem erro quando não há nada extraído — é o que os
 * cenários "sem texto", "excedente" e "falha na extração" pedem.
 */
async function classificarDocumento(documento: {
  id: string;
  nome: string;
}): Promise<'classificado' | 'sem-texto' | 'falha'> {
  const conteudo = await lerConteudo(documento.id);
  if (!conteudo || conteudo.estado !== 'extraido') return 'sem-texto';

  const chave = cofre.obter('gemini.chave');
  if (!chave) return 'sem-texto';

  try {
    const produzido = await enfileirar(() =>
      classificar(chave, { nome: documento.nome, texto: conteudo.texto })
    );
    await gravarClassificacao(documento.id, produzido);
    return 'classificado';
  } catch (erro) {
    if (erro instanceof ErroLLM && erro.motivo === 'cota-excedida') throw erro;
    return 'falha';
  }
}

/**
 * Percorre o inventário registrando metadados no índice e classificando o
 * que ainda não tem classificação vigente.
 *
 * Serial, com uma submissão por vez à LLM — a mesma fila do resumo. Não há
 * ninguém esperando esta passagem terminar, então paralelizar só aumentaria o
 * risco de estourar a cota do plano gratuito sem encurtar espera real alguma.
 */
export async function indexarAcervo(): Promise<ProgressoIndexacao> {
  cancelada = false;
  atual = { ...VAZIO, emAndamento: true };

  const token = cofre.obter('github.token');
  if (!token) return suspender('A credencial do GitHub não está configurada.');

  await aguardarVez();

  let inventario: Documento[];
  try {
    inventario = (await github.buscarDocumentos(token)).dados;
  } catch (erro) {
    const motivo =
      erro instanceof ErroFonte ? erro.message : 'Não foi possível obter o inventário.';
    return suspender(motivo);
  }

  await registrarNoIndice(inventario);

  const pendentes = new Set(await idsSemClassificacao());

  atual = { ...atual, total: inventario.length };

  for (const documento of inventario) {
    if (cancelada) return suspender('A indexação foi interrompida.');

    if (!pendentes.has(documento.id)) {
      atual = { ...atual, reaproveitados: atual.reaproveitados + 1 };
      continue;
    }

    // Cede a vez: enquanto o usuário espera uma busca ou um resumo, a
    // classificação de fundo para.
    await aguardarVez();

    try {
      const resultado = await classificarDocumento(documento);
      if (resultado === 'classificado') {
        atual = { ...atual, classificados: atual.classificados + 1 };
      } else if (resultado === 'sem-texto') {
        atual = { ...atual, semTexto: atual.semTexto + 1 };
      } else {
        atual = { ...atual, falhas: atual.falhas + 1 };
      }
    } catch (erro) {
      // Cota estourada interrompe tudo: continuar só produziria uma sequência
      // de recusas idênticas. Qualquer outra falha é daquele documento, e a
      // indexação segue.
      if (erro instanceof ErroLLM && erro.motivo === 'cota-excedida') {
        return suspender(erro.message);
      }
      atual = { ...atual, falhas: atual.falhas + 1 };
    }
  }

  atual = { ...atual, emAndamento: false };
  return atual;
}
