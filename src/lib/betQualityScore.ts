import type { AnalysisResult, TrackedBet } from "@/types/analysis";

export type BetQualityTone = "positive" | "neutral" | "negative";

export interface BetQualityScore {
  score: number;
  label: "Premium" | "Approved" | "Caution" | "Avoid" | "Incomplete";
  tone: BetQualityTone;
  summary: string;
  strengths: string[];
  risks: string[];
  actions: string[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value);
}

function getTierAdjustment(tier: AnalysisResult["tier"]) {
  if (tier === "premium") return 10;
  if (tier === "elite") return 8;
  if (tier === "bet") return 4;
  if (tier === "watchlist") return -4;
  if (tier === "discard") return -14;
  return 0;
}

function getDecisionAdjustment(decision: AnalysisResult["decision"]) {
  if (decision === "Bet") return 10;
  if (decision === "Caution") return -2;
  return -18;
}

function getRiskAdjustment(risk: AnalysisResult["risk"]) {
  if (risk === "Low") return 7;
  if (risk === "Medium") return 1;
  return -10;
}

function getOddsAdjustment(odds: number) {
  if (!Number.isFinite(odds) || odds <= 1) return -18;
  if (odds >= 1.35 && odds <= 2.4) return 6;
  if (odds > 2.4 && odds <= 3.25) return 1;
  if (odds > 3.25) return -8;
  return -4;
}

function getStakeAdjustment(stakeUsed: number | null | undefined, bankrollBefore: number | null | undefined) {
  if (!stakeUsed || stakeUsed <= 0 || !bankrollBefore || bankrollBefore <= 0) return 0;

  const stakePct = (stakeUsed / bankrollBefore) * 100;

  if (stakePct <= 4) return 7;
  if (stakePct <= 8) return 3;
  if (stakePct <= 12) return -3;
  return -12;
}

export function calculateBetQualityScore({
  result,
  tracking,
}: {
  result: AnalysisResult | null;
  tracking?: Pick<TrackedBet, "stakeUsed" | "oddUsed" | "bankrollBefore"> | null;
}): BetQualityScore {
  if (!result) {
    return {
      score: 0,
      label: "Incomplete",
      tone: "neutral",
      summary: "Select a market before the system can judge this bet.",
      strengths: [],
      risks: ["Missing selected market."],
      actions: ["Choose the real market first.", "Use the model values before staking."],
    };
  }

  const effectiveOdds = tracking?.oddUsed && tracking.oddUsed > 1 ? tracking.oddUsed : result.odds;
  const confidenceAdjustment = clamp((result.confidence - 5) * 4, -16, 20);
  const edgeAdjustment = clamp(result.valueBet * 1.15, -16, 18);
  const modelProbAdjustment = clamp((result.modelProb - 50) * 0.18, -6, 9);

  const rawScore =
    50 +
    getDecisionAdjustment(result.decision) +
    getTierAdjustment(result.tier) +
    getRiskAdjustment(result.risk) +
    getOddsAdjustment(effectiveOdds) +
    getStakeAdjustment(tracking?.stakeUsed, tracking?.bankrollBefore) +
    confidenceAdjustment +
    edgeAdjustment +
    modelProbAdjustment;

  const score = round(clamp(rawScore, 0, 100));
  const label =
    score >= 82 ? "Premium" : score >= 68 ? "Approved" : score >= 50 ? "Caution" : "Avoid";
  const tone: BetQualityTone =
    score >= 68 ? "positive" : score >= 50 ? "neutral" : "negative";

  const strengths: string[] = [];
  const risks: string[] = [];
  const actions: string[] = [];

  if (result.decision === "Bet") strengths.push("Model decision supports entry.");
  if (result.valueBet >= 7) strengths.push(`Strong edge at ${result.valueBet.toFixed(1)}%.`);
  if (result.confidence >= 7) strengths.push(`Confidence is high at ${result.confidence.toFixed(1)}/10.`);
  if (result.risk === "Low") strengths.push("Risk profile is low.");

  if (result.decision !== "Bet") risks.push("Model is not giving a clean bet signal.");
  if (result.valueBet < 4) risks.push("Edge is thin.");
  if (result.confidence < 6) risks.push("Confidence is not strong yet.");
  if (result.risk === "High") risks.push("Risk profile is high.");
  if (effectiveOdds > 3.25) risks.push("Odds are volatile for mission execution.");

  if (label === "Premium" || label === "Approved") {
    actions.push("Can be considered if it fits today's stake cap.");
    actions.push("Keep the stake close to the system recommendation.");
  } else if (label === "Caution") {
    actions.push("Reduce stake or wait for a cleaner setup.");
    actions.push("Only place it if the Roadmap still has capacity.");
  } else {
    actions.push("Avoid forcing this bet.");
    actions.push("Look for a stronger market or higher-confidence opportunity.");
  }

  return {
    score,
    label,
    tone,
    summary:
      label === "Premium"
        ? "Strong setup across edge, confidence and risk."
        : label === "Approved"
        ? "Playable setup, as long as exposure stays controlled."
        : label === "Caution"
        ? "Mixed setup. It needs tighter stake discipline."
        : "The bet does not clear the quality threshold.",
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    actions: actions.slice(0, 2),
  };
}
