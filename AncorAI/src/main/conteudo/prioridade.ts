/**
 * Prioridade entre o trabalho interativo e o trabalho de fundo.
 *
 * A busca e a ingestão consomem a mesma cota do GitHub, e só uma delas tem
 * alguém esperando na tela. Um trabalho sem pressa não deve disputar cota com
 * um trabalho com pressa, então a ingestão espera a vez enquanto houver busca
 * em andamento.
 *
 * A espera é de mão única de propósito: a ingestão espera pela busca, a busca
 * nunca espera pela ingestão. Fosse recíproco, o usuário pagaria pelo trabalho
 * de fundo — exatamente o que se quer evitar.
 */

let interativas = 0;
let liberar: (() => void) | null = null;
let vez: Promise<void> = Promise.resolve();

/** Executa uma operação interativa, sinalizando que ela tem prioridade. */
export async function comoInterativa<T>(tarefa: () => Promise<T>): Promise<T> {
  if (interativas === 0) {
    vez = new Promise<void>((resolver) => {
      liberar = resolver;
    });
  }
  interativas += 1;

  try {
    return await tarefa();
  } finally {
    interativas -= 1;
    if (interativas === 0) {
      liberar?.();
      liberar = null;
    }
  }
}

/** Resolve assim que não houver operação interativa em andamento. */
export function aguardarVez(): Promise<void> {
  return interativas === 0 ? Promise.resolve() : vez;
}

/** Verdadeiro enquanto alguma operação interativa estiver em andamento. */
export function haInterativaEmAndamento(): boolean {
  return interativas > 0;
}
