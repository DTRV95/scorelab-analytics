import { buildApiUrl } from "@/lib/apiConfig";

export interface AccuracyMarket {
  market: string;
  grupo: string;
  samples: number;
  predicted_pct: number;
  actual_pct: number;
  gap_pp: number;
  brier: number;
}

export interface AccuracyBand {
  bucket: string;
  samples: number;
  predicted_pct: number;
  actual_pct: number;
  gap_pp: number;
}

export interface LeagueAccuracy {
  league: string;
  season: number | null;
  fixtures_scored: number;
  fixtures_skipped: number;
  predictions: number;
  brier: number;
  headline: {
    predictions: number;
    predicted_pct: number;
    actual_pct: number;
  };
  markets: AccuracyMarket[];
  calibration: AccuracyBand[];
}

export interface AccuracyReport extends LeagueAccuracy {
  leagues: string[];
  unavailable: string[];
}

function round(value: number, decimals = 1) {
  return Number(value.toFixed(decimals));
}

/**
 * Pooled rate: the share of a weighted total, not the average of the parts.
 *
 * Averaging each league's hit rate would let a competition with thirty scored
 * matches pull as hard as one with three hundred.
 */
function pooled(rates: { pct: number; samples: number }[]): number {
  const samples = rates.reduce((sum, row) => sum + row.samples, 0);
  if (samples === 0) return 0;
  const hits = rates.reduce((sum, row) => sum + (row.pct / 100) * row.samples, 0);
  return round((hits / samples) * 100);
}

/**
 * One report out of several competitions.
 *
 * Every figure is pooled by sample count, so the combined view says what the
 * model did across all the matches rather than what it did in an average
 * league.
 */
export function mergeAccuracy(reports: LeagueAccuracy[]): AccuracyReport {
  const markets = new Map<string, AccuracyMarket[]>();
  const bands = new Map<string, AccuracyBand[]>();

  reports.forEach((report) => {
    report.markets.forEach((row) => {
      markets.set(row.market, [...(markets.get(row.market) ?? []), row]);
    });
    report.calibration.forEach((row) => {
      bands.set(row.bucket, [...(bands.get(row.bucket) ?? []), row]);
    });
  });

  const mergedMarkets: AccuracyMarket[] = [...markets.entries()]
    .map(([market, rows]) => {
      const samples = rows.reduce((sum, row) => sum + row.samples, 0);
      const predicted = pooled(rows.map((r) => ({ pct: r.predicted_pct, samples: r.samples })));
      const actual = pooled(rows.map((r) => ({ pct: r.actual_pct, samples: r.samples })));
      return {
        market,
        grupo: rows[0].grupo,
        samples,
        predicted_pct: predicted,
        actual_pct: actual,
        gap_pp: round(actual - predicted),
        brier: samples
          ? round(
              rows.reduce((sum, row) => sum + row.brier * row.samples, 0) / samples,
              4
            )
          : 0,
      };
    })
    .sort((a, b) => a.market.localeCompare(b.market));

  const mergedBands: AccuracyBand[] = [...bands.entries()]
    .map(([bucket, rows]) => {
      const samples = rows.reduce((sum, row) => sum + row.samples, 0);
      const predicted = pooled(rows.map((r) => ({ pct: r.predicted_pct, samples: r.samples })));
      const actual = pooled(rows.map((r) => ({ pct: r.actual_pct, samples: r.samples })));
      return {
        bucket,
        samples,
        predicted_pct: predicted,
        actual_pct: actual,
        gap_pp: round(actual - predicted),
      };
    })
    .sort((a, b) => Number(a.bucket.split("-")[0]) - Number(b.bucket.split("-")[0]));

  const predictions = reports.reduce((sum, r) => sum + r.predictions, 0);
  const headlinePredictions = reports.reduce((sum, r) => sum + r.headline.predictions, 0);

  return {
    league: reports.length === 1 ? reports[0].league : "Todas as ligas",
    season: reports[0]?.season ?? null,
    leagues: reports.map((r) => r.league),
    unavailable: [],
    fixtures_scored: reports.reduce((sum, r) => sum + r.fixtures_scored, 0),
    fixtures_skipped: reports.reduce((sum, r) => sum + r.fixtures_skipped, 0),
    predictions,
    brier: predictions
      ? round(
          reports.reduce((sum, r) => sum + r.brier * r.predictions, 0) / predictions,
          4
        )
      : 0,
    headline: {
      predictions: headlinePredictions,
      predicted_pct: pooled(
        reports.map((r) => ({ pct: r.headline.predicted_pct, samples: r.headline.predictions }))
      ),
      actual_pct: pooled(
        reports.map((r) => ({ pct: r.headline.actual_pct, samples: r.headline.predictions }))
      ),
    },
    markets: mergedMarkets,
    calibration: mergedBands,
  };
}

/**
 * How far off a band is before it is worth calling out.
 *
 * Small samples wander on their own: eleven matches in a band will miss by a
 * few points through luck alone, and flagging that as a flaw in the model
 * would be reading noise.
 */
export function bandVerdict(band: AccuracyBand): "sharp" | "over" | "under" | "thin" {
  if (band.samples < 30) return "thin";
  if (band.gap_pp <= -5) return "over";
  if (band.gap_pp >= 5) return "under";
  return "sharp";
}

export async function fetchLeagueAccuracy(
  league: string,
  season?: number
): Promise<LeagueAccuracy> {
  const query = new URLSearchParams({ league });
  if (season) query.set("season", String(season));

  const response = await fetch(buildApiUrl(`/data/model-accuracy?${query}`));
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

/**
 * Scores every competition, one request each.
 *
 * Sequential on purpose: a season is a simulation per match on the server, and
 * eight at once is how you turn a slow page into a rate-limited one. A league
 * that fails is named rather than silently dropped — a missing competition
 * changes what the totals mean.
 */
export async function fetchAccuracyReport(
  leagues: string[],
  season?: number
): Promise<AccuracyReport> {
  const reports: LeagueAccuracy[] = [];
  const unavailable: string[] = [];

  for (const league of leagues) {
    try {
      reports.push(await fetchLeagueAccuracy(league, season));
    } catch {
      unavailable.push(league);
    }
  }

  if (reports.length === 0) {
    throw new Error("Nenhuma competição respondeu.");
  }

  return { ...mergeAccuracy(reports), unavailable };
}
