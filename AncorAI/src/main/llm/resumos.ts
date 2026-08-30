import type {
  Documento,
  EstadoConexao,
  PreparoConteudo,
  RespostaResumo,
  ResumoDocumento,
  StatusLLM
} from '../../compartilhado/tipos';
import {
  gravarPreferencia,
  gravarResumo,
  lerConteudo,
  lerPreferencia
} from '../banco/repositorio';
import * as cofre from '../credenciais/cofre';
import { estaVigente, ingerirDocumento } from '../conteudo/ingestao';
import { comoInterativa } from '../conteudo/prioridade';
import { ErroFonte } from '../fontes/comum';
import { ErroLLM, modeloEmUso, resumir, verificarChave } from './gemini';
import { lerInstrucao } from './instrucao';

/**
 * Geração de resumos: do texto armazenado até o que o painel apresenta.
 *
 * Toda a comunicação com a LLM passa por aqui, e nada deste módulo é alcançável
 * a partir de um canal que devolva texto de documento — o painel recebe o
 * resumo, nunca o conteúdo de onde ele saiu.
 */

export const CHAVE_CONSENTIMENTO = 'resumo.consentimentoEnvio';

/**
 * Fila de submissões com concorrência um.
 *
 * O limite do plano gratuito é por minuto: disparar três cliques rápidos em
 * paralelo transformaria três resumos em três recusas. Serializar troca uma
 * espera um pouco maior por um resultado que efetivamente chega.
 */
let ultima: Promise<unknown> = Promise.resolve();

function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = ultima.then(tarefa, tarefa);
  // A cauda ignora o resultado para que uma submissão que falhou não derrube
  // as seguintes: a fila é de ordem, não de dependência.
  ultima = proxima.catch(() => undefined);
  return proxima;
}

export async function consentiu(): Promise<boolean> {
  return (await lerPreferencia(CHAVE_CONSENTIMENTO)) === true;
}

/** Registra a decisão do usuário sobre enviar conteúdo a serviço externo. */
export async function registrarConsentimento(valor: boolean): Promise<void> {
  await gravarPreferencia(CHAVE_CONSENTIMENTO, valor);
}

function estadoDaFalha(erro: unknown): EstadoConexao {
  if (erro instanceof ErroLLM && erro.motivo === 'sem-conexao') return 'sem-conexao';
  return 'invalida';
}

/** Estado do serviço de linguagem, para a tela de configurações. */
export async function status(): Promise<StatusLLM> {
  const consentimento = await consentiu();

  if (!cofre.existe('gemini.chave')) {
    return { estado: 'nao-configurada', consentido: consentimento };
  }

  // O modelo só aparece depois de resolvido; consultá-lo aqui custaria uma
  // requisição a cada abertura da tela, para informar o que ainda não decide
  // nada.
  const modelo = modeloEmUso();
  return {
    estado: 'conectada',
    consentido: consentimento,
    ...(modelo ? { modelo } : {})
  };
}

/** Valida a chave contra a API antes de gravá-la. */
export async function definirChave(valor: string): Promise<StatusLLM> {
  try {
    await verificarChave(valor);
  } catch (erro) {
    if (erro instanceof ErroLLM && erro.motivo === 'sem-conexao') throw erro;
    throw new Error(
      erro instanceof Error ? erro.message : 'A chave da API de IA não foi aceita.'
    );
  }

  cofre.definir('gemini.chave', valor);
  return status();
}

export async function removerChave(): Promise<StatusLLM> {
  cofre.remover('gemini.chave');
  return status();
}

function recusa(motivo: RespostaResumo['motivo'], mensagem: string): RespostaResumo {
  return { resumo: null, motivo, mensagem };
}

function montar(
  documento: Documento,
  dados: {
    resumo: string;
    tipo?: string;
    assuntos?: string[];
    destaques?: string[];
    resumoEm?: string;
  },
  versaoGravada: string,
  truncado: boolean
): ResumoDocumento {
  return {
    documentoId: documento.id,
    resumo: dados.resumo,
    tipo: dados.tipo ?? '',
    assuntos: dados.assuntos ?? [],
    destaques: dados.destaques ?? [],
    geradoEm: dados.resumoEm ?? new Date().toISOString(),
    // O texto guardado corresponde a `versaoGravada`. Se a fonte já informa
    // outra versão, o resumo descreve um documento que mudou desde então.
    desatualizado: Boolean(documento.versaoConteudo) &&
      documento.versaoConteudo !== versaoGravada,
    baseTruncada: truncado
  };
}

/**
 * Garante que o texto do documento esteja disponível localmente.
 *
 * Separado de `resumoDoDocumento` para que a interface possa aguardar as duas
 * etapas em separado e nomear cada uma corretamente. Chamar só o resumo
 * continua funcionando: ele refaz este preparo por dentro.
 */
export async function prepararConteudo(documento: Documento): Promise<PreparoConteudo> {
  const registro = await lerConteudo(documento.id);
  const vigente = estaVigente(registro, documento);

  let atual = registro;
  if (!vigente) {
    const token = cofre.obter('github.token');
    if (!token) {
      return {
        pronto: false,
        temResumo: false,
        motivo: 'sem-texto',
        mensagem: 'Configure o acesso ao GitHub para obter o texto.'
      };
    }
    try {
      atual = await comoInterativa(() => ingerirDocumento(documento, token));
    } catch (erro) {
      return {
        pronto: false,
        temResumo: false,
        motivo: 'falha',
        mensagem:
          erro instanceof ErroFonte
            ? erro.message
            : 'Não foi possível obter o texto do documento.'
      };
    }
  }

  if (!atual || atual.estado !== 'extraido') {
    return {
      pronto: false,
      temResumo: false,
      motivo: 'sem-texto',
      mensagem: atual?.motivo ?? 'Não há texto disponível neste documento para resumir.'
    };
  }

  return { pronto: true, temResumo: Boolean(atual.resumo && atual.resumoEm) };
}

/**
 * Resumo de um documento, gerando-o se ainda não houver.
 *
 * `regerar` força uma submissão nova, para o caso de o usuário pedir a
 * atualização de um resumo assinalado como desatualizado.
 */
export async function resumoDoDocumento(
  documento: Documento,
  regerar = false
): Promise<RespostaResumo> {
  if (!(await consentiu())) {
    return recusa(
      'sem-consentimento',
      'O resumo exige enviar o texto do documento a um serviço externo.'
    );
  }

  const chave = cofre.obter('gemini.chave');
  if (!chave) {
    return recusa('sem-credencial', 'Configure a chave da API de IA para gerar resumos.');
  }

  // O texto já ingerido serve sem tocar na rede. Só quando falta é que se
  // busca — e aí é trabalho interativo, porque há alguém olhando o painel e o
  // download disputa cota do GitHub com a ingestão de fundo, que cede a vez.
  let registro = await lerConteudo(documento.id);
  const textoVigente = estaVigente(registro, documento);

  if (!textoVigente) {
    const token = cofre.obter('github.token');
    if (!token) {
      return recusa('sem-texto', 'Configure o acesso ao GitHub para obter o texto.');
    }
    try {
      registro = await comoInterativa(() => ingerirDocumento(documento, token));
    } catch (erro) {
      if (erro instanceof ErroFonte) return recusa('falha', erro.message);
      return recusa('falha', 'Não foi possível obter o texto do documento.');
    }
  }

  if (!registro || registro.estado !== 'extraido') {
    return recusa(
      'sem-texto',
      registro?.motivo ?? 'Não há texto disponível neste documento para resumir.'
    );
  }

  const conteudo = registro;
  if (conteudo.resumo && conteudo.resumoEm && !regerar) {
    return {
      resumo: montar(
        documento,
        {
          resumo: conteudo.resumo,
          tipo: conteudo.tipo,
          assuntos: conteudo.assuntos,
          destaques: conteudo.destaques,
          resumoEm: conteudo.resumoEm
        },
        conteudo.versaoConteudo,
        conteudo.truncado
      )
    };
  }

  try {
    const produzido = await enfileirar(() =>
      resumir(chave, lerInstrucao(), { nome: documento.nome, texto: conteudo.texto })
    );

    // Gravado antes de devolver: a submissão custou cota, e o resultado vale
    // para este documento mesmo que quem pediu já tenha trocado de foco.
    await gravarResumo(documento.id, produzido);

    return {
      resumo: montar(documento, produzido, conteudo.versaoConteudo, conteudo.truncado)
    };
  } catch (erro) {
    if (erro instanceof ErroLLM) return recusa(erro.motivo, erro.message);
    return recusa('falha', 'Não foi possível gerar o resumo.');
  }
}

/** Resumo já gravado, sem gerar nada. Devolve `null` quando não há. */
export async function resumoGravado(documento: Documento): Promise<ResumoDocumento | null> {
  const registro = await lerConteudo(documento.id);
  if (!registro?.resumo || !registro.resumoEm) return null;

  return montar(
    documento,
    {
      resumo: registro.resumo,
      tipo: registro.tipo,
      assuntos: registro.assuntos,
      destaques: registro.destaques,
      resumoEm: registro.resumoEm
    },
    registro.versaoConteudo,
    registro.truncado
  );
}

export { estadoDaFalha };
