import { supabase } from "@/lib/supabaseClient";

/**
 * Quanto é que o modelo exagera, mercado a mercado, medido.
 *
 * Havia uma curva única: acima dos 55% descontavam-se até onze pontos, a
 * todos os mercados por igual. Os dados dizem que isso é grosseiro. Em
 * 1695 previsões conferidas, o 1X promete 72% e entrega 61,5% — onze
 * pontos a menos, fora da sua margem — enquanto "Mais de 2.5 Golos"
 * promete 67,2% e entrega 66,3%, que é estar certo. Descontar onze
 * pontos ao segundo é inventar um defeito que ele não tem, e inventar um
 * defeito custa apostas boas que se deixam passar.
 *
 * Um mercado só entra aqui quando tem jogos que cheguem e quando o
 * desvio é maior do que a própria margem de erro. Dos doze mercados com
 * dados, hoje passa um. É suposto ser assim: a alternativa é ler ruído
 * em onze tabelas e chamar-lhe descoberta.
 */

/** Abaixo disto, qualquer desvio é compatível com o acaso. */
export const MIN_SAMPLE = 40;

export interface MarketCalibrationRow {
  mercado: string;
  n: number;
  prometido: number;
  entregue: number;
  desvio: number;
  margem: number;
}

/** Se este mercado já diz alguma coisa, ou se ainda é cedo. */
export function speaks(row: MarketCalibrationRow): boolean {
  return row.n >= MIN_SAMPLE && Math.abs(row.desvio) > row.margem;
}

/**
 * O ajuste por mercado, em pontos, só para os que já se provaram.
 *
 * Negativo quer dizer que o modelo promete a mais e que a probabilidade
 * tem de descer.
 */
export function adjustments(
  rows: MarketCalibrationRow[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    if (speaks(row)) out[row.mercado] = row.desvio;
  }
  return out;
}

export async function fetchMarketCalibration(): Promise<MarketCalibrationRow[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("market_calibration")
    .select("mercado, n, prometido, entregue, desvio, margem")
    .order("n", { ascending: false });

  if (error || !data) return [];

  // O Postgres devolve numeric como texto, para não perder casas.
  return data.map((row) => ({
    mercado: String(row.mercado),
    n: Number(row.n),
    prometido: Number(row.prometido),
    entregue: Number(row.entregue),
    desvio: Number(row.desvio),
    margem: Number(row.margem),
  }));
}
