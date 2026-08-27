import type { Documento } from '../../compartilhado/tipos';
import { ErroFonte, extensaoDe, extensaoEhAceita } from './comum';
import { obterAcesso } from '../oauth/google';

/**
 * Integração com a API do Google Drive.
 *
 * Diferente do GitHub, o Drive resolve busca e recentes em uma única requisição
 * cada, porque a própria API filtra por nome, tipo e data e ordena o resultado.
 */

const BASE = 'https://www.googleapis.com/drive/v3';

/** Tipos MIME correspondentes às extensões aceitas pelo sistema. */
const MIMES = [
  'text/markdown',
  'text/plain',
  'application/pdf',
  'application/epub+zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet'
];

interface ArquivoApi {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime: string;
  webViewLink?: string;
}

interface ListaApi {
  files?: ArquivoApi[];
}

const CAMPOS = 'files(id,name,mimeType,createdTime,modifiedTime,webViewLink)';

/** Extensão sintética para os formatos nativos do Google, que não têm uma. */
function extensaoDoArquivo(arquivo: ArquivoApi): string {
  const daNome = extensaoDe(arquivo.name);
  if (daNome) return daNome;
  if (arquivo.mimeType === 'application/vnd.google-apps.document') return 'doc';
  if (arquivo.mimeType === 'application/vnd.google-apps.spreadsheet') return 'xls';
  return '';
}

function converter(arquivo: ArquivoApi): Documento {
  return {
    id: `drive:${arquivo.id}`,
    nome: arquivo.name,
    extensao: extensaoDoArquivo(arquivo),
    fonte: 'drive',
    dataModificacao: arquivo.modifiedTime,
    dataCriacao: arquivo.createdTime,
    link: arquivo.webViewLink ?? `https://drive.google.com/file/d/${arquivo.id}/view`
  };
}

async function consultar(acesso: string, parametros: URLSearchParams): Promise<Documento[]> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}/files?${parametros}`, {
      headers: { Authorization: `Bearer ${acesso}` }
    });
  } catch {
    throw new ErroFonte('drive', 'Não foi possível alcançar o Google Drive.');
  }

  if (resposta.status === 401) {
    throw new ErroFonte('drive', 'A autorização do Google Drive não é mais válida.');
  }
  if (resposta.status === 403 || resposta.status === 429) {
    throw new ErroFonte(
      'drive',
      'O limite de uso da API do Google Drive foi atingido. Tente novamente mais tarde.',
      true
    );
  }
  if (!resposta.ok) {
    throw new ErroFonte('drive', `O Google Drive respondeu com o código ${resposta.status}.`);
  }

  const dados = (await resposta.json()) as ListaApi;
  return (dados.files ?? [])
    .map(converter)
    .filter((documento) => extensaoEhAceita(`x.${documento.extensao}`));
}

function filtroDeTipos(): string {
  return `(${MIMES.map((mime) => `mimeType='${mime}'`).join(' or ')})`;
}

export async function verificarCredencial(
  clientId: string,
  refreshToken: string
): Promise<string> {
  const acesso = await obterAcesso(clientId, refreshToken);
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}/about?fields=user(emailAddress)`, {
      headers: { Authorization: `Bearer ${acesso}` }
    });
  } catch {
    throw new ErroFonte('drive', 'Não foi possível alcançar o Google Drive.');
  }
  if (!resposta.ok) {
    throw new ErroFonte('drive', 'A autorização do Google Drive não é mais válida.');
  }
  const dados = (await resposta.json()) as { user?: { emailAddress?: string } };
  return dados.user?.emailAddress ?? 'conta conectada';
}

export async function buscarDocumentos(
  clientId: string,
  refreshToken: string,
  termo: string
): Promise<Documento[]> {
  const acesso = await obterAcesso(clientId, refreshToken);
  const condicoes = ['trashed = false', filtroDeTipos()];
  if (termo.trim()) {
    // O apóstrofo encerraria a string da consulta: escapá-lo evita que um termo
    // de busca altere a estrutura do filtro enviado à API.
    condicoes.push(`name contains '${termo.trim().replace(/'/g, "\\'")}'`);
  }

  return consultar(
    acesso,
    new URLSearchParams({
      q: condicoes.join(' and '),
      fields: CAMPOS,
      pageSize: '100',
      orderBy: 'modifiedTime desc',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    })
  );
}

export async function documentosRecentes(
  clientId: string,
  refreshToken: string
): Promise<Documento[]> {
  const acesso = await obterAcesso(clientId, refreshToken);
  return consultar(
    acesso,
    new URLSearchParams({
      q: `trashed = false and ${filtroDeTipos()}`,
      fields: CAMPOS,
      pageSize: '20',
      orderBy: 'modifiedTime desc',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true'
    })
  );
}
