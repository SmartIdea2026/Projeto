import type {
  Documento,
  EstadoConexao,
  Filtros,
  Fonte,
  ResultadoBusca,
  StatusFonte
} from '../../compartilhado/tipos';
import * as cofre from '../credenciais/cofre';
import * as github from './github';
import * as drive from './drive';
import { obterAcesso, esquecerAcesso } from '../oauth/google';
import { ErroFonte, aplicarFiltros, fonteSelecionada, ordenar, unificar } from './comum';
import { gravarValidacao, invalidarValidacao, lerValidacao } from '../credenciais/validacao';
import { gravarCache, lerCache } from '../banco/indice';

/**
 * Orquestra as duas fontes.
 *
 * A regra central é que a falha de uma fonte nunca impede a apresentação dos
 * resultados da outra (CB05): cada fonte é consultada de forma independente e
 * as falhas são coletadas para exibição, em vez de interromper a busca.
 */

interface CredenciaisDrive {
  clientId: string;
  refreshToken: string;
}

function credenciaisDrive(): CredenciaisDrive | null {
  const clientId = cofre.obter('drive.clientId');
  const refreshToken = cofre.obter('drive.refreshToken');
  if (!clientId || !refreshToken) return null;
  return { clientId, refreshToken };
}

function mensagemDe(erro: unknown): string {
  if (erro instanceof ErroFonte) return erro.message;
  return 'Ocorreu uma falha inesperada ao consultar a fonte.';
}

/** Executa as consultas às fontes selecionadas, isolando as falhas. */
async function coletar(
  filtros: Filtros,
  doGithub: (token: string) => Promise<Documento[]>,
  doDrive: (credenciais: CredenciaisDrive) => Promise<Documento[]>
): Promise<ResultadoBusca> {
  const documentos: Documento[] = [];
  const falhas: ResultadoBusca['falhas'] = [];
  const tarefas: Array<Promise<void>> = [];

  if (fonteSelecionada(filtros, 'github')) {
    const token = cofre.obter('github.token');
    if (token) {
      tarefas.push(
        doGithub(token)
          .then((encontrados) => {
            documentos.push(...encontrados);
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

  if (fonteSelecionada(filtros, 'drive')) {
    const credenciais = credenciaisDrive();
    if (credenciais) {
      tarefas.push(
        doDrive(credenciais)
          .then((encontrados) => {
            documentos.push(...encontrados);
          })
          .catch((erro) => {
            falhas.push({
              fonte: 'drive',
              mensagem: mensagemDe(erro),
              limiteExcedido: erro instanceof ErroFonte && erro.limiteExcedido
            });
          })
      );
    } else {
      falhas.push({ fonte: 'drive', mensagem: 'O Google Drive não está conectado.' });
    }
  }

  await Promise.all(tarefas);
  return { documentos: unificar(documentos), falhas, doCache: false };
}

export async function buscar(filtros: Filtros): Promise<ResultadoBusca> {
  const bruto = await coletar(
    filtros,
    (token) => github.buscarDocumentos(token),
    ({ clientId, refreshToken }) =>
      drive.buscarDocumentos(clientId, refreshToken, filtros.termo)
  );

  return {
    ...bruto,
    documentos: ordenar(aplicarFiltros(bruto.documentos, filtros), filtros.ordenacao)
  };
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
    { documentos: entrada.payload, falhas: [], doCache: true },
    filtros
  );
}

export async function recentes(filtros: Filtros): Promise<ResultadoBusca> {
  const bruto = await coletar(
    filtros,
    (token) => github.documentosRecentes(token),
    ({ clientId, refreshToken }) => drive.documentosRecentes(clientId, refreshToken)
  );

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
  const credenciais = credenciaisDrive();

  return Promise.all([
    statusDaFonte('github', token, () => github.verificarCredencial(token!), reaproveitar),
    statusDaFonte(
      'drive',
      credenciais && `${credenciais.clientId}:${credenciais.refreshToken}`,
      () => drive.verificarCredencial(credenciais!.clientId, credenciais!.refreshToken),
      reaproveitar
    )
  ]);
}

export async function validarTokenGithub(token: string): Promise<string> {
  return github.verificarCredencial(token);
}

export async function validarDrive(clientId: string, refreshToken: string): Promise<string> {
  esquecerAcesso();
  await invalidarValidacao('drive');
  await obterAcesso(clientId, refreshToken);
  return drive.verificarCredencial(clientId, refreshToken);
}
