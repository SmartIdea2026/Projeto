import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CapturaVoz } from '../../compartilhado/tipos';

/**
 * Leitura da configuração da transcrição de voz.
 *
 * A configuração vive em `instrucoes/transcricao.md`, versionada no repositório
 * e lida **em tempo de execução**, no mesmo molde de `llm/instrucao.ts`: os
 * limiares de captura são o tipo de coisa que a equipe vai calibrar sem
 * recompilar, e o manifesto de integridade precisa acompanhar a revisão do
 * modelo em Pull Request.
 *
 * O arquivo é Markdown com dois blocos ```json — `parametros` e `manifesto`.
 * Ler prosa como configuração seria frágil; os blocos delimitados não são.
 *
 * Os caminhos candidatos vêm de fora, como no cofre e na instrução do resumo:
 * este módulo não importa `electron`, e assim continua exercitável em teste.
 */

export type { CapturaVoz };

export interface ConfigVoz {
  modelo: string;
  revisao: string;
  quantizacao: string;
  idioma: string;
  tarefa: string;
  chunkLengthS: number;
  noSpeechThreshold: number;
  captura: CapturaVoz;
  /** `caminho relativo → sha256` de cada arquivo do modelo. */
  manifesto: Record<string, string>;
}

let candidatos: string[] = [];
let emCache: ConfigVoz | null = null;

export function inicializarConfigVoz(...diretorios: string[]): void {
  candidatos = diretorios.map((diretorio) => join(diretorio, 'instrucoes', 'transcricao.md'));
  emCache = null;
}

function blocosJson(markdown: string): unknown[] {
  const blocos: unknown[] = [];
  const regex = /```json\s*([\s\S]*?)```/g;
  let achado: RegExpExecArray | null;
  while ((achado = regex.exec(markdown)) !== null) {
    blocos.push(JSON.parse(achado[1]!));
  }
  return blocos;
}

/**
 * Configuração vigente.
 *
 * Lida uma vez por execução: alterar o arquivo com a aplicação aberta não muda
 * as transcrições até reiniciá-la. `recarregarConfigVoz` existe para o teste
 * exercitar a troca.
 */
export function lerConfigVoz(): ConfigVoz {
  if (emCache !== null) return emCache;

  for (const caminho of candidatos) {
    if (!existsSync(caminho)) continue;

    const [parametros, manifesto] = blocosJson(readFileSync(caminho, 'utf-8'));
    if (!parametros || !manifesto) {
      throw new Error(
        `O arquivo ${caminho} precisa conter dois blocos json: parâmetros e manifesto.`
      );
    }

    emCache = { ...(parametros as Omit<ConfigVoz, 'manifesto'>), manifesto: manifesto as Record<string, string> };
    return emCache;
  }

  throw new Error(
    'A configuração da transcrição de voz não foi encontrada. ' +
      'Esperava-se o arquivo instrucoes/transcricao.md junto à aplicação.'
  );
}

/** Descarta a configuração guardada, forçando nova leitura do arquivo. */
export function recarregarConfigVoz(): void {
  emCache = null;
}
