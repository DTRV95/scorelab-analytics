import type {
  AnalysisResult,
  ModelAuditMarketResult,
  ModelAuditSnapshot,
  SavedAnalysis,
} from "@/types/analysis";

export interface ModelAuditMarketPerformance {
  market: string;
  samples: number;
  greens: number;
  reds: number;
  hitRate: number;
  avgModelProb: number;
  brierScore: number;
  avgEdge: number;
}

export interface ModelAuditSummary {
  auditedMatches: number;
  auditedMarkets: number;
  greens: number;
  reds: number;
  hitRate: number;
  avgModelProb: number;
  brierScore: number;
  bestMarket: ModelAuditMarketPerformance | null;
  weakestMarket: ModelAuditMarketPerformance | null;
  marketPerformance: ModelAuditMarketPerformance[];
}

function normalizeMarket(market: string): string {
  return market.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Every way a goals line is written across the app, English and Portuguese.
 *
 * Spelled out in words only. A bare "+1.5" or "-3.5" would also match a
 * handicap, which this function must leave unsettled.
 */
const OVER_15 = ["over 1.5", "mais de 1.5", "+ de 1.5", "+ de 1,5"];
const UNDER_35 = ["under 3.5", "menos de 3.5", "- de 3.5", "- de 3,5"];
const OVER_35 = ["over 3.5", "mais de 3.5"];
const OVER_25 = ["over 2.5", "mais de 2.5"];
const UNDER_25 = ["under 2.5", "menos de 2.5"];

function says(market: string, phrases: string[]): boolean {
  return phrases.some((phrase) => market.includes(phrase));
}

/**
 * Did this market win, given the final score?
 *
 * `null` means the market cannot be settled from the score alone (corners,
 * cards, handicaps), and must stay with the user.
 */
export function isGreenMarket(
  market: string,
  homeGoals: number,
  awayGoals: number
): boolean | null {
  const normalized = normalizeMarket(market);
  const totalGoals = homeGoals + awayGoals;
  const homeWin = homeGoals > awayGoals;
  const draw = homeGoals === awayGoals;
  const awayWin = awayGoals > homeGoals;
  const under35 = totalGoals <= 3;
  const over15 = totalGoals >= 2;

  // One list of phrasings per line, shared by the plain markets and the double
  // chance combos. Spelling them out branch by branch is how the combos came to
  // read only the goals half of a Portuguese name and settle it as if the
  // result half had won.
  const saysOver15 = says(normalized, OVER_15);
  const saysUnder35 = says(normalized, UNDER_35);

  if (normalized.includes("1x") && saysOver15) {
    return (homeWin || draw) && over15;
  }

  if (normalized.includes("2x") && saysOver15) {
    return (awayWin || draw) && over15;
  }

  if (normalized.includes("1x") && saysUnder35) {
    return (homeWin || draw) && under35;
  }

  if (normalized.includes("2x") && saysUnder35) {
    return (awayWin || draw) && under35;
  }

  if (normalized === "home" || normalized === "casa") return homeWin;
  if (normalized === "draw" || normalized === "empate") return draw;
  if (normalized === "away" || normalized === "fora") return awayWin;
  if (normalized === "1x") return homeWin || draw;
  if (normalized === "2x") return awayWin || draw;
  if (says(normalized, OVER_25)) return totalGoals >= 3;
  if (says(normalized, UNDER_25)) return totalGoals <= 2;
  if (says(normalized, OVER_35)) return totalGoals >= 4;
  if (saysUnder35) return totalGoals <= 3;
  if (normalized.includes("btts yes") || normalized === "btts" || normalized.includes("ambas marcam")) {
    return homeGoals > 0 && awayGoals > 0;
  }
  if (normalized.includes("btts no") || normalized.includes("ambas nao") || normalized.includes("ambas não")) {
    return homeGoals === 0 || awayGoals === 0;
  }

  return null;
}

function buildOutcome(
  result: AnalysisResult,
  homeGoals: number,
  awayGoals: number
): ModelAuditMarketResult {
  const green = isGreenMarket(result.market, homeGoals, awayGoals);

  return {
    market: result.market,
    outcome: green === null ? "void" : green ? "green" : "red",
    odds: result.odds,
    modelProb: result.rawModelProb ?? result.modelProb,
    impliedProb: result.impliedProb,
    valueBet: result.valueBet,
    confidence: result.confidence,
    decision: result.decision,
    tier: result.tier,
  };
}

export function buildModelAuditSnapshot({
  analysis,
  homeGoals,
  awayGoals,
}: {
  analysis: SavedAnalysis;
  homeGoals: number;
  awayGoals: number;
}): ModelAuditSnapshot {
  return {
    homeGoals,
    awayGoals,
    auditedAt: new Date().toISOString(),
    outcomes: analysis.results.map((result) =>
      buildOutcome(result, homeGoals, awayGoals)
    ),
  };
}

function finalizeMarketPerformance(
  market: string,
  items: ModelAuditMarketResult[]
): ModelAuditMarketPerformance {
  const scored = items.filter((item) => item.outcome === "green" || item.outcome === "red");
  const greens = scored.filter((item) => item.outcome === "green").length;
  const reds = scored.filter((item) => item.outcome === "red").length;
  const avgModelProb =
    scored.length > 0
      ? scored.reduce((sum, item) => sum + item.modelProb, 0) / scored.length
      : 0;
  const brierScore =
    scored.length > 0
      ? scored.reduce((sum, item) => {
          const predicted = item.modelProb / 100;
          const actual = item.outcome === "green" ? 1 : 0;
          return sum + (predicted - actual) ** 2;
        }, 0) / scored.length
      : 0;
  const avgEdge =
    scored.length > 0
      ? scored.reduce((sum, item) => sum + item.valueBet, 0) / scored.length
      : 0;

  return {
    market,
    samples: scored.length,
    greens,
    reds,
    hitRate: scored.length > 0 ? Number(((greens / scored.length) * 100).toFixed(1)) : 0,
    avgModelProb: Number(avgModelProb.toFixed(1)),
    brierScore: Number(brierScore.toFixed(3)),
    avgEdge: Number(avgEdge.toFixed(1)),
  };
}

export function getModelAuditSummary(
  analyses: SavedAnalysis[]
): ModelAuditSummary {
  const audited = analyses.filter((analysis) => analysis.modelAudit);
  const outcomes = audited.flatMap((analysis) => analysis.modelAudit?.outcomes ?? []);
  const scored = outcomes.filter((item) => item.outcome === "green" || item.outcome === "red");
  const greens = scored.filter((item) => item.outcome === "green").length;
  const reds = scored.filter((item) => item.outcome === "red").length;
  const avgModelProb =
    scored.length > 0
      ? scored.reduce((sum, item) => sum + item.modelProb, 0) / scored.length
      : 0;
  const brierScore =
    scored.length > 0
      ? scored.reduce((sum, item) => {
          const predicted = item.modelProb / 100;
          const actual = item.outcome === "green" ? 1 : 0;
          return sum + (predicted - actual) ** 2;
        }, 0) / scored.length
      : 0;
  const byMarket = new Map<string, ModelAuditMarketResult[]>();

  scored.forEach((item) => {
    byMarket.set(item.market, [...(byMarket.get(item.market) ?? []), item]);
  });

  const marketPerformance = Array.from(byMarket.entries())
    .map(([market, items]) => finalizeMarketPerformance(market, items))
    .sort((a, b) => b.samples - a.samples || b.hitRate - a.hitRate);
  const ranked = [...marketPerformance].sort(
    (a, b) => b.hitRate - a.hitRate || a.brierScore - b.brierScore
  );

  return {
    auditedMatches: audited.length,
    auditedMarkets: scored.length,
    greens,
    reds,
    hitRate: scored.length > 0 ? Number(((greens / scored.length) * 100).toFixed(1)) : 0,
    avgModelProb: Number(avgModelProb.toFixed(1)),
    brierScore: Number(brierScore.toFixed(3)),
    bestMarket: ranked[0] ?? null,
    weakestMarket: ranked.length > 0 ? ranked[ranked.length - 1] : null,
    marketPerformance,
  };
}
