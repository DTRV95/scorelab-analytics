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

function isGreenMarket(market: string, homeGoals: number, awayGoals: number): boolean | null {
  const normalized = normalizeMarket(market);
  const totalGoals = homeGoals + awayGoals;
  const homeWin = homeGoals > awayGoals;
  const draw = homeGoals === awayGoals;
  const awayWin = awayGoals > homeGoals;
  const under35 = totalGoals <= 3;
  const over15 = totalGoals >= 2;

  if (
    normalized.includes("1x") &&
    (normalized.includes("over 1.5") || normalized.includes("mais de 1.5") || normalized.includes("+1.5") || normalized.includes("+1,5"))
  ) {
    return (homeWin || draw) && over15;
  }

  if (
    normalized.includes("2x") &&
    (normalized.includes("over 1.5") || normalized.includes("mais de 1.5") || normalized.includes("+ de 1.5") || normalized.includes("+ de 1,5") || normalized.includes("+1.5") || normalized.includes("+1,5"))
  ) {
    return (awayWin || draw) && over15;
  }

  if (normalized.includes("1x") && normalized.includes("under 3.5")) {
    return (homeWin || draw) && under35;
  }

  if (normalized.includes("2x") && normalized.includes("under 3.5")) {
    return (awayWin || draw) && under35;
  }

  if (normalized === "home" || normalized === "casa") return homeWin;
  if (normalized === "draw" || normalized === "empate") return draw;
  if (normalized === "away" || normalized === "fora") return awayWin;
  if (normalized === "1x") return homeWin || draw;
  if (normalized === "2x") return awayWin || draw;
  if (normalized.includes("over 2.5") || normalized.includes("mais de 2.5")) return totalGoals >= 3;
  if (normalized.includes("under 2.5") || normalized.includes("menos de 2.5")) return totalGoals <= 2;
  if (normalized.includes("over 3.5") || normalized.includes("mais de 3.5")) return totalGoals >= 4;
  if (normalized.includes("under 3.5") || normalized.includes("menos de 3.5")) return totalGoals <= 3;
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
