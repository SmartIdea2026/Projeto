import { POR_PAGINA } from '../../compartilhado/tipos';
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
  const unificados = unificar(documentos);
  return {
    documentos: unificados,
    total: unificados.length,
    pagina: 1,
    falhas,
    avisos,
    doCache: false
  };
}

/**
 * Recorta a página pedida de um resultado já filtrado e ordenado.
 *
 * A paginação vem depois de filtrar e ordenar para que a primeira página traga
 * de fato os documentos de maior precedência segundo o critério vigente, e não
 * os dez primeiros de uma ordem qualquer.
 */
function paginar(documentos: Documento[], pagina: number): {
  documentos: Documento[];
  total: number;
  pagina: number;
} {
  const total = documentos.length;
  const ultima = Math.max(1, Math.ceil(total / POR_PAGINA));
  // Uma página além do fim — resultado encolheu entre consultas — cai na última.
  const atual = Math.min(Math.max(1, Math.trunc(pagina)), ultima);
  const inicio = (atual - 1) * POR_PAGINA;

  return { documentos: documentos.slice(inicio, inicio + POR_PAGINA), total, pagina: atual };
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

  const ordenados = ordenar(aplicarFiltros(bruto.documentos, filtros), filtros.ordenacao);
  const filtrado = { ...bruto, ...paginar(ordenados, filtros.pagina ?? 1) };

  return avisarSobrePeriodo(filtrado, filtros);
}

const CHAVE_RECENTES = 'recentes:consolidado';

function prepararRecentes(bruto: ResultadoBusca, filtros: Filtros): ResultadoBusca {
  const ordenados = ordenar(
    aplicarFiltros(bruto.documentos, { ...filtros, termo: '' }),
    filtros.ordenacao
  ).slice(0, 30);

  return {
    ...bruto,
    ...paginar(ordenados, filtros.pagina ?? 1)
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
    {
      documentos: entrada.payload,
      total: entrada.payload.length,
      pagina: 1,
      falhas: [],
      avisos: [],
      doCache: true
    },
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

/**
 * Enriquece os documentos apresentados com autoria e data real.
 *
 * Recebe apenas a página visível: a árvore Git não traz autor nem data por
 * arquivo, então cada documento custa uma requisição. Consultar o resultado
 * inteiro reintroduziria exatamente o custo que adiou este item no MVP.
 *
 * As falhas individuais não interrompem nada — um documento sem autoria volta
 * como veio, e a interface o apresenta sem os campos.
 */
export async function detalhar(documentos: Documento[]): Promise<Documento[]> {
  const token = cofre.obter('github.token');
  if (!token) return documentos;

  return Promise.all(
    documentos.map(async (documento) => {
      if (!documento.repositorio || !documento.caminho) return documento;

      const autoria = await github.autoriaDoArquivo(
        token,
        documento.repositorio,
        documento.caminho
      );
      if (!autoria) return documento;

      // A data do commit é a real: a aproximação do repositório deixa de valer,
      // e com ela a marca que avisava o usuário sobre a imprecisão.
      const { dataAproximada: _descartada, ...semMarca } = documento;
      return {
        ...semMarca,
        autor: autoria.autor,
        dataModificacao: autoria.dataModificacao
      };
    })
  );
}
