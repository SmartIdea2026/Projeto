import { gravarCache, lerCache } from '../banco/indice';
import type { EstadoConexao, Fonte } from '../../compartilhado/tipos';

/**
 * Reaproveitamento do resultado da verificação de credenciais.
 *
 * A especificação exige que a validade seja reaproveitada entre execuções, para
 * que abrir a aplicação não gere uma requisição por fonte a cada vez. O
 * resultado é guardado junto de uma impressão da credencial: se o usuário
 * trocar o token, a entrada deixa de valer automaticamente.
 */

const VALIDADE_MS = 12 * 60 * 60 * 1000;

interface Registro {
  estado: EstadoConexao;
  conta?: string;
  impressao: string;
  verificadoEm: string;
}

/**
 * Impressão não reversível da credencial.
 *
 * Guardar o token seria contrário à ADR-0003; o que interessa é apenas saber se
 * a credencial mudou desde a última verificação.
 */
function imprimir(valor: string): string {
  let hash = 0;
  for (let i = 0; i < valor.length; i += 1) {
    hash = (hash * 31 + valor.charCodeAt(i)) | 0;
  }
  return `${hash}:${valor.length}`;
}

function chave(fonte: Fonte): string {
  return `validacao:${fonte}`;
}

export async function lerValidacao(
  fonte: Fonte,
  credencial: string
): Promise<{ estado: EstadoConexao; conta?: string } | null> {
  const entrada = await lerCache<Registro>(chave(fonte));
  if (!entrada) return null;

  const registro = entrada.payload;
  if (registro.impressao !== imprimir(credencial)) return null;
  if (Date.now() - Date.parse(registro.verificadoEm) > VALIDADE_MS) return null;

  // Só um resultado positivo é reaproveitado: uma falha anterior pode ter sido
  // causada por ausência de rede, e merece nova tentativa.
  if (registro.estado !== 'conectada') return null;

  return { estado: registro.estado, conta: registro.conta };
}

export async function gravarValidacao(
  fonte: Fonte,
  credencial: string,
  estado: EstadoConexao,
  conta?: string
): Promise<void> {
  const registro: Registro = {
    estado,
    conta,
    impressao: imprimir(credencial),
    verificadoEm: new Date().toISOString()
  };
  await gravarCache(chave(fonte), registro, null);
}

export async function invalidarValidacao(fonte: Fonte): Promise<void> {
  await gravarCache(chave(fonte), null, null);
}
