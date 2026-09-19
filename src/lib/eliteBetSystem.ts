import type { AnalysisResult, BetTier } from "@/types/analysis";
import {
  getBetTierFromMetrics,
  getDecisionFromMetrics,
  getEliteScore,
} from "@/lib/analysisDecision";
import { getHistoricalAdjustmentMetrics } from "@/lib/historicalAdjustment";

export interface EliteBetConfig {
  minEdge: number;
  minConfidence: number;
  minKelly: number;
  minOdds: number;
  maxOdds: number;
  allowHighRisk: boolean;

  premiumMinEdge: number;
  premiumMinConfidence: number;
  premiumMinKelly: number;
  premiumMinOdds: number;
  premiumMaxOdds: number;
}

export const DEFAULT_ELITE_CONFIG: EliteBetConfig = {
  minEdge: 5,
  minConfidence: 7,
  minKelly: 1.5,
  minOdds: 1.55,
  maxOdds: 3.2,
  allowHighRisk: false,

  premiumMinEdge: 7,
  premiumMinConfidence: 8,
  premiumMinKelly: 2,
  premiumMinOdds: 1.65,
  premiumMaxOdds: 2.8,
};

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
  if (lower === "home" || lower === "draw" || lower === "away") return "1x2";

  return "other";
}

export function getExpectedValuePercent(result: AnalysisResult): number {
  return Number((result.valueBet || 0).toFixed(1));
}

export function getBetTier(
  result: AnalysisResult,
  config: EliteBetConfig = DEFAULT_ELITE_CONFIG
): BetTier {
  void config;
  return getBetTierFromMetrics(result);
}

export function decorateResult(
  result: AnalysisResult,
  config: EliteBetConfig = DEFAULT_ELITE_CONFIG
): AnalysisResult {
  const historicalMetrics = getHistoricalAdjustmentMetrics(result);
  const baseConfidence = result.baseConfidence ?? result.confidence;
  const adjustedConfidence = clamp(
    Number((baseConfidence + historicalMetrics.adjustment).toFixed(1)),
    0,
    10
  );

  const adjustmentAwareResult: AnalysisResult = {
    ...result,
    baseConfidence,
    confidence: adjustedConfidence,
    adjustedConfidence,
    historicalAdjustment: historicalMetrics.adjustment,
    historicalSample: historicalMetrics.settledBets,
    historicalRoi: historicalMetrics.blendedRoi,
    historicalHitRate: historicalMetrics.blendedHitRate,
  };

  const normalizedDecision = getDecisionFromMetrics(adjustmentAwareResult);

  const normalizedResult: AnalysisResult = {
    ...adjustmentAwareResult,
    decision: normalizedDecision,
  };

  return {
    ...normalizedResult,
    tier: getBetTier(normalizedResult, config),
    eliteScore: getEliteScore(normalizedResult),
    expectedValue: getExpectedValuePercent(normalizedResult),
    oddsBand: getOddsBand(normalizedResult.odds),
    marketFamily: getMarketFamily(normalizedResult.market),
  };
}

export function isToday(dateString: string): boolean {
  const d = new Date(dateString);
  const now = new Date();

  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}
