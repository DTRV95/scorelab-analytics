import { getAllAnalysisTrackingEntries } from "@/lib/analysisStorage";
import type { SavedAnalysis } from "@/types/analysis";

type CalibrationTone = "boost" | "neutral" | "caution" | "avoid" | "learning";

export interface CalibrationSegment {
  key: string;
  label: string;
  type: "league-market" | "league" | "market" | "odds" | "confidence";
  bets: number;
  greens: number;
  reds: number;
  voids: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  hitRate: number;
  expectedHitRate: number;
  calibrationGap: number;
  sampleConfidence: number;
  multiplier: number;
  tone: CalibrationTone;
}

export interface CalibrationModel {
  segments: CalibrationSegment[];
  segmentMap: Map<string, CalibrationSegment>;
  insights: string[];
}

export interface CalibrationInput {
  league: string;
  market: string;
  odds: number;
  confidence: number;
  modelProb: number;
}

export interface CalibrationResult {
  calibratedProb: number;
  rawProb: number;
  multiplier: number;
  stakeMultiplier: number;
  label: "Boosted" | "Calibrated" | "Caution" | "Avoid" | "Learning";
  confidence: number;
  reasons: string[];
  segments: CalibrationSegment[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function normalizeText(value: string | null | undefined) {
  return (value || "Unspecified").trim().toLowerCase();
}

function getOddsBucket(odds: number) {
  if (!Number.isFinite(odds) || odds <= 0) return "unknown";
  if (odds < 1.5) return "<1.50";
  if (odds < 1.8) return "1.50-1.79";
  if (odds < 2.2) return "1.80-2.19";
  if (odds < 3) return "2.20-2.99";
  return "3.00+";
}

function getConfidenceBucket(confidence: number) {
  if (!Number.isFinite(confidence)) return "unknown";
  if (confidence < 6) return "<6";
  if (confidence < 7) return "6-6.9";
  if (confidence < 8) return "7-7.9";
  if (confidence < 9) return "8-8.9";
  return "9+";
}

function getSegmentMultiplier({
  bets,
  roi,
  calibrationGap,
}: {
  bets: number;
  roi: number;
  calibrationGap: number;
}) {
  const sampleConfidence = clamp(bets / 14, 0, 1);
  const roiSignal = clamp(roi / 100, -0.35, 0.35);
  const calibrationSignal = clamp(calibrationGap / 100, -0.35, 0.35);
  const score = calibrationSignal * 0.62 + roiSignal * 0.38;

  return {
    sampleConfidence,
    multiplier: clamp(1 + score * sampleConfidence, 0.86, 1.1),
  };
}

function getTone(bets: number, multiplier: number): CalibrationTone {
  if (bets < 3) return "learning";
  if (multiplier >= 1.035) return "boost";
  if (multiplier <= 0.93) return "avoid";
  if (multiplier <= 0.975) return "caution";
  return "neutral";
}

function addSegment(
  map: Map<string, CalibrationSegment & { modelProbSum: number }>,
  key: string,
  label: string,
  type: CalibrationSegment["type"],
  bet: {
    status: string;
    stake: number;
    profitLoss: number;
    modelProb: number;
  }
) {
  const current =
    map.get(key) ||
    ({
      key,
      label,
      type,
      bets: 0,
      greens: 0,
      reds: 0,
      voids: 0,
      totalStake: 0,
      profitLoss: 0,
      roi: 0,
      hitRate: 0,
      expectedHitRate: 0,
      calibrationGap: 0,
      sampleConfidence: 0,
      multiplier: 1,
      tone: "learning",
      modelProbSum: 0,
    } satisfies CalibrationSegment & { modelProbSum: number });

  current.bets += 1;
  current.totalStake += bet.stake;
  current.profitLoss += bet.profitLoss;
  current.modelProbSum += bet.modelProb;

  if (bet.status === "green") current.greens += 1;
  if (bet.status === "red") current.reds += 1;
  if (bet.status === "void") current.voids += 1;

  map.set(key, current);
}

function finalizeSegment(
  segment: CalibrationSegment & { modelProbSum: number }
): CalibrationSegment {
  const settledWithResult = segment.greens + segment.reds;
  const hitRate =
    settledWithResult > 0 ? (segment.greens / settledWithResult) * 100 : 0;
  const expectedHitRate =
    segment.bets > 0 ? segment.modelProbSum / segment.bets : 0;
  const calibrationGap = hitRate - expectedHitRate;
  const roi =
    segment.totalStake > 0 ? (segment.profitLoss / segment.totalStake) * 100 : 0;
  const { sampleConfidence, multiplier } = getSegmentMultiplier({
    bets: segment.bets,
    roi,
    calibrationGap,
  });

  return {
    key: segment.key,
    label: segment.label,
    type: segment.type,
    bets: segment.bets,
    greens: segment.greens,
    reds: segment.reds,
    voids: segment.voids,
    totalStake: roundTo(segment.totalStake),
    profitLoss: roundTo(segment.profitLoss),
    roi: roundTo(roi),
    hitRate: roundTo(hitRate),
    expectedHitRate: roundTo(expectedHitRate),
    calibrationGap: roundTo(calibrationGap),
    sampleConfidence: roundTo(sampleConfidence, 3),
    multiplier: roundTo(multiplier, 4),
    tone: getTone(segment.bets, multiplier),
  };
}

function buildInsight(segment: CalibrationSegment) {
  if (segment.bets < 3) return null;

  if (segment.tone === "boost") {
    return `${segment.label} is validating above model expectation: ${segment.hitRate.toFixed(
      1
    )}% hit rate vs ${segment.expectedHitRate.toFixed(1)}% expected.`;
  }

  if (segment.tone === "avoid" || segment.tone === "caution") {
    return `${segment.label} is underperforming calibration: ${segment.hitRate.toFixed(
      1
    )}% hit rate vs ${segment.expectedHitRate.toFixed(1)}% expected.`;
  }

  return null;
}

export function buildCalibrationModel(analyses: SavedAnalysis[]): CalibrationModel {
  const workingMap = new Map<string, CalibrationSegment & { modelProbSum: number }>();

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
    const bet = {
      status: entry.tracking.resultStatus,
      stake: entry.tracking.stakeUsed || 0,
      profitLoss: entry.tracking.profitLoss || 0,
      modelProb: result.modelProb,
    };

    addSegment(
      workingMap,
      `league-market:${normalizeText(league)}::${normalizeText(market)}`,
      `${league} · ${market}`,
      "league-market",
      bet
    );
    addSegment(workingMap, `league:${normalizeText(league)}`, league, "league", bet);
    addSegment(workingMap, `market:${normalizeText(market)}`, market, "market", bet);
    addSegment(
      workingMap,
      `odds:${getOddsBucket(result.odds)}`,
      `Odds ${getOddsBucket(result.odds)}`,
      "odds",
      bet
    );
    addSegment(
      workingMap,
      `confidence:${getConfidenceBucket(result.confidence)}`,
      `Confidence ${getConfidenceBucket(result.confidence)}`,
      "confidence",
      bet
    );
  });

  const segments = Array.from(workingMap.values())
    .map(finalizeSegment)
    .sort((a, b) => b.sampleConfidence - a.sampleConfidence || b.bets - a.bets);

  const segmentMap = new Map(segments.map((segment) => [segment.key, segment]));
  const insights = segments
    .filter((segment) => segment.type === "league-market" || segment.type === "market")
    .map(buildInsight)
    .filter(Boolean)
    .slice(0, 5) as string[];

  return { segments, segmentMap, insights };
}

function getRelevantSegments(input: CalibrationInput, model: CalibrationModel) {
  const keys = [
    `league-market:${normalizeText(input.league)}::${normalizeText(input.market)}`,
    `league:${normalizeText(input.league)}`,
    `market:${normalizeText(input.market)}`,
    `odds:${getOddsBucket(input.odds)}`,
    `confidence:${getConfidenceBucket(input.confidence)}`,
  ];

  return keys
    .map((key) => model.segmentMap.get(key))
    .filter(Boolean) as CalibrationSegment[];
}

export function calibrateOpportunity(
  input: CalibrationInput,
  model: CalibrationModel
): CalibrationResult {
  const segments = getRelevantSegments(input, model);
  const weighted = segments
    .map((segment) => {
      const typeWeight =
        segment.type === "league-market"
          ? 1.2
          : segment.type === "league" || segment.type === "market"
          ? 0.9
          : 0.55;

      return {
        segment,
        weight: segment.sampleConfidence * typeWeight,
      };
    })
    .filter((item) => item.weight > 0);

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const multiplier =
    totalWeight > 0
      ? weighted.reduce(
          (sum, item) => sum + item.segment.multiplier * item.weight,
          0
        ) / totalWeight
      : 1;
  const calibratedProb = clamp(input.modelProb * multiplier, 1, 99);
  const confidence = clamp(totalWeight / 3.2, 0, 1);
  const strongestSegment =
    weighted.sort((a, b) => b.weight - a.weight)[0]?.segment ?? null;
  const label: CalibrationResult["label"] =
    confidence < 0.18
      ? "Learning"
      : multiplier >= 1.035
      ? "Boosted"
      : multiplier <= 0.93
      ? "Avoid"
      : multiplier <= 0.975
      ? "Caution"
      : "Calibrated";
  const stakeMultiplier =
    label === "Avoid"
      ? 0
      : label === "Caution"
      ? 0.45
      : label === "Learning"
      ? 0.65
      : label === "Boosted"
      ? clamp(1 + confidence * 0.12, 1, 1.08)
      : 1;
  const reasons =
    strongestSegment && confidence >= 0.18
      ? [
          `${strongestSegment.label}: ${strongestSegment.hitRate.toFixed(
            1
          )}% actual vs ${strongestSegment.expectedHitRate.toFixed(1)}% expected.`,
        ]
      : ["Not enough settled history yet; using the raw model probability."];

  return {
    calibratedProb: roundTo(calibratedProb, 1),
    rawProb: roundTo(input.modelProb, 1),
    multiplier: roundTo(multiplier, 4),
    stakeMultiplier: roundTo(stakeMultiplier, 3),
    label,
    confidence: roundTo(confidence, 3),
    reasons,
    segments,
  };
}
