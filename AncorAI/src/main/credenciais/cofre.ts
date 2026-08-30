import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { safeStorage } from 'electron';

/**
 * Cofre de credenciais (ADR-0003).
 *
 * As credenciais são cifradas pelo `safeStorage`, que delega a proteção ao
 * chaveiro do sistema operacional. Este módulo vive exclusivamente no processo
 * main: nenhuma função aqui é alcançável pelo renderer, e nenhum canal IPC
 * devolve o valor lido por `obter`.
 */

/**
 * Chaves guardadas no cofre.
 *
 * A chave do Gemini recebe exatamente o mesmo tratamento do token do GitHub —
 * cifrada pelo sistema operacional, gravada em mão única, nunca devolvida ao
 * renderer. Ela não é uma fonte de documentos, mas é um segredo, e é isso que
 * decide onde ela mora.
 */
export type ChaveCredencial = 'github.token' | 'gemini.chave';

let diretorioCofre = '';

export function inicializarCofre(diretorio: string): void {
  diretorioCofre = join(diretorio, 'credenciais');
  if (!existsSync(diretorioCofre)) {
    mkdirSync(diretorioCofre, { recursive: true, mode: 0o700 });
  }
}

function caminho(chave: ChaveCredencial): string {
  if (!diretorioCofre) throw new Error('Cofre de credenciais não foi inicializado.');
  return join(diretorioCofre, `${chave.replace('.', '_')}.bin`);
}

/**
 * Indica se o sistema operacional oferece cifragem.
 *
 * Quando indisponível, gravar uma credencial falha de forma explícita em vez de
 * cair silenciosamente para texto plano — armazenar um token legível em disco
 * seria justamente o que a ADR-0003 recusou.
 */
export function cifragemDisponivel(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function definir(chave: ChaveCredencial, valor: string): void {
  if (!cifragemDisponivel()) {
    throw new Error(
      'O sistema operacional não disponibilizou um mecanismo de cifragem. ' +
        'A credencial não foi gravada.'
    );
  }
  writeFileSync(caminho(chave), safeStorage.encryptString(valor), { mode: 0o600 });
}

export function obter(chave: ChaveCredencial): string | null {
  const arquivo = caminho(chave);
  if (!existsSync(arquivo)) return null;
  try {
    return safeStorage.decryptString(readFileSync(arquivo));
  } catch {
    // Credencial ilegível (chaveiro trocado, perfil migrado) equivale a ausente.
    return null;
  }
}

export function remover(chave: ChaveCredencial): void {
  rmSync(caminho(chave), { force: true });
}

export function existe(chave: ChaveCredencial): boolean {
  return existsSync(caminho(chave));
}
