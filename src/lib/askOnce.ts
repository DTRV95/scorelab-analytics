/**
 * Perguntar uma vez por sessão, e guardar a ida.
 *
 * Quatro coisas distintas precisavam disto ao mesmo tempo: o preço do
 * mercado, o registo do modelo na liga, o exagero medido por mercado e
 * as nossas pernas fechadas. Todas elas são lidas sempre que uma linha
 * do quadro abre, todas elas mudam uma vez por dia ou menos, e abrir e
 * fechar a mesma linha três vezes pedia-as três vezes.
 *
 * Guarda-se a promessa e não o resultado, para que duas perguntas ao
 * mesmo tempo partilhem a mesma ida em vez de fazerem duas.
 *
 * Uma falha não fica guardada. Guardar o "não deu" deixava o ecrã sem
 * aquele dado até alguém recarregar a página, e a próxima vez que a
 * linha abrir é exactamente o momento certo para tentar outra vez.
 */
const held = new Map<string, Promise<unknown>>();

export function askOnce<T>(key: string, ask: () => Promise<T>): Promise<T> {
  const seen = held.get(key) as Promise<T> | undefined;
  if (seen) return seen;

  const asking = ask();
  held.set(key, asking);
  asking.catch(() => held.delete(key));
  return asking;
}

/** Esquecer o que se guardou. Só os testes precisam disto. */
export function forgetAsked(): void {
  held.clear();
}
