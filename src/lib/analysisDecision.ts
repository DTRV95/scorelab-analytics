import type { AnalysisResult, BetTier } from "@/types/analysis";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getConservativeEdge(result: AnalysisResult): number {
  return result.edgeLowerBound ?? result.valueBet ?? -999;
}

function getRobustness(result: AnalysisResult): number {
  if (typeof result.robustness === "number") return result.robustness;

  const confidence = result.confidence ?? 0;
  const hasLegacyEdgeOnly = typeof result.edgeLowerBound !== "number";

  return hasLegacyEdgeOnly ? clamp(confidence * 9, 0, 72) : 0;
}

function getUncertainty(result: AnalysisResult): number {
  return result.uncertainty ?? 20;
}

export function getOddsBand(odds: number): string {
  if (odds < 1.9) return "low";
  if (odds < 2.4) return "mid";
  return "high";
}

export function getMarketFamily(market: string): string {
  const lower = market.toLowerCase();

  if ((lower.includes("1x") || lower.includes("2x")) && lower.includes("under 3.5")) {
    return "double-chance-under";
  }
  if ((lower.includes("1x") || lower.includes("2x")) && lower.includes("over 1.5")) {
    return "double-chance-over";
  }
  if (lower.includes("over")) return "totals-over";
  if (lower.includes("under")) return "totals-under";
  if (lower.includes("btts")) return "btts";
  if (lower === "1x" || lower === "2x") return "double-chance";
  if (["home", "draw", "away"].includes(lower)) return "1x2";
  return "other";
}

export function getDecisionFromMetrics(result: AnalysisResult): AnalysisResult["decision"] {
  const edge = result.valueBet ?? 0;
  const edgeLb = getConservativeEdge(result);
  const confidence = result.confidence ?? 0;
  const robustness = getRobustness(result);
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
  const edgeLb = getConservativeEdge(result);
  const confidence = result.confidence ?? 0;
  const robustness = getRobustness(result);
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
  const edgeLb = clamp(getConservativeEdge(result) / 4, 0, 1);
  const confidence = clamp((result.confidence ?? 0) / 10, 0, 1);
  const robustness = clamp(getRobustness(result) / 100, 0, 1);
  const kelly = clamp((result.kelly ?? 0) / 1.2, 0, 1);
  const uncertaintyPenalty = clamp(1 - getUncertainty(result) / 20, 0, 1);

  const score =
    edgeLb * 0.33 +
    confidence * 0.24 +
    robustness * 0.23 +
    kelly * 0.10 +
    uncertaintyPenalty * 0.10;

  return Number((score * 100).toFixed(1));
}
