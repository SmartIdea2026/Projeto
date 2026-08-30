import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Leitura da instrução de redação do resumo.
 *
 * A instrução vive em `instrucoes/resumo.md`, versionada no repositório, e é
 * lida **em tempo de execução**. A qualidade do resumo depende inteiramente
 * dela, e é o tipo de artefato que a equipe vai querer ajustar sem recompilar —
 * e revisar em Pull Request como qualquer outro documento.
 *
 * Os caminhos candidatos são recebidos de fora, e não descobertos aqui, pelo
 * mesmo motivo do cofre: este módulo não importa `electron`, e assim continua
 * exercitável em teste sem subir a aplicação.
 */

let candidatos: string[] = [];
let emCache: string | null = null;

export function inicializarInstrucao(...diretorios: string[]): void {
  candidatos = diretorios.map((diretorio) => join(diretorio, 'instrucoes', 'resumo.md'));
  emCache = null;
}

/**
 * Instrução vigente.
 *
 * O conteúdo é lido uma vez por execução: alterar o arquivo com a aplicação
 * aberta não muda os resumos até reiniciá-la, o que é aceitável para um arquivo
 * que se revisa em Pull Request. `recarregarInstrucao` existe para o teste
 * poder exercitar a troca sem reiniciar nada.
 */
export function lerInstrucao(): string {
  if (emCache !== null) return emCache;

  for (const caminho of candidatos) {
    if (existsSync(caminho)) {
      emCache = readFileSync(caminho, 'utf-8');
      return emCache;
    }
  }

  throw new Error(
    'A instrução de redação do resumo não foi encontrada. ' +
      'Esperava-se o arquivo instrucoes/resumo.md junto à aplicação.'
  );
}

/** Descarta o conteúdo guardado, forçando nova leitura do arquivo. */
export function recarregarInstrucao(): void {
  emCache = null;
}
