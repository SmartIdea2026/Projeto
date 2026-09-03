import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { ConfigVoz } from './config';

/**
 * Estado do modelo de transcrição no disco.
 *
 * O estado é **derivado do disco**, nunca persistido: uma flag "modelo baixado"
 * separada da realidade do sistema de arquivos divergiria na primeira limpeza
 * de cache. A verificação é por hash — presença de arquivo não basta, um
 * download interrompido deixa arquivos parciais.
 *
 * Não importa `electron`: o diretório de dados chega de fora, para o teste
 * poder apontar para uma pasta temporária.
 */

/** Raiz do cache do transformers.js — `<userData>/modelos`. */
export function raizModelos(diretorioDados: string): string {
  return join(diretorioDados, 'modelos');
}

/**
 * Pasta onde os arquivos do modelo ficam, e onde o manifesto é ancorado.
 *
 * Ao pedir uma revisão específica, o transformers.js grava em
 * `<cacheDir>/<org>/<modelo>/<revisão>/…` — a revisão **entra no caminho**.
 * (Sem revisão, o layout é achatado; por isso o manifesto é relativo a esta
 * pasta, não à raiz.)
 */
export function pastaDoModelo(diretorioDados: string, config: ConfigVoz): string {
  return join(raizModelos(diretorioDados), ...config.modelo.split('/'), config.revisao);
}

async function sha256(caminho: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(caminho)
      .on('data', (parte) => hash.update(parte))
      .on('error', reject)
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * `true` quando todos os arquivos do manifesto existem e batem com o hash.
 *
 * Qualquer divergência — arquivo ausente, tamanho zero, hash diferente —
 * devolve `false`: o modelo é tratado como não baixado, e a interface não
 * apresenta o microfone.
 */
export async function modeloIntegro(
  diretorioDados: string,
  config: ConfigVoz
): Promise<boolean> {
  const base = pastaDoModelo(diretorioDados, config);

  for (const [relativo, esperado] of Object.entries(config.manifesto)) {
    const caminho = join(base, ...relativo.split('/'));
    try {
      const info = await stat(caminho);
      if (!info.isFile() || info.size === 0) return false;
      if ((await sha256(caminho)) !== esperado) return false;
    } catch {
      return false;
    }
  }

  return true;
}

/** Remove a pasta do modelo — um download que falhou não deixa rastro reutilizável. */
export async function apagarModelo(
  diretorioDados: string,
  config: ConfigVoz
): Promise<void> {
  await rm(pastaDoModelo(diretorioDados, config), { recursive: true, force: true });
}
