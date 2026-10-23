import { supabase } from "@/lib/supabaseClient";
import { askOnce } from "@/lib/askOnce";

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
 * Mas ter jogos que cheguem e um desvio maior do que a margem não basta,
 * e é aqui que isto se separa de uma procura. Um desvio encontrado nos
 * dados que o geraram não prova nada: com doze mercados e meia dúzia de
 * faixas, aparece sempre alguma coisa. Por isso a data da descoberta
 * fica guardada, e a partir dela a mesma conta é refeita **só com jogos
 * que a descoberta não viu**.
 *
 * Um mercado só mexe no cálculo depois de a segunda metade dizer o
 * mesmo que a primeira. Até lá vale a curva geral, que erra para o lado
 * cauteloso.
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
  /** Quando reparámos nisto pela primeira vez. */
  foundAt: string | null;
  /** Jogos que aconteceram depois disso. */
  nDesde: number;
  /** E o que eles dizem, sozinhos. */
  desvioDesde: number | null;
  margemDesde: number | null;
  /** Se a prova de fora da amostra confirma o que se tinha visto. */
  confirmado: boolean;
}

/** Se este mercado chegou para se reparar nele. Ainda não é prova. */
export function noticed(row: MarketCalibrationRow): boolean {
  return row.n >= MIN_SAMPLE && Math.abs(row.desvio) > row.margem;
}

/**
 * Se já se pode mexer nas contas por causa dele.
 *
 * Reparar não chega: a confirmação vem dos jogos posteriores à
 * descoberta, que são os únicos que não ajudaram a encontrá-la.
 */
export function speaks(row: MarketCalibrationRow): boolean {
  return noticed(row) && row.confirmado;
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
  // Uma vez por sessão: isto é refeito por um trabalho nocturno, não
  // entre dois toques numa linha do quadro.
  return askOnce("calibracao", askCalibration);
}

async function askCalibration(): Promise<MarketCalibrationRow[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("calibration_status")
    .select(
      "mercado, n, prometido, entregue, desvio, margem, found_at, n_desde, desvio_desde, margem_desde, confirmado",
    )
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
    foundAt: row.found_at ? String(row.found_at) : null,
    nDesde: Number(row.n_desde ?? 0),
    desvioDesde: row.desvio_desde === null ? null : Number(row.desvio_desde),
    margemDesde: row.margem_desde === null ? null : Number(row.margem_desde),
    confirmado: Boolean(row.confirmado),
  }));
}
