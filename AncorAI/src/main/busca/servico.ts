import { POR_PAGINA } from '../../compartilhado/tipos';
import type {
  AvisoFonte,
  Documento,
  EstadoConexao,
  FalhaFonte,
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
import { comoInterativa } from '../conteudo/prioridade';

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
 * Conjunto filtrado da consulta vigente, retido entre uma interação e outra.
 *
 * Existe para que trocar a ordenação reorganize o **resultado inteiro** sem
 * consultar as fontes. As duas exigências vêm da especificação e, sozinha,
 * cada uma tem solução trivial; juntas, obrigam a que alguém guarde o conjunto
 * completo — o renderer só recebe a página, e reordenar dez documentos devolve
 * a ordem de um recorte arbitrário, não a do resultado.
 *
 * Fica no processo principal, e não no renderer, porque a alternativa seria
 * mandar o acervo inteiro pela fronteira IPC a cada consulta para usar dez
 * itens dele — e o número de documentos não tem teto conhecido.
 *
 * Não é cache: nenhuma consulta nova é respondida a partir daqui. Qualquer
 * alteração de termo, tipo, fonte ou período o descarta e vai às fontes, como
 * a especificação exige. Ele serve a reordenar e repaginar o que já veio.
 *
 * Não é persistência: nasce vazio a cada abertura da aplicação e morre com ela.
 */
interface ConsultaVigente {
  filtros: Filtros;
  /** Todos os documentos que passaram pelos filtros, antes de paginar. */
  documentos: Documento[];
  falhas: FalhaFonte[];
  avisos: AvisoFonte[];
  doCache: boolean;
}

let vigente: ConsultaVigente | null = null;

/** Envelope de uma consulta: o que acompanha os documentos até a tela. */
type Envelope = Pick<ResultadoBusca, 'falhas' | 'avisos' | 'doCache'>;

/**
 * Retém o conjunto filtrado e devolve a página pedida, já ordenada.
 *
 * Todo caminho que produz resultado passa por aqui, para que não exista
 * resultado apresentado sem conjunto retido correspondente.
 */
function apresentar(
  documentos: Documento[],
  filtros: Filtros,
  envelope: Envelope
): ResultadoBusca {
  vigente = { filtros, documentos, ...envelope };

  return {
    ...envelope,
    ...paginar(ordenar(documentos, filtros.ordenacao), filtros.pagina ?? 1)
  };
}

/**
 * Verdadeiro quando dois conjuntos de filtros descrevem a mesma consulta.
 *
 * Ordenação e página ficam de fora de propósito: são as duas coisas que o
 * conjunto retido sabe responder sozinho. Divergindo em qualquer outra, o
 * conjunto retido descreve outra consulta e não serve de resposta.
 *
 * A comparação é campo a campo, e não por serialização: dois objetos com as
 * mesmas chaves em ordem diferente serializam diferente, e a consequência de
 * um falso negativo aqui é uma consulta desnecessária às fontes.
 */
function mesmaConsulta(a: Filtros, b: Filtros): boolean {
  const lista = (valores: string[]) => [...valores].sort().join(',');

  return (
    a.termo.trim() === b.termo.trim() &&
    (a.dataInicial ?? '') === (b.dataInicial ?? '') &&
    (a.dataFinal ?? '') === (b.dataFinal ?? '') &&
    lista(a.extensoes) === lista(b.extensoes) &&
    lista(a.fontes) === lista(b.fontes)
  );
}

/**
 * Reorganiza o resultado já obtido segundo o critério e a página pedidos.
 *
 * Nenhuma fonte é consultada quando o conjunto retido corresponde aos filtros
 * recebidos. Não correspondendo — primeira interação depois de abrir a
 * aplicação, ou filtros que mudaram no caminho —, a resposta honesta é
 * consultar: devolver o conjunto anterior sob filtros novos seria apresentar
 * como resultado da consulta pedida o resultado de outra.
 */
export async function reordenar(filtros: Filtros): Promise<ResultadoBusca> {
  if (!vigente || !mesmaConsulta(vigente.filtros, filtros)) {
    // `recentes` roteia sozinho: com termo ou período vai ao acervo, sem eles
    // fica na janela de recentes.
    return recentes(filtros);
  }

  const { documentos, ...envelope } = vigente;
  return {
    ...envelope,
    ...paginar(ordenar(documentos, filtros.ordenacao), filtros.pagina ?? 1)
  };
}

/** Verdadeiro quando o usuário definiu ao menos uma das duas datas. */
function temPeriodo(filtros: Filtros): boolean {
  return Boolean(filtros.dataInicial || filtros.dataFinal);
}

/**
 * Avisa quando o filtro de período deixou documentos de fora por não conhecer
 * a data deles.
 *
 * Substitui o aviso anterior, que informava ao usuário que a data considerada
 * era a de atividade do repositório. Aquela limitação deixou de existir: o
 * período agora resolve a data real antes de filtrar. A que permanece é outra
 * — a resolução é contida por um teto, e uma requisição pode falhar —, e o
 * efeito dela é o inverso do anterior: em vez de documentos a mais no
 * resultado, documentos a menos. É justamente o caso que precisa ser dito em
 * voz alta: um documento ausente é indistinguível de um documento inexistente
 * para quem olha a tela.
 */
function avisarSobreAlcanceDoPeriodo(
  documentos: Documento[],
  filtros: Filtros
): AvisoFonte[] {
  if (!temPeriodo(filtros)) return [];

  const naoResolvidos = documentos.filter((documento) => documento.dataAproximada);
  if (naoResolvidos.length === 0) return [];

  const fontes = new Set(naoResolvidos.map((documento) => documento.fonte));
  return [...fontes].map((fonte) => ({
    fonte,
    mensagem:
      `O filtro de período deixou de fora ${naoResolvidos.length} documento(s) ` +
      'cuja data de alteração não pôde ser obtida. O filtro alcança ' +
      `${TETO_DETALHAMENTO_BUSCA} documentos por consulta.`
  }));
}

/**
 * Busca completa nas fontes selecionadas.
 *
 * Marcada como interativa: enquanto ela roda, a ingestão de conteúdo cede a
 * vez, para que o trabalho de fundo não dispute cota do GitHub com o usuário
 * que está esperando na tela.
 */
export async function buscar(filtros: Filtros): Promise<ResultadoBusca> {
  return comoInterativa(() => executarBusca(filtros));
}

async function executarBusca(filtros: Filtros): Promise<ResultadoBusca> {
  const bruto = await coletar(filtros, (token) => github.buscarDocumentos(token));

  // Autoria e data precisam existir antes do filtro: o termo é comparado ao
  // autor e o período à data, e filtrar antes de conhecê-los descartaria o que
  // se procura — ou admitiria o que não se procura.
  const enriquecido = await enriquecerParaBusca(bruto.documentos, filtros);

  const filtrados = aplicarFiltros(enriquecido.documentos, filtros);

  return apresentar(filtrados, filtros, {
    falhas: bruto.falhas,
    doCache: bruto.doCache,
    avisos: [
      ...bruto.avisos,
      ...enriquecido.avisos,
      ...avisarSobreAlcanceDoPeriodo(enriquecido.documentos, filtros)
    ]
  });
}

const CHAVE_RECENTES = 'recentes:consolidado';

/** Quantidade máxima de documentos que a lista de recentes apresenta. */
const TETO_RECENTES = 30;

/**
 * Recorta e ordena a lista de recentes.
 *
 * O recorte vem **antes** da ordenação escolhida, e não depois. O critério do
 * usuário decide em que ordem os documentos recentes aparecem; ele não decide
 * quais documentos são considerados recentes. Recortar depois de ordenar por
 * nome faz "os trinta mais recentes" significar "os trinta primeiros em ordem
 * alfabética" — troca o conteúdo da lista, e não apenas a ordem dela, sem que
 * nada na tela indique que isso aconteceu.
 */
function prepararRecentes(bruto: ResultadoBusca, filtros: Filtros): ResultadoBusca {
  const filtrados = aplicarFiltros(bruto.documentos, { ...filtros, termo: '' });
  const maisRecentes = ordenar(filtrados, 'data-desc').slice(0, TETO_RECENTES);

  return apresentar(maisRecentes, filtros, {
    falhas: bruto.falhas,
    avisos: bruto.avisos,
    doCache: bruto.doCache
  });
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
  return comoInterativa(() => executarRecentes(filtros));
}

/**
 * Verdadeiro quando os filtros vigentes exigem percorrer o acervo.
 *
 * A janela de recentes cobre, por desenho, apenas os commits mais recentes de
 * alguns repositórios. É o recorte certo para abrir a aplicação — barato e com
 * data real — e o recorte errado para responder a um filtro de período: um
 * intervalo anterior à janela devolve lista vazia, e uma lista vazia é
 * indistinguível, para quem olha a tela, de um acervo que realmente não tem
 * documentos naquele intervalo.
 *
 * A condição vive aqui, e só aqui, porque a escolha da rota é uma decisão sobre
 * o que a consulta precisa alcançar — não sobre o que a tela está exibindo.
 */
export function exigeAcervo(filtros: Filtros): boolean {
  return Boolean(filtros.termo.trim() || filtros.dataInicial || filtros.dataFinal);
}

async function executarRecentes(filtros: Filtros): Promise<ResultadoBusca> {
  // Com período definido a consulta deixa de ser "os recentes filtrados" e
  // passa a ser "o acervo naquele intervalo", que é o que o filtro promete.
  if (exigeAcervo(filtros)) return executarBusca(filtros);

  const bruto = await coletar(filtros, (token) => github.documentosRecentes(token));

  // Só substitui o resultado guardado quando a consulta trouxe algo: uma falha
  // de rede não deve apagar a lista que o usuário já via.
  if (bruto.documentos.length > 0) {
    await gravarCache(CHAVE_RECENTES, bruto.documentos, null);
  }

  return prepararRecentes(bruto, filtros);
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

  const resultado: Documento[] = [...documentos];
  const fila = documentos.map((documento, indice) => ({ documento, indice }));

  async function trabalhar(): Promise<void> {
    for (let item = fila.shift(); item; item = fila.shift()) {
      const { documento, indice } = item;
      if (!documento.repositorio || !documento.caminho) continue;

      const autoria = await github.autoriaDoArquivo(
        token!,
        documento.repositorio,
        documento.caminho
      );
      if (!autoria) continue;

      // A data do commit é a real: a aproximação do repositório deixa de valer,
      // e com ela a marca que avisava o usuário sobre a imprecisão.
      const { dataAproximada: _descartada, ...semMarca } = documento;
      resultado[indice] = {
        ...semMarca,
        autor: autoria.autor,
        dataModificacao: autoria.dataModificacao
      };
    }
  }

  // Uma requisição por documento: sem limite de concorrência, uma página de
  // busca inteira sairia de uma vez contra a API.
  await Promise.all(
    Array.from({ length: Math.min(CONCORRENCIA_AUTORIA, fila.length) }, trabalhar)
  );

  return resultado;
}

/** Teto de documentos detalhados para que os filtros alcancem o que precisam. */
const TETO_DETALHAMENTO_BUSCA = 300;
const CONCORRENCIA_AUTORIA = 6;

/**
 * Preenche, antes de filtrar, o que os filtros precisam conhecer.
 *
 * Dois filtros dependem de dado que o inventário não traz. O **termo** é
 * comparado ao autor, e filtrar antes de conhecê-lo descartaria o que se
 * procura. O **período** é comparado à data, e a data do inventário é a do
 * repositório: filtrar por ela admitiria no resultado documentos intocados há
 * um ano dentro de um repositório ativo. Em ambos os casos o dado deixa de ser
 * complemento e passa a decidir quem entra no resultado — obtê-lo depois da
 * filtragem seria obtê-lo tarde demais.
 *
 * Uma passagem só serve aos dois: `detalhar` devolve autor e data juntos, e
 * chamá-lo duas vezes dobraria o custo sem trazer dado novo.
 *
 * Quando apenas o período exige o detalhamento, os documentos que já têm data
 * real — os que vêm dos commits — não geram requisição alguma: o dado que
 * faltava já está lá.
 *
 * O teto existe porque cada documento custa uma requisição. O cache por `ETag`
 * torna as consultas seguintes baratas — um 304 não consome cota —, mas o
 * número de idas à rede continua proporcional ao acervo, e sem teto um acervo
 * grande tornaria a primeira consulta inviável.
 */
async function enriquecerParaBusca(
  documentos: Documento[],
  filtros: Filtros
): Promise<{ documentos: Documento[]; avisos: AvisoFonte[] }> {
  const porTermo = Boolean(filtros.termo.trim());
  const porPeriodo = temPeriodo(filtros);
  if (!porTermo && !porPeriodo) return { documentos, avisos: [] };

  // Com termo, todo documento é candidato: qualquer um pode ter sido alterado
  // por quem se procura. Só com período, bastam os de data aproximada.
  const candidatos = porTermo
    ? documentos
    : documentos.filter((documento) => documento.dataAproximada);

  const alcance = candidatos.slice(0, TETO_DETALHAMENTO_BUSCA);
  const excedente = candidatos.length - alcance.length;

  const detalhados = new Map(
    (await detalhar(alcance)).map((documento) => [documento.id, documento])
  );

  return {
    // A ordem original é preservada: o detalhamento troca o conteúdo dos
    // documentos, não o lugar deles.
    documentos: documentos.map((documento) => detalhados.get(documento.id) ?? documento),
    avisos:
      porTermo && excedente > 0
        ? [
            {
              fonte: 'github' as const,
              mensagem:
                `A busca por autor considerou os ${TETO_DETALHAMENTO_BUSCA} primeiros ` +
                'documentos. Os demais foram procurados apenas pelo nome.'
            }
          ]
        : []
  };
}
