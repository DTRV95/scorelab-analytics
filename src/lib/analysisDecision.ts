import type { AnalysisResult, BetTier } from "@/types/analysis";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getOddsBand(odds: number): string {
  if (odds < 1.9) return "low";
  if (odds < 2.4) return "mid";
  return "high";
}

export function getMarketFamily(market: string): string {
  const lower = market.toLowerCase();

  if (lower.includes("over")) return "totals-over";
  if (lower.includes("under")) return "totals-under";
  if (lower.includes("btts")) return "btts";
  if (["home", "draw", "away"].includes(lower)) return "1x2";
  return "other";
}

export function getDecisionFromMetrics(result: AnalysisResult): AnalysisResult["decision"] {
  const edge = result.valueBet ?? 0;
  const edgeLb = result.edgeLowerBound ?? -999;
  const confidence = result.confidence ?? 0;
  const robustness = result.robustness ?? 0;
  const kelly = result.kelly ?? 0;
  const odds = result.odds ?? 0;

  if (odds < 1.3 || odds > 6.0) return "No Bet";
  if (result.risk === "High") return edgeLb > 1 && confidence >= 7.5 ? "Caution" : "No Bet";
  if (edge <= 0 || edgeLb <= 0) return "No Bet";

  if (
    edgeLb >= 1.0 &&
    confidence >= 6.5 &&
    robustness >= 65 &&
    kelly >= 0.3
  ) {
    return "Bet";
  }

  if (edge > 0 && confidence >= 5.5 && robustness >= 58) {
    return "Caution";
  }

  return "No Bet";
}

export function getBetTierFromMetrics(result: AnalysisResult): BetTier {
  const decision = getDecisionFromMetrics(result);
  const edgeLb = result.edgeLowerBound ?? -999;
  const confidence = result.confidence ?? 0;
  const robustness = result.robustness ?? 0;
  const kelly = result.kelly ?? 0;
  const odds = result.odds ?? 0;

  if (
    decision === "Bet" &&
    edgeLb >= 2.5 &&
    confidence >= 8 &&
    robustness >= 80 &&
    kelly >= 0.5 &&
    odds >= 1.55 &&
    odds <= 3.4 &&
    result.risk !== "High"
  ) {
    return "premium";
  }

  if (
    decision === "Bet" &&
    edgeLb >= 1.8 &&
    confidence >= 7 &&
    robustness >= 72 &&
    kelly >= 0.3
  ) {
    return "elite";
  }

  if (decision === "Bet") return "bet";
  if (decision === "Caution" || edgeLb > -0.2) return "watchlist";
  return "discard";
}

export function getEliteScore(result: AnalysisResult): number {
  const edgeLb = clamp((result.edgeLowerBound ?? 0) / 4, 0, 1);
  const confidence = clamp((result.confidence ?? 0) / 10, 0, 1);
  const robustness = clamp((result.robustness ?? 0) / 100, 0, 1);
  const kelly = clamp((result.kelly ?? 0) / 1.2, 0, 1);
  const uncertaintyPenalty = clamp(1 - (result.uncertainty ?? 0) / 20, 0, 1);

  const score =
    edgeLb * 0.33 +
    confidence * 0.24 +
    robustness * 0.23 +
    kelly * 0.10 +
    uncertaintyPenalty * 0.10;

  return Number((score * 100).toFixed(1));
}