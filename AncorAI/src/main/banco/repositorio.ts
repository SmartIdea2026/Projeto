import { join } from 'node:path';
import Datastore from '@seald-io/nedb';
import type { Documento, DocumentoAcessado, Fonte } from '../../compartilhado/tipos';

/**
 * Persistência local NoSQL (ADR-0002).
 *
 * O modelo é orientado a documentos, o mesmo adotado na escolha original pelo
 * Firestore, de modo que as estruturas gravadas aqui têm o formato que teriam
 * na nuvem. Armazena apenas o link de redirecionamento dos documentos
 * acessados — nunca o conteúdo. Os campos `resumo` e `resumoEm` existem desde
 * já para que a inclusão futura dos resumos por IA não exija migração.
 *
 * Todo o acesso ao banco está concentrado neste módulo: trocar o armazenamento
 * de documentos por outro deve afetar apenas este arquivo.
 */

interface RegistroAcesso {
  _id: string;
  nome: string;
  fonte: Fonte;
  link: string;
  acessadoEm: string;
  resumo?: string;
  resumoEm?: string;
}

interface RegistroCache {
  _id: string;
  etag: string | null;
  payload: unknown;
  atualizadoEm: string;
}

let acessos: Datastore<RegistroAcesso> | null = null;
let cache: Datastore<RegistroCache> | null = null;

export async function abrirBanco(diretorio: string): Promise<void> {
  if (acessos && cache) return;

  acessos = new Datastore<RegistroAcesso>({
    filename: join(diretorio, 'documentos_acessados.db'),
    autoload: false
  });
  cache = new Datastore<RegistroCache>({
    filename: join(diretorio, 'cache_fontes.db'),
    autoload: false
  });

  await acessos.loadDatabaseAsync();
  await cache.loadDatabaseAsync();
  await acessos.ensureIndexAsync({ fieldName: 'acessadoEm' });
}

export function fecharBanco(): void {
  acessos = null;
  cache = null;
}

function exigir<T>(colecao: Datastore<T> | null): Datastore<T> {
  if (!colecao) throw new Error('Banco de dados não foi inicializado.');
  return colecao;
}

/** Registra o acesso a um documento, guardando apenas o link (RF20). */
export async function registrarAcesso(documento: Documento): Promise<void> {
  await exigir(acessos).updateAsync(
    { _id: documento.id },
    {
      $set: {
        nome: documento.nome,
        fonte: documento.fonte,
        link: documento.link,
        acessadoEm: new Date().toISOString()
      }
    },
    { upsert: true }
  );
}

export async function listarAcessados(limite = 20): Promise<DocumentoAcessado[]> {
  const registros = await exigir(acessos)
    .findAsync({})
    .sort({ acessadoEm: -1 })
    .limit(limite);

  return registros.map((registro) => ({
    id: registro._id,
    nome: registro.nome,
    fonte: registro.fonte,
    link: registro.link,
    acessadoEm: registro.acessadoEm
  }));
}

export interface EntradaCache<T> {
  etag: string | null;
  payload: T;
  atualizadoEm: string;
}

export async function lerCache<T>(chave: string): Promise<EntradaCache<T> | null> {
  const registro = await exigir(cache).findOneAsync({ _id: chave });
  if (!registro) return null;
  return {
    etag: registro.etag,
    payload: registro.payload as T,
    atualizadoEm: registro.atualizadoEm
  };
}

export async function gravarCache(
  chave: string,
  payload: unknown,
  etag: string | null
): Promise<void> {
  await exigir(cache).updateAsync(
    { _id: chave },
    { $set: { etag, payload, atualizadoEm: new Date().toISOString() } },
    { upsert: true }
  );
}
