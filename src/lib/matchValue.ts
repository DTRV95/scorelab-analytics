import { getKellyPct } from "@/lib/calibrationEngine";
import { edgeFor } from "@/lib/betFromBoard";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

export interface MarketForecast {
  mercado: string;
  grupo: string;
  probabilidade_pct: number;
  min_pct: number;
  max_pct: number;
}

export interface ValueRow {
  market: string;
  grupo: string;
  modelProb: number;
  /** The price this probability would be worth with no bookmaker margin. */
  fairOdds: number;
  /** What the range of plausible probabilities implies, worst case. */
  cautiousFairOdds: number;
  odds: number | null;
  edge: number | null;
  /** Edge measured against the pessimistic end of the interval. */
  edgeFloor: number | null;
  stake: number | null;
  /** How this market has actually landed, when there is a record of it. */
  record: AccuracyMarket | null;
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

export function fairOdds(probabilityPct: number): number {
  if (probabilityPct <= 0) return 0;
  return round(100 / probabilityPct);
}

/**
 * One row per market: what the model thinks it is worth, what you are being
 * offered, and what the gap is.
 *
 * The edge is quoted twice on purpose. The headline one uses the model's
 * central estimate; the floor uses the pessimistic end of its own interval,
 * which is the number that decides whether an edge survives the model being
 * somewhat wrong. A bet that only clears on the optimistic reading is not an
 * edge, it is a hope.
 */
export function buildValueRows(
  markets: MarketForecast[],
  odds: Record<string, string>,
  bankroll: number | null,
  record: Map<string, AccuracyMarket> = new Map()
): ValueRow[] {
  return markets.map((market) => {
    const raw = (odds[market.mercado] ?? "").replace(",", ".");
    const parsed = Number(raw);
    const hasOdds = raw.trim() !== "" && Number.isFinite(parsed) && parsed > 1;
    const floorProb = Math.min(market.min_pct, market.max_pct);

    return {
      market: market.mercado,
      grupo: market.grupo,
      modelProb: market.probabilidade_pct,
      fairOdds: fairOdds(market.probabilidade_pct),
      cautiousFairOdds: fairOdds(floorProb),
      odds: hasOdds ? round(parsed) : null,
      edge: hasOdds ? edgeFor(market.probabilidade_pct, parsed) : null,
      edgeFloor: hasOdds ? edgeFor(floorProb, parsed) : null,
      stake:
        hasOdds && bankroll && bankroll > 0
          ? round((bankroll * getKellyPct(market.probabilidade_pct, parsed)) / 100)
          : null,
      record: record.get(market.mercado) ?? null,
    };
  });
}

/**
 * The rows worth acting on, best first.
 *
 * Only priced markets can show value, and only a positive floor counts: that
 * is the whole difference between a bet the model backs and one it merely
 * cannot rule out.
 */
export function valuePicks(rows: ValueRow[]): ValueRow[] {
  return rows
    .filter((row) => row.odds !== null && (row.edgeFloor ?? 0) > 0)
    .sort((a, b) => (b.edgeFloor ?? 0) - (a.edgeFloor ?? 0));
}

/**
 * How much the model has historically over- or under-promised on a market,
 * as a warning to read next to its forecast.
 */
export function recordVerdict(
  record: AccuracyMarket | null
): "sharp" | "over" | "under" | "unknown" {
  if (!record || record.samples < 30) return "unknown";
  if (record.gap_pp <= -5) return "over";
  if (record.gap_pp >= 5) return "under";
  return "sharp";
}
