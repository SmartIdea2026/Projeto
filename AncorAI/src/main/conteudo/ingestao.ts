import type {
  Documento,
  MotivoSuspensao,
  ProgressoIngestao,
  RetratoSincronizacao
} from '../../compartilhado/tipos';
import {
  descartarConteudoAusente,
  gravarAutoria,
  gravarConteudo,
  idsComAutoriaPendente,
  lerConteudo,
  sincronizarInventario,
  totalDeCaracteres,
  type RegistroConteudo
} from '../banco/repositorio';
import * as cofre from '../credenciais/cofre';
import { ErroFonte } from '../fontes/comum';
import * as github from '../fontes/github';
import { extrairTexto } from './extracao';
import { LIMITE_CARACTERES_TOTAL, motivoParaNaoIngerir } from './limites';
import { aguardarVez } from './prioridade';

/**
 * Ingestão do conteúdo: obter, extrair e guardar o texto dos documentos.
 *
 * Duas formas de entrada, com propósitos distintos:
 *
 * - **sob demanda** (`textoDoDocumento`), quando algum recurso do sistema
 *   precisa do texto de um documento específico e não pode esperar a varredura
 *   chegar nele;
 * - **em segundo plano** (`ingerirAcervo`), que percorre o inventário e
 *   completa o que falta, sem ninguém esperando.
 *
 * Em nenhuma das duas o conteúdo sai deste processo. Não há função aqui que
 * seja alcançável a partir de um canal IPC devolvendo texto (ADR-0005).
 */

let cancelada = false;

/** Interrompe a ingestão de fundo em curso, sem perder o já gravado. */
export function cancelarIngestao(): void {
  cancelada = true;
}

/**
 * Retrato do andamento da última varredura, consultável pelo renderer.
 *
 * Vive em memória, não no banco: é estado de execução, não dado a preservar
 * entre sessões. Nasce `parada`, acompanha as transições da varredura e é o que
 * o canal `sincronizacao:estado` devolve — contagens e estado, nunca texto.
 */
let retrato: RetratoSincronizacao = {
  estado: 'parada',
  total: 0,
  ingeridos: 0,
  reaproveitados: 0,
  semTexto: 0,
  falhas: 0,
  suspensa: false
};

/** Retrato do andamento da sincronização — contagens e estado, nunca texto. */
export function estadoDaSincronizacao(): RetratoSincronizacao {
  return retrato;
}

/**
 * Verdadeiro quando o registro guardado corresponde à versão vigente na fonte.
 *
 * A comparação é pelo `sha` do blob, que é hash do conteúdo — não pela data.
 * A data do inventário é o `pushed_at` do repositório, igual para todos os
 * arquivos dele: comparar por data faria um push em qualquer arquivo rebaixar
 * o acervo inteiro e forçar o download de tudo outra vez.
 */
export function estaVigente(
  registro: RegistroConteudo | null,
  documento: Documento
): boolean {
  if (registro === null) return false;

  // Sem identidade de conteúdo não há como verificar se o texto guardado ainda
  // vale. Isso não é o mesmo que não haver texto: o registro é a melhor
  // informação disponível, e recusá-lo faria o sistema ignorar um texto que
  // ele próprio já baixou e guardou sob este mesmo identificador.
  if (!documento.versaoConteudo) return true;

  return registro.versaoConteudo === documento.versaoConteudo;
}

/**
 * Obtém, extrai e grava o texto de um documento, ou reaproveita o já guardado.
 *
 * Devolve `null` para documento que não pode ser endereçado por conteúdo — os
 * que vêm dos commits, sem `sha` —, caso em que não há o que guardar nem como
 * saber depois se o guardado ainda valeria.
 */
export async function ingerirDocumento(
  documento: Documento,
  token: string
): Promise<RegistroConteudo | null> {
  const registro = await lerConteudo(documento.id);
  if (estaVigente(registro, documento)) return registro;

  const versaoConteudo = documento.versaoConteudo;
  if (!versaoConteudo) return null;

  const impedimento = motivoParaNaoIngerir(documento);
  if (impedimento) {
    // Gravado, e não apenas ignorado: sem o registro, a varredura seguinte
    // reconsideraria o mesmo arquivo grande demais indefinidamente.
    const excedente = {
      _id: documento.id,
      versaoConteudo,
      estado: 'excedente' as const,
      texto: '',
      truncado: false,
      motivo: impedimento
    };
    await gravarConteudo(excedente);
    return { ...excedente, extraidoEm: new Date().toISOString() };
  }

  const bytes = await github.conteudoDoArquivo(
    token,
    documento.repositorio ?? '',
    versaoConteudo
  );
  const extraido = await extrairTexto(bytes, documento.extensao);

  const novo = {
    _id: documento.id,
    versaoConteudo,
    estado: extraido.estado,
    texto: extraido.texto,
    truncado: extraido.truncado,
    ...(extraido.motivo ? { motivo: extraido.motivo } : {})
  };
  await gravarConteudo(novo);
  return { ...novo, extraidoEm: new Date().toISOString() };
}

/**
 * Texto de um documento, obtendo-o agora se ainda não houver.
 *
 * Devolve string vazia quando não há texto a oferecer — formato não lido,
 * documento sem texto, arquivo grande demais ou falha na obtenção. Quem chama
 * trata a ausência de texto como ausência de texto, nunca como erro.
 */
export async function textoDoDocumento(documento: Documento): Promise<string> {
  const token = cofre.obter('github.token');
  if (!token) return '';

  try {
    const registro = await ingerirDocumento(documento, token);
    return registro?.estado === 'extraido' ? registro.texto : '';
  } catch {
    return '';
  }
}

function suspender(
  progresso: ProgressoIngestao,
  motivo: MotivoSuspensao
): ProgressoIngestao {
  const suspenso: ProgressoIngestao = {
    ...progresso,
    suspensa: true,
    motivoSuspensao: motivo
  };
  retrato = { ...suspenso, estado: 'suspensa' };
  return suspenso;
}

/**
 * Varredura do acervo em andamento, ou `null` quando nenhuma corre.
 *
 * O disparo da abertura (`main/index.ts`) e o do canal `conteudo:indexar`
 * chegam os dois a `ingerirAcervo`. Enquanto uma varredura corre, este
 * identificador guarda a promessa dela para que a chamada seguinte se junte à
 * que já está em curso em vez de iniciar outra — duas varreduras concorrentes
 * só disputariam entre si a mesma cota do GitHub.
 */
let varreduraEmAndamento: Promise<ProgressoIngestao> | null = null;

/**
 * Percorre o inventário completando o texto que falta.
 *
 * Uma varredura de cada vez: se já há uma em andamento, a chamada aguarda e
 * devolve o progresso dela. Do contrário, inicia a varredura e a registra até
 * que ela encerre — concluída, suspensa ou interrompida por `cancelarIngestao`.
 */
export function ingerirAcervo(): Promise<ProgressoIngestao> {
  if (varreduraEmAndamento) return varreduraEmAndamento;

  varreduraEmAndamento = varrerAcervo().finally(() => {
    // Liberada no encerramento da varredura, seja qual for o desfecho, para que
    // a próxima chamada comece uma varredura nova em vez de se juntar a uma que
    // já terminou — inclusive depois de uma interrupção por `cancelarIngestao`.
    varreduraEmAndamento = null;
  });
  return varreduraEmAndamento;
}

/**
 * Serial, com uma obtenção por vez — e não o conjunto paralelo que `detalhar`
 * usa na busca. A diferença não é arbitrária: `detalhar` roda com o usuário
 * esperando o resultado na tela, e paralelizar encurta uma espera real; aqui
 * não há ninguém esperando, e o único efeito colateral relevante é consumir a
 * mesma cota de que a busca depende.
 *
 * Incremental e retomável: só toca o que não tem registro vigente, então
 * interromper e chamar de novo continua de onde parou.
 */
async function varrerAcervo(): Promise<ProgressoIngestao> {
  cancelada = false;

  const vazio: ProgressoIngestao = {
    total: 0,
    ingeridos: 0,
    reaproveitados: 0,
    semTexto: 0,
    falhas: 0,
    suspensa: false
  };

  retrato = { ...vazio, estado: 'em-andamento' };

  const token = cofre.obter('github.token');
  if (!token) return suspender(vazio, 'sem-credencial');

  // O inventário também espera a vez: ele é uma requisição como as outras, e
  // dispará-lo durante a rotina de inicialização competiria com ela.
  await aguardarVez();

  let inventario: Documento[];
  try {
    inventario = (await github.buscarDocumentos(token)).dados;
  } catch (erro) {
    // Um estouro de cota ao obter o inventário é limite de requisições, e não
    // uma falha genérica: o usuário precisa saber que basta esperar.
    const motivo: MotivoSuspensao =
      erro instanceof ErroFonte && erro.limiteExcedido
        ? 'limite-requisicoes'
        : 'falha-inventario';
    return suspender(vazio, motivo);
  }

  // O texto de um documento que saiu do repositório não tem mais a que
  // corresponder, e sobreviveria indefinidamente no disco de quem o ingeriu. O
  // snapshot do inventário é gravado no mesmo passo — a busca é servida dele, e
  // um documento que saiu da fonte precisa sair das duas coleções juntas.
  await descartarConteudoAusente(inventario.map((documento) => documento.id));
  await sincronizarInventario(inventario);

  // Quais documentos ainda precisam ter a autoria resolvida — os novos e os que
  // tiveram o `sha` do blob alterado desde a última varredura.
  const pendentesAutoria = new Set(await idsComAutoriaPendente());

  let progresso: ProgressoIngestao = { ...vazio, total: inventario.length };
  let acumulado = await totalDeCaracteres();

  // Cada avanço nas contagens é copiado para o retrato, para que a consulta de
  // progresso feita pelo renderer acompanhe a varredura enquanto ela corre.
  const avancar = (mudanca: Partial<ProgressoIngestao>): void => {
    progresso = { ...progresso, ...mudanca };
    retrato = { ...progresso, estado: 'em-andamento' };
  };
  retrato = { ...progresso, estado: 'em-andamento' };

  for (const documento of inventario) {
    if (cancelada) {
      return suspender(progresso, 'interrompida');
    }

    if (acumulado >= LIMITE_CARACTERES_TOTAL) {
      return suspender(progresso, 'limite-armazenamento');
    }

    // Autoria: resolvida aqui, uma vez, para que a busca não gaste uma
    // requisição por documento a cada consulta. Falhar a obtenção não é falha da
    // varredura — o documento fica no snapshot sem autor, encontrável pelo nome,
    // e a varredura seguinte tenta de novo. `autoriaDoArquivo` já engole os
    // próprios erros e devolve `null`.
    if (
      pendentesAutoria.has(documento.id) &&
      documento.repositorio &&
      documento.caminho
    ) {
      await aguardarVez();
      const autoria = await github.autoriaDoArquivo(
        token,
        documento.repositorio,
        documento.caminho
      );
      if (autoria) {
        await gravarAutoria(documento.id, {
          autor: autoria.autor,
          dataModificacao: autoria.dataModificacao,
          versaoAutoria: documento.versaoConteudo ?? null
        });
      }
    }

    // Cede a vez: enquanto o usuário espera uma busca, o trabalho de fundo para.
    await aguardarVez();

    const guardado = await lerConteudo(documento.id);
    if (estaVigente(guardado, documento)) {
      avancar({ reaproveitados: progresso.reaproveitados + 1 });
      continue;
    }

    try {
      const registro = await ingerirDocumento(documento, token);
      if (!registro) continue;

      if (registro.estado === 'extraido') {
        acumulado += registro.texto.length;
        avancar({ ingeridos: progresso.ingeridos + 1 });
      } else {
        avancar({ semTexto: progresso.semTexto + 1 });
      }
    } catch (erro) {
      // Estouro de cota interrompe tudo: continuar só produziria uma sequência
      // de recusas. Qualquer outra falha é daquele documento, e a varredura
      // segue — um arquivo ilegível não pode parar o acervo.
      if (erro instanceof ErroFonte && erro.limiteExcedido) {
        return suspender(progresso, 'limite-requisicoes');
      }
      avancar({ falhas: progresso.falhas + 1 });
    }
  }

  retrato = { ...progresso, estado: 'concluida' };
  return progresso;
}
