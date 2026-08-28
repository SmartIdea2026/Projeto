import type {
  AvisoFonte,
  Documento,
  EstadoConexao,
  Filtros,
  Fonte,
  ResultadoBusca,
  StatusFonte
} from '../../compartilhado/tipos';
import * as cofre from '../credenciais/cofre';
import * as github from '../fontes/github';
import { ErroFonte } from '../fontes/comum';
import { aplicarFiltros, fonteSelecionada, ordenar, unificar } from './regras';
import { gravarValidacao, lerValidacao } from '../credenciais/validacao';
import { gravarCache, lerCache } from '../banco/repositorio';

/**
 * Orquestra as fontes configuradas.
 *
 * A regra central é que a falha de uma fonte nunca impede a apresentação dos
 * resultados das demais (CB05): cada fonte é consultada de forma independente e
 * as falhas são coletadas para exibição, em vez de interromper a busca.
 *
 * O MVP tem só o GitHub (ADR-0004), mas a orquestração continua plural: a
 * coleta percorre fontes, isola falhas por fonte e unifica o resultado. Uma
 * segunda fonte volta a caber sem reescrever nada disto.
 */

function mensagemDe(erro: unknown): string {
  if (erro instanceof ErroFonte) return erro.message;
  return 'Ocorreu uma falha inesperada ao consultar a fonte.';
}

/** Executa as consultas às fontes selecionadas, isolando as falhas. */
async function coletar(
  filtros: Filtros,
  doGithub: (token: string) => Promise<github.Parcial<Documento[]>>
): Promise<ResultadoBusca> {
  const documentos: Documento[] = [];
  const falhas: ResultadoBusca['falhas'] = [];
  const avisos: AvisoFonte[] = [];
  const tarefas: Array<Promise<void>> = [];

  if (fonteSelecionada(filtros, 'github')) {
    const token = cofre.obter('github.token');
    if (token) {
      tarefas.push(
        doGithub(token)
          .then((encontrados) => {
            documentos.push(...encontrados.dados);
            if (encontrados.aviso) {
              avisos.push({ fonte: 'github', mensagem: encontrados.aviso });
            }
          })
          .catch((erro) => {
            falhas.push({
              fonte: 'github',
              mensagem: mensagemDe(erro),
              limiteExcedido: erro instanceof ErroFonte && erro.limiteExcedido
            });
          })
      );
    } else {
      falhas.push({ fonte: 'github', mensagem: 'O GitHub não está configurado.' });
    }
  }

  await Promise.all(tarefas);
  return { documentos: unificar(documentos), falhas, avisos, doCache: false };
}

/**
 * Acrescenta o aviso de imprecisão quando o filtro de período incide sobre
 * documentos de data aproximada.
 *
 * A busca no GitHub deriva a data da árvore Git, que não a fornece por arquivo:
 * todo documento herda o `pushed_at` do repositório. Filtrar por período nesses
 * documentos filtra, na prática, por atividade do repositório — um arquivo
 * intocado há um ano dentro de um repositório ativo entra no resultado. Sem
 * este aviso o usuário não teria como perceber a diferença.
 */
function avisarSobrePeriodo(resultado: ResultadoBusca, filtros: Filtros): ResultadoBusca {
  const temPeriodo = Boolean(filtros.dataInicial || filtros.dataFinal);
  if (!temPeriodo) return resultado;

  const fontes = new Set(
    resultado.documentos.filter((doc) => doc.dataAproximada).map((doc) => doc.fonte)
  );
  if (fontes.size === 0) return resultado;

  return {
    ...resultado,
    avisos: [
      ...resultado.avisos,
      ...[...fontes].map((fonte) => ({
        fonte,
        mensagem:
          'O filtro de período usa a data de atividade do repositório, e não a ' +
          'de cada arquivo. Documentos antigos em repositórios ativos podem ' +
          'aparecer no resultado.'
      }))
    ]
  };
}

export async function buscar(filtros: Filtros): Promise<ResultadoBusca> {
  const bruto = await coletar(filtros, (token) => github.buscarDocumentos(token));

  const filtrado = {
    ...bruto,
    documentos: ordenar(aplicarFiltros(bruto.documentos, filtros), filtros.ordenacao)
  };

  return avisarSobrePeriodo(filtrado, filtros);
}

const CHAVE_RECENTES = 'recentes:consolidado';

function prepararRecentes(bruto: ResultadoBusca, filtros: Filtros): ResultadoBusca {
  return {
    ...bruto,
    // A lista de recentes ignora o termo, mas respeita tipo e período.
    documentos: ordenar(
      aplicarFiltros(bruto.documentos, { ...filtros, termo: '' }),
      'data-desc'
    ).slice(0, 30)
  };
}

/**
 * Resultado anterior da rotina de inicialização, se houver.
 *
 * A especificação exige que a lista anterior apareça imediatamente e seja
 * atualizada em segundo plano, para que abrir a aplicação não signifique
 * esperar por duas APIs antes de ver qualquer coisa.
 */
export async function recentesDoCache(filtros: Filtros): Promise<ResultadoBusca | null> {
  const entrada = await lerCache<Documento[]>(CHAVE_RECENTES);
  if (!entrada || entrada.payload.length === 0) return null;
  return prepararRecentes(
    { documentos: entrada.payload, falhas: [], avisos: [], doCache: true },
    filtros
  );
}

export async function recentes(filtros: Filtros): Promise<ResultadoBusca> {
  const bruto = await coletar(filtros, (token) => github.documentosRecentes(token));

  // Só substitui o resultado guardado quando a consulta trouxe algo: uma falha
  // de rede não deve apagar a lista que o usuário já via.
  if (bruto.documentos.length > 0) {
    await gravarCache(CHAVE_RECENTES, bruto.documentos, null);
  }

  return avisarSobrePeriodo(prepararRecentes(bruto, filtros), filtros);
}

/** Traduz uma falha de verificação no estado correspondente. */
export function estadoDaFalha(erro: unknown): EstadoConexao {
  // A distinção importa para o usuário: credencial inválida exige corrigir a
  // credencial, falha de rede exige apenas tentar de novo.
  return erro instanceof ErroFonte && erro.message.includes('alcançar')
    ? 'sem-conexao'
    : 'invalida';
}

async function statusDaFonte(
  fonte: Fonte,
  credencial: string | null,
  verificar: () => Promise<string>,
  reaproveitar: boolean
): Promise<StatusFonte> {
  if (!credencial) return { fonte, estado: 'nao-configurada' };

  const guardado = reaproveitar ? await lerValidacao(fonte, credencial) : null;
  if (guardado) return { fonte, ...guardado };

  try {
    const conta = await verificar();
    await gravarValidacao(fonte, credencial, 'conectada', conta);
    return { fonte, estado: 'conectada', conta };
  } catch (erro) {
    return { fonte, estado: estadoDaFalha(erro), mensagem: mensagemDe(erro) };
  }
}

export async function status(reaproveitar = true): Promise<StatusFonte[]> {
  const token = cofre.obter('github.token');

  return Promise.all([
    statusDaFonte('github', token, () => github.verificarCredencial(token!), reaproveitar)
  ]);
}

export async function validarTokenGithub(token: string): Promise<string> {
  return github.verificarCredencial(token);
}
