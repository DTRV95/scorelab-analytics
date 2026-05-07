import type { AnalysisResult, BetStatus, TrackedBet } from "@/types/analysis";

export type PostBetTruthVerdict =
  | "Good Decision"
  | "Bad Win"
  | "Bad Decision"
  | "Validated Edge"
  | "Neutral Outcome"
  | "Pending";

export interface DecisionMemorySnapshot {
  market: string;
  modelProb: number;
  impliedProb: number;
  edge: number;
  confidence: number;
  odds: number;
  risk: AnalysisResult["risk"];
  decision: AnalysisResult["decision"];
  tier?: AnalysisResult["tier"];
  qualityScore: number;
  qualityLabel: NonNullable<TrackedBet["qualityLabel"]>;
  capturedAt: string;
}

export interface PostBetTruth {
  verdict: PostBetTruthVerdict;
  tone: "positive" | "neutral" | "negative";
  summary: string;
  lesson: string;
  generatedAt: string;
}

function isStrongDecision(score: number) {
  return score >= 68;
}

function isWeakDecision(score: number) {
  return score < 50;
}

export function buildDecisionMemorySnapshot({
  result,
  tracking,
  capturedAt = new Date().toISOString(),
}: {
  result: AnalysisResult | null;
  tracking: Pick<TrackedBet, "oddUsed" | "qualityScore" | "qualityLabel">;
  capturedAt?: string;
}): DecisionMemorySnapshot | null {
  if (!result || typeof tracking.qualityScore !== "number" || !tracking.qualityLabel) {
    return null;
  }

  return {
    market: result.market,
    modelProb: result.modelProb,
    impliedProb: result.impliedProb,
    edge: result.valueBet,
    confidence: result.confidence,
    odds: tracking.oddUsed && tracking.oddUsed > 1 ? tracking.oddUsed : result.odds,
    risk: result.risk,
    decision: result.decision,
    tier: result.tier,
    qualityScore: tracking.qualityScore,
    qualityLabel: tracking.qualityLabel,
    capturedAt,
  };
}

export function buildPostBetTruth({
  status,
  memory,
  profitLoss,
  generatedAt = new Date().toISOString(),
}: {
  status: BetStatus;
  memory: DecisionMemorySnapshot | null | undefined;
  profitLoss: number;
  generatedAt?: string;
}): PostBetTruth | null {
  if (status === "pending") return null;

  if (status === "void") {
    return {
      verdict: "Neutral Outcome",
      tone: "neutral",
      summary: "This bet was void, so it should not be treated as proof for or against the decision.",
      lesson: "Keep the decision memory, but do not let a void result influence the pattern.",
      generatedAt,
    };
  }

  if (!memory) {
    return {
      verdict: "Neutral Outcome",
      tone: "neutral",
      summary: "The result is settled, but there was not enough decision memory to judge quality.",
      lesson: "Use tracked markets and quality snapshots before placing bets so future reviews are sharper.",
      generatedAt,
    };
  }

  const won = status === "green" || profitLoss > 0;
  const strong = isStrongDecision(memory.qualityScore);
  const weak = isWeakDecision(memory.qualityScore);

  if (won && strong) {
    return {
      verdict: "Validated Edge",
      tone: "positive",
      summary: "Good process and good result. This is a pattern worth tracking.",
      lesson: "Repeat this type of setup when stake, league and mission context are still aligned.",
      generatedAt,
    };
  }

  if (!won && strong) {
    return {
      verdict: "Good Decision",
      tone: "positive",
      summary: "This lost, but the original decision quality was good. Do not punish the model for normal variance.",
      lesson: "Review execution discipline, but keep this setup class alive unless it keeps failing over a larger sample.",
      generatedAt,
    };
  }

  if (won && weak) {
    return {
      verdict: "Bad Win",
      tone: "negative",
      summary: "This won, but the original decision quality was weak. Profit does not make the process good.",
      lesson: "Do not repeat this pattern just because the result was green.",
      generatedAt,
    };
  }

  if (!won && weak) {
    return {
      verdict: "Bad Decision",
      tone: "negative",
      summary: "Weak process and negative result. This is exactly the kind of bet the system should help you remove.",
      lesson: "Raise the minimum Quality Score or wait for a cleaner edge before entering again.",
      generatedAt,
    };
  }

  return {
    verdict: "Neutral Outcome",
    tone: "neutral",
    summary: won
      ? "The bet won, but the decision quality was only mixed."
      : "The bet lost and the decision quality was mixed.",
    lesson: "Treat this as a watchlist pattern, not a confirmed strength or weakness.",
    generatedAt,
  };
}
