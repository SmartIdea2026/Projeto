/**
 * Fila de submissões à LLM, com concorrência um.
 *
 * Compartilhada entre o resumo do documento em foco (`resumos.ts`) e a
 * classificação em massa da indexação (`indice-local`). Não são duas filas: é
 * uma só, porque o limite do plano gratuito é por minuto e vale para a chave
 * inteira, não para cada operação separadamente. Disparar três cliques
 * rápidos em paralelo transformaria três resultados em três recusas.
 */

let ultima: Promise<unknown> = Promise.resolve();

export function enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
  const proxima = ultima.then(tarefa, tarefa);
  // A cauda ignora o resultado para que uma submissão que falhou não derrube
  // as seguintes: a fila é de ordem, não de dependência.
  ultima = proxima.catch(() => undefined);
  return proxima;
}
