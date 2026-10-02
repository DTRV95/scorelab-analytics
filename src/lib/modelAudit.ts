import { canonicalMarket } from "@/lib/marketNames";
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

/** What a market asks of a final score, or null when it cannot be read. */
type Judge = (homeGoals: number, awayGoals: number) => boolean;

const RESULTS: Record<string, Judge> = {
  Casa: (home, away) => home > away,
  Empate: (home, away) => home === away,
  Fora: (home, away) => away > home,
  "1X": (home, away) => home >= away,
  "2X": (home, away) => away >= home,
  "12": (home, away) => home !== away,
  "Ambas Marcam": (home, away) => home > 0 && away > 0,
  "BTTS No": (home, away) => home === 0 || away === 0,
};

/**
 * A goals line, at whatever number it was written at.
 *
 * Spelled out in words only, and only in the shape the normaliser produces. A
 * bare "+1.5" or "-3.5" would also match a handicap, which this must leave
 * unsettled rather than guess at.
 */
function goalsJudge(market: string): Judge | null {
  const line = market.match(/^(Mais|Menos) de (\d+(?:\.\d+)?) Golos$/);
  if (!line) return null;

  const value = Number(line[2]);
  return line[1] === "Mais"
    ? (home, away) => home + away > value
    : (home, away) => home + away < value;
}

function judgeOf(market: string): Judge | null {
  return RESULTS[market] ?? goalsJudge(market);
}

/**
 * Whether a market came in, read off the final score.
 *
 * Every half has to be readable, and a combination is only green when all of
 * them are. Reading one half and settling on it is exactly how "Casa e Mais de
 * 2.5 Golos" came to be paid out on a 1-3 away win: the goals were there, the
 * result was not, and nothing looked at the result.
 *
 * Anything it cannot read in full — a team name, a handicap, a corners line,
 * a wording nobody anticipated — comes back null and stays for its owner to
 * settle by hand. Money rides on this, so silence is the only safe answer.
 */
export function isGreenMarket(
  market: string,
  homeGoals: number,
  awayGoals: number
): boolean | null {
  // The same reading the analysis uses, so a leg typed "V1" or "X2 e +1,5
  // golos" is judged rather than left open: nine of the eleven markets these
  // two actually write were unreadable here while this went by raw text.
  const canonical = canonicalMarket(market);
  if (!canonical) return null;

  const parts = canonical.split(/\s+e\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const judges = parts.map(judgeOf);
  if (judges.some((judge) => judge === null)) return null;

  return (judges as Judge[]).every((judge) => judge(homeGoals, awayGoals));
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
