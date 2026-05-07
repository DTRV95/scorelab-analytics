import { getAllAnalysisTrackingEntries } from "@/lib/analysisStorage";
import type { SavedAnalysis } from "@/types/analysis";

export type TrueEdgeSegmentType =
  | "league-market"
  | "league"
  | "market"
  | "odds"
  | "probability";

export type TrueEdgeVerdict =
  | "Trusted"
  | "Promising"
  | "Learning"
  | "Watch"
  | "Avoid";

export interface TrueEdgeSegment {
  key: string;
  label: string;
  type: TrueEdgeSegmentType;
  bets: number;
  settled: number;
  greens: number;
  reds: number;
  voids: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  actualHitRate: number;
  expectedHitRate: number;
  calibrationGap: number;
  sampleConfidence: number;
  trueEdgeScore: number;
  verdict: TrueEdgeVerdict;
  recommendation: string;
}

export interface TrueEdgeValidationModel {
  segments: TrueEdgeSegment[];
  segmentMap: Map<string, TrueEdgeSegment>;
  trustedSegments: TrueEdgeSegment[];
  avoidSegments: TrueEdgeSegment[];
  bestSegment: TrueEdgeSegment | null;
  strongestWarning: TrueEdgeSegment | null;
  summary: {
    settledBets: number;
    trustedCount: number;
    avoidCount: number;
    learningCount: number;
  };
}

export interface TrueEdgeOpportunityInput {
  league: string;
  market: string;
  odds: number;
  modelProb: number;
}

export interface TrueEdgeOpportunityRead {
  verdict: TrueEdgeVerdict;
  confidence: number;
  score: number;
  reason: string;
  strongestSegment: TrueEdgeSegment | null;
  segments: TrueEdgeSegment[];
}

const MIN_LEARNING_SAMPLE = 5;
const MIN_OPERATIONAL_SAMPLE = 8;

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(decimals));
}

function normalizeText(value: string | null | undefined) {
  return (value || "Unspecified").trim().toLowerCase();
}

function normalizeProbabilityPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

function getOddsBucket(odds: number) {
  if (!Number.isFinite(odds) || odds <= 0) return "unknown";
  if (odds < 1.5) return "<1.50";
  if (odds < 1.8) return "1.50-1.79";
  if (odds < 2.2) return "1.80-2.19";
  if (odds < 3) return "2.20-2.99";
  return "3.00+";
}

function getProbabilityBucket(modelProb: number) {
  const prob = normalizeProbabilityPct(modelProb);
  if (prob < 60) return "<60%";
  if (prob < 70) return "60-69%";
  if (prob < 75) return "70-74%";
  if (prob < 80) return "75-79%";
  if (prob < 85) return "80-84%";
  return "85%+";
}

function getVerdict({
  settled,
  roi,
  calibrationGap,
  trueEdgeScore,
}: {
  settled: number;
  roi: number;
  calibrationGap: number;
  trueEdgeScore: number;
}): TrueEdgeVerdict {
  if (settled < MIN_LEARNING_SAMPLE) return "Learning";

  if (settled >= MIN_LEARNING_SAMPLE && (roi <= -10 || calibrationGap <= -8)) {
    return "Avoid";
  }

  if (
    settled >= MIN_OPERATIONAL_SAMPLE &&
    roi >= 8 &&
    calibrationGap >= -3 &&
    trueEdgeScore >= 68
  ) {
    return "Trusted";
  }

  if (
    settled >= MIN_OPERATIONAL_SAMPLE &&
    roi > 0 &&
    calibrationGap >= -6 &&
    trueEdgeScore >= 56
  ) {
    return "Promising";
  }

  return "Watch";
}

function getRecommendation(segment: TrueEdgeSegment) {
  if (segment.verdict === "Trusted") {
    return "Can support roadmap execution when the current pick also clears probability and stake guardrails.";
  }

  if (segment.verdict === "Promising") {
    return "Usable with controlled stake, but still not strong enough to increase exposure aggressively.";
  }

  if (segment.verdict === "Avoid") {
    return "Do not add mission exposure here until the real outcomes improve against the model expectation.";
  }

  if (segment.verdict === "Watch") {
    return "Keep tracking, but require stronger pick-level evidence before trusting this zone.";
  }

  return "Needs more settled bets before the system can call this a real edge.";
}

function createWorkingSegment(
  key: string,
  label: string,
  type: TrueEdgeSegmentType
) {
  return {
    key,
    label,
    type,
    bets: 0,
    settled: 0,
    greens: 0,
    reds: 0,
    voids: 0,
    totalStake: 0,
    profitLoss: 0,
    modelProbSum: 0,
  };
}

type WorkingSegment = ReturnType<typeof createWorkingSegment>;

function addSegment(
  map: Map<string, WorkingSegment>,
  key: string,
  label: string,
  type: TrueEdgeSegmentType,
  bet: {
    status: string;
    stake: number;
    profitLoss: number;
    modelProb: number;
  }
) {
  const current = map.get(key) || createWorkingSegment(key, label, type);
  const isResultSettled = bet.status === "green" || bet.status === "red";

  current.bets += 1;
  current.totalStake += bet.stake;
  current.profitLoss += bet.profitLoss;

  if (isResultSettled) {
    current.settled += 1;
    current.modelProbSum += normalizeProbabilityPct(bet.modelProb);
  }

  if (bet.status === "green") current.greens += 1;
  if (bet.status === "red") current.reds += 1;
  if (bet.status === "void") current.voids += 1;

  map.set(key, current);
}

function finalizeSegment(segment: WorkingSegment): TrueEdgeSegment {
  const actualHitRate =
    segment.settled > 0 ? (segment.greens / segment.settled) * 100 : 0;
  const expectedHitRate =
    segment.settled > 0 ? segment.modelProbSum / segment.settled : 0;
  const calibrationGap = actualHitRate - expectedHitRate;
  const roi =
    segment.totalStake > 0 ? (segment.profitLoss / segment.totalStake) * 100 : 0;
  const sampleConfidence = clamp(segment.settled / MIN_OPERATIONAL_SAMPLE, 0, 1);
  const sampleScore = Math.min(24, segment.settled * 3);
  const roiScore = clamp(roi * 0.7, -28, 32);
  const calibrationScore = clamp(calibrationGap * 1.15, -30, 30);
  const trueEdgeScore = clamp(
    44 + sampleScore + roiScore + calibrationScore,
    0,
    100
  );
  const verdict = getVerdict({
    settled: segment.settled,
    roi,
    calibrationGap,
    trueEdgeScore,
  });

  const finalized: TrueEdgeSegment = {
    key: segment.key,
    label: segment.label,
    type: segment.type,
    bets: segment.bets,
    settled: segment.settled,
    greens: segment.greens,
    reds: segment.reds,
    voids: segment.voids,
    totalStake: roundTo(segment.totalStake),
    profitLoss: roundTo(segment.profitLoss),
    roi: roundTo(roi),
    actualHitRate: roundTo(actualHitRate),
    expectedHitRate: roundTo(expectedHitRate),
    calibrationGap: roundTo(calibrationGap),
    sampleConfidence: roundTo(sampleConfidence, 3),
    trueEdgeScore: roundTo(trueEdgeScore, 0),
    verdict,
    recommendation: "",
  };

  return {
    ...finalized,
    recommendation: getRecommendation(finalized),
  };
}

function getRelevantKeys(input: TrueEdgeOpportunityInput) {
  return [
    `league-market:${normalizeText(input.league)}::${normalizeText(input.market)}`,
    `league:${normalizeText(input.league)}`,
    `market:${normalizeText(input.market)}`,
    `odds:${getOddsBucket(input.odds)}`,
    `probability:${getProbabilityBucket(input.modelProb)}`,
  ];
}

export function buildTrueEdgeValidationModel(
  analyses: SavedAnalysis[]
): TrueEdgeValidationModel {
  const workingMap = new Map<string, WorkingSegment>();

  getAllAnalysisTrackingEntries(analyses).forEach((entry) => {
    if (
      !entry.tracking.betPlaced ||
      !entry.tracking.selectedMarket ||
      !["green", "red", "void"].includes(entry.tracking.resultStatus)
    ) {
      return;
    }

    const result = entry.analysis.results.find(
      (item) => item.market === entry.tracking.selectedMarket
    );
    if (!result) return;

    const league = entry.league || "Unspecified";
    const market = entry.tracking.selectedMarket;
    const odds = entry.tracking.oddUsed || result.odds;
    const bet = {
      status: entry.tracking.resultStatus,
      stake: entry.tracking.stakeUsed || 0,
      profitLoss: entry.tracking.profitLoss || 0,
      modelProb: result.modelProb,
    };

    addSegment(
      workingMap,
      `league-market:${normalizeText(league)}::${normalizeText(market)}`,
      `${league} - ${market}`,
      "league-market",
      bet
    );
    addSegment(workingMap, `league:${normalizeText(league)}`, league, "league", bet);
    addSegment(workingMap, `market:${normalizeText(market)}`, market, "market", bet);
    addSegment(
      workingMap,
      `odds:${getOddsBucket(odds)}`,
      `Odds ${getOddsBucket(odds)}`,
      "odds",
      bet
    );
    addSegment(
      workingMap,
      `probability:${getProbabilityBucket(result.modelProb)}`,
      `Model ${getProbabilityBucket(result.modelProb)}`,
      "probability",
      bet
    );
  });

  const segments = Array.from(workingMap.values())
    .map(finalizeSegment)
    .sort((a, b) => {
      if (b.trueEdgeScore !== a.trueEdgeScore) {
        return b.trueEdgeScore - a.trueEdgeScore;
      }
      return b.settled - a.settled;
    });
  const segmentMap = new Map(segments.map((segment) => [segment.key, segment]));
  const trustedSegments = segments.filter(
    (segment) => segment.verdict === "Trusted" || segment.verdict === "Promising"
  );
  const avoidSegments = segments.filter((segment) => segment.verdict === "Avoid");
  const learningCount = segments.filter((segment) => segment.verdict === "Learning").length;
  const bestSegment = trustedSegments[0] || null;
  const strongestWarning = avoidSegments[0] || null;
  const settledBets = Math.max(...segments.map((segment) => segment.settled), 0);

  return {
    segments,
    segmentMap,
    trustedSegments,
    avoidSegments,
    bestSegment,
    strongestWarning,
    summary: {
      settledBets,
      trustedCount: trustedSegments.length,
      avoidCount: avoidSegments.length,
      learningCount,
    },
  };
}

export function evaluateTrueEdgeOpportunity(
  input: TrueEdgeOpportunityInput,
  model: TrueEdgeValidationModel
): TrueEdgeOpportunityRead {
  const segments = getRelevantKeys(input)
    .map((key) => model.segmentMap.get(key))
    .filter(Boolean) as TrueEdgeSegment[];

  const weightedSegments = segments
    .map((segment) => {
      const typeWeight =
        segment.type === "league-market"
          ? 1.25
          : segment.type === "league" || segment.type === "market"
          ? 0.9
          : 0.55;

      return {
        segment,
        weight: segment.sampleConfidence * typeWeight,
      };
    })
    .filter((item) => item.weight > 0);

  if (!weightedSegments.length) {
    return {
      verdict: "Learning",
      confidence: 0,
      score: 0,
      reason: "No settled validation exists for this profile yet.",
      strongestSegment: null,
      segments,
    };
  }

  const strongestSegment = [...weightedSegments].sort(
    (a, b) => b.weight - a.weight
  )[0].segment;
  const hardAvoid = weightedSegments.find(
    (item) =>
      item.segment.verdict === "Avoid" &&
      item.segment.settled >= MIN_OPERATIONAL_SAMPLE
  );

  if (hardAvoid) {
    return {
      verdict: "Avoid",
      confidence: roundTo(hardAvoid.segment.sampleConfidence),
      score: hardAvoid.segment.trueEdgeScore,
      reason: `${hardAvoid.segment.label} is failing true-edge validation: ${hardAvoid.segment.actualHitRate.toFixed(
        1
      )}% actual vs ${hardAvoid.segment.expectedHitRate.toFixed(1)}% expected.`,
      strongestSegment: hardAvoid.segment,
      segments,
    };
  }

  const totalWeight = weightedSegments.reduce((sum, item) => sum + item.weight, 0);
  const score =
    totalWeight > 0
      ? weightedSegments.reduce(
          (sum, item) => sum + item.segment.trueEdgeScore * item.weight,
          0
        ) / totalWeight
      : 0;
  const confidence = clamp(totalWeight / 2.7, 0, 1);
  const verdict: TrueEdgeVerdict =
    confidence < 0.25
      ? "Learning"
      : score >= 68
      ? "Trusted"
      : score >= 56
      ? "Promising"
      : score <= 38
      ? "Avoid"
      : "Watch";

  return {
    verdict,
    confidence: roundTo(confidence, 3),
    score: roundTo(score, 0),
    reason: `${strongestSegment.label}: ${strongestSegment.actualHitRate.toFixed(
      1
    )}% actual vs ${strongestSegment.expectedHitRate.toFixed(1)}% expected over ${
      strongestSegment.settled
    } settled bets.`,
    strongestSegment,
    segments,
  };
}
