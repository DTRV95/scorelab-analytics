import { supabase } from "@/lib/supabaseClient";

/**
 * O registo do próprio quadro: o que ele disse, contra o que aconteceu.
 *
 * É outra coisa do que o relatório por competição que está no resto desta
 * página. Esse é um backtest — pega numa época inteira e refaz as previsões
 * para a medir. Isto é o registo do que esteve mesmo no ecrã, jogo a jogo,
 * mercado a mercado, guardado à medida que os resultados chegam.
 *
 * Existe porque o quadro marcado vive numa linha só, substituída de três em
 * três horas: cada passagem media os últimos sete dias e apagava a anterior.
 * E a medição não se refaz — a previsão de um jogo precisa da época como
 * estava antes dele, que deixa de existir assim que ele entra nela.
 */
export interface MarketRecord {
  mercado: string;
  /** Quantos jogos este mercado já foi medido. */
  n: number;
  /** A média do que o modelo prometeu, já calibrada. */
  said_pct: number;
  /** O que aconteceu. */
  hit_pct: number;
  /** A diferença, em pontos. Positivo: o modelo está a prometer a menos. */
  bias_pp: number;
}

/**
 * A margem de erro da taxa, em pontos, a dois desvios-padrão.
 *
 * Esta função é a lição de uma leitura errada minha. Com setenta e nove
 * jogos, o registo dizia que o empate aparecia 13,9% das vezes contra os
 * 26,6% prometidos, e isso lia-se como um modelo a prometer empates a mais.
 * Só que o futebol dá uns 25% de empates e setenta e nove jogos dão uma
 * margem de onze pontos: a semana é que teve poucos empates.
 *
 * Um desvio sem a margem ao lado é um número que convida a ser lido como
 * uma conclusão. Aqui vêm sempre os dois.
 */
export function margin(row: Pick<MarketRecord, "n" | "hit_pct">): number {
  if (row.n <= 0) return 100;
  const p = Math.min(Math.max(row.hit_pct / 100, 0), 1);
  return Number((2 * Math.sqrt((p * (1 - p)) / row.n) * 100).toFixed(1));
}

/** Verdadeiro quando o desvio é maior do que a margem — e só então. */
export function tellsSomething(row: MarketRecord): boolean {
  return Math.abs(row.bias_pp) > margin(row);
}

export async function fetchModelRecord(): Promise<MarketRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("model_record_markets");
  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    mercado: String(row.mercado),
    n: Number(row.n),
    said_pct: Number(row.said_pct),
    hit_pct: Number(row.hit_pct),
    bias_pp: Number(row.bias_pp),
  }));
}

/**
 * Pior primeiro, mas só entre os que dizem alguma coisa.
 *
 * Ordenar tudo pelo desvio põe no topo quem tem a amostra mais pequena,
 * porque é aí que o acaso é maior. Quem já passou da sua margem vem à
 * frente, e dentro de cada grupo manda o tamanho do desvio.
 */
export function byWhatItTells(rows: MarketRecord[]): MarketRecord[] {
  return [...rows].sort((a, b) => {
    const diz = Number(tellsSomething(b)) - Number(tellsSomething(a));
    if (diz !== 0) return diz;
    return Math.abs(b.bias_pp) - Math.abs(a.bias_pp);
  });
}
