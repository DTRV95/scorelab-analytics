import { getAllAnalysisTrackingEntries } from "@/lib/analysisStorage";
import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";

type CalibrationTone = "boost" | "neutral" | "caution" | "avoid" | "learning";

export interface CalibrationSegment {
  key: string;
  label: string;
  type:
    | "league-market"
    | "league"
    | "market"
    | "market-family"
    | "odds"
    | "confidence"
    | "probability"
    | "edge";
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
  brierScore: number;
  sampleConfidence: number;
  multiplier: number;
  probabilityAdjustment: number;
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
  valueBet?: number;
  marketFamily?: string;
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

function getKellyPct(modelProb: number, odds: number): number {
  if (odds <= 1) return 0;

  const probability = modelProb / 100;
  const kelly = (odds * probability - 1) / (odds - 1);

  return roundTo(Math.max(0, kelly * 25), 2);
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

function getProbabilityBucket(probability: number) {
  if (!Number.isFinite(probability)) return "unknown";
  if (probability < 45) return "<45%";
  if (probability < 55) return "45-54%";
  if (probability < 65) return "55-64%";
  if (probability < 75) return "65-74%";
  if (probability < 85) return "75-84%";
  return "85%+";
}

function getEdgeBucket(edge: number | null | undefined) {
  if (!Number.isFinite(edge ?? Number.NaN)) return "unknown";
  const value = edge as number;

  if (value < 0) return "<0%";
  if (value < 3) return "0-2.9%";
  if (value < 7) return "3-6.9%";
  if (value < 12) return "7-11.9%";
  return "12%+";
}

function getMarketFamily(market: string) {
  const normalized = normalizeText(market);

  if (normalized.includes("1x") || normalized.includes("2x")) {
    return normalized.includes("over") || normalized.includes("under")
      ? "Hybrid Double Chance"
      : "Double Chance";
  }
  if (normalized.includes("btts")) return "BTTS";
  if (normalized.includes("over") || normalized.includes("under")) return "Goals";
  if (
    normalized === "home" ||
    normalized === "draw" ||
    normalized === "away" ||
    normalized === "casa" ||
    normalized === "empate" ||
    normalized === "fora"
  ) {
    return "1X2";
  }

  return "Other";
}

function getSegmentMultiplier({
  bets,
  roi,
  calibrationGap,
  brierScore,
}: {
  bets: number;
  roi: number;
  calibrationGap: number;
  brierScore: number;
}) {
  const sampleConfidence = bets < 8 ? 0 : clamp((bets - 7) / 18, 0, 1);
  const roiSignal = clamp(roi / 100, -0.35, 0.35);
  const calibrationSignal = clamp(calibrationGap / 100, -0.35, 0.35);
  const brierPenalty =
    brierScore <= 0.22 ? 1 : brierScore <= 0.28 ? 0.78 : brierScore <= 0.34 ? 0.5 : 0.28;
  const score = (calibrationSignal * 0.62 + roiSignal * 0.38) * brierPenalty;

  return {
    sampleConfidence,
    multiplier: clamp(1 + score * sampleConfidence, 0.92, 1.08),
  };
}

function getProbabilityAdjustment({
  bets,
  calibrationGap,
  brierScore,
}: {
  bets: number;
  calibrationGap: number;
  brierScore: number;
}) {
  if (bets < 12 || Math.abs(calibrationGap) < 3) return 0;

  const sampleConfidence = clamp((bets - 11) / 34, 0, 1);
  const maxAdjustment = bets >= 80 ? 8 : bets >= 40 ? 6 : 4;
  const brierPenalty =
    brierScore <= 0.22 ? 1 : brierScore <= 0.28 ? 0.72 : brierScore <= 0.34 ? 0.44 : 0.22;

  return clamp(
    calibrationGap * 0.45 * sampleConfidence * brierPenalty,
    -maxAdjustment,
    maxAdjustment
  );
}

function getTone(
  bets: number,
  multiplier: number,
  probabilityAdjustment: number,
  brierScore: number
): CalibrationTone {
  if (bets < 8) return "learning";
  if (probabilityAdjustment <= -5 || (brierScore >= 0.34 && probabilityAdjustment < 0)) {
    return "avoid";
  }
  if (probabilityAdjustment <= -2) return "caution";
  if (probabilityAdjustment >= 3) return "boost";
  if (multiplier >= 1.035) return "boost";
  if (multiplier <= 0.93) return "avoid";
  if (multiplier <= 0.975) return "caution";
  return "neutral";
}

function addSegment(
  map: Map<
    string,
    CalibrationSegment & { modelProbSum: number; brierSum: number; scoredBets: number }
  >,
  key: string,
  label: string,
  type: CalibrationSegment["type"],
  bet: {
    status: string;
    stake: number;
    profitLoss: number;
    modelProb: number;
    valueBet?: number;
    marketFamily?: string;
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
      brierScore: 0,
      sampleConfidence: 0,
      multiplier: 1,
      probabilityAdjustment: 0,
      tone: "learning",
      modelProbSum: 0,
      brierSum: 0,
      scoredBets: 0,
    } satisfies CalibrationSegment & {
      modelProbSum: number;
      brierSum: number;
      scoredBets: number;
    });

  current.bets += 1;
  current.totalStake += bet.stake;
  current.profitLoss += bet.profitLoss;
  current.modelProbSum += bet.modelProb;

  if (bet.status === "green") current.greens += 1;
  if (bet.status === "red") current.reds += 1;
  if (bet.status === "void") current.voids += 1;
  if (bet.status === "green" || bet.status === "red") {
    const predicted = clamp(bet.modelProb, 1, 99) / 100;
    const actual = bet.status === "green" ? 1 : 0;
    current.brierSum += (predicted - actual) ** 2;
    current.scoredBets += 1;
  }

  map.set(key, current);
}

function addOutcomeToSegments(
  map: Map<
    string,
    CalibrationSegment & { modelProbSum: number; brierSum: number; scoredBets: number }
  >,
  input: {
    league: string;
    market: string;
    odds: number;
    confidence: number;
    status: string;
    stake: number;
    profitLoss: number;
    modelProb: number;
    valueBet?: number;
    marketFamily?: string;
  }
) {
  const bet = {
    status: input.status,
    stake: input.stake,
    profitLoss: input.profitLoss,
    modelProb: input.modelProb,
  };

  addSegment(
    map,
    `league-market:${normalizeText(input.league)}::${normalizeText(input.market)}`,
    `${input.league} · ${input.market}`,
    "league-market",
    bet
  );
  addSegment(map, `league:${normalizeText(input.league)}`, input.league, "league", bet);
  addSegment(map, `market:${normalizeText(input.market)}`, input.market, "market", bet);
  addSegment(
    map,
    `market-family:${normalizeText(input.marketFamily ?? getMarketFamily(input.market))}`,
    input.marketFamily ?? getMarketFamily(input.market),
    "market-family",
    bet
  );
  addSegment(
    map,
    `odds:${getOddsBucket(input.odds)}`,
    `Odds ${getOddsBucket(input.odds)}`,
    "odds",
    bet
  );
  addSegment(
    map,
    `confidence:${getConfidenceBucket(input.confidence)}`,
    `Confidence ${getConfidenceBucket(input.confidence)}`,
    "confidence",
    bet
  );
  addSegment(
    map,
    `probability:${getProbabilityBucket(input.modelProb)}`,
    `Probability ${getProbabilityBucket(input.modelProb)}`,
    "probability",
    bet
  );
  addSegment(
    map,
    `edge:${getEdgeBucket(input.valueBet)}`,
    `Edge ${getEdgeBucket(input.valueBet)}`,
    "edge",
    bet
  );
}

function finalizeSegment(
  segment: CalibrationSegment & {
    modelProbSum: number;
    brierSum: number;
    scoredBets: number;
  }
): CalibrationSegment {
  const settledWithResult = segment.greens + segment.reds;
  const hitRate =
    settledWithResult > 0 ? (segment.greens / settledWithResult) * 100 : 0;
  const expectedHitRate =
    segment.bets > 0 ? segment.modelProbSum / segment.bets : 0;
  const calibrationGap = hitRate - expectedHitRate;
  const roi =
    segment.totalStake > 0 ? (segment.profitLoss / segment.totalStake) * 100 : 0;
  const brierScore =
    segment.scoredBets > 0 ? segment.brierSum / segment.scoredBets : 0;
  const { sampleConfidence, multiplier } = getSegmentMultiplier({
    bets: segment.bets,
    roi,
    calibrationGap,
    brierScore,
  });
  const probabilityAdjustment = getProbabilityAdjustment({
    bets: segment.bets,
    calibrationGap,
    brierScore,
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
    brierScore: roundTo(brierScore, 3),
    sampleConfidence: roundTo(sampleConfidence, 3),
    multiplier: roundTo(multiplier, 4),
    probabilityAdjustment: roundTo(probabilityAdjustment, 2),
    tone: getTone(segment.bets, multiplier, probabilityAdjustment, brierScore),
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
  const workingMap = new Map<
    string,
    CalibrationSegment & { modelProbSum: number; brierSum: number; scoredBets: number }
  >();
  const auditedKeys = new Set<string>();

  analyses.forEach((analysis) => {
    const league = analysis.league || "Unspecified";

    analysis.modelAudit?.outcomes.forEach((outcome) => {
      if (outcome.outcome === "void") return;

      auditedKeys.add(`${analysis.id}::${normalizeText(outcome.market)}`);
      addOutcomeToSegments(workingMap, {
        league,
        market: outcome.market,
        odds: outcome.odds ?? 0,
        confidence: outcome.confidence,
        status: outcome.outcome,
        stake: 0,
        profitLoss: 0,
        modelProb: outcome.modelProb,
        valueBet: outcome.valueBet,
      });
    });
  });

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
    if (auditedKeys.has(`${entry.analysis.id}::${normalizeText(result.market)}`)) return;

    const league = entry.league || "Unspecified";
    const market = entry.tracking.selectedMarket;
    const bet = {
      status: entry.tracking.resultStatus,
      stake: entry.tracking.stakeUsed || 0,
      profitLoss: entry.tracking.profitLoss || 0,
      modelProb: result.rawModelProb ?? result.modelProb,
      valueBet: result.valueBet,
      marketFamily: result.marketFamily,
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
    addSegment(
      workingMap,
      `market-family:${normalizeText(result.marketFamily ?? getMarketFamily(market))}`,
      result.marketFamily ?? getMarketFamily(market),
      "market-family",
      bet
    );
    addSegment(
      workingMap,
      `probability:${getProbabilityBucket(result.rawModelProb ?? result.modelProb)}`,
      `Probability ${getProbabilityBucket(result.rawModelProb ?? result.modelProb)}`,
      "probability",
      bet
    );
    addSegment(
      workingMap,
      `edge:${getEdgeBucket(result.valueBet)}`,
      `Edge ${getEdgeBucket(result.valueBet)}`,
      "edge",
      bet
    );
  });

  const segments = Array.from(workingMap.values())
    .map(finalizeSegment)
    .sort((a, b) => b.sampleConfidence - a.sampleConfidence || b.bets - a.bets);

  const segmentMap = new Map(segments.map((segment) => [segment.key, segment]));
  const insights = segments
    .filter((segment) =>
      ["league-market", "market", "probability", "edge", "confidence"].includes(segment.type)
    )
    .sort((a, b) => Math.abs(b.probabilityAdjustment) - Math.abs(a.probabilityAdjustment))
    .map(buildInsight)
    .filter(Boolean)
    .slice(0, 7) as string[];

  return { segments, segmentMap, insights };
}

function getRelevantSegments(input: CalibrationInput, model: CalibrationModel) {
  const keys = [
    `league-market:${normalizeText(input.league)}::${normalizeText(input.market)}`,
    `league:${normalizeText(input.league)}`,
    `market:${normalizeText(input.market)}`,
    `market-family:${normalizeText(input.marketFamily ?? getMarketFamily(input.market))}`,
    `odds:${getOddsBucket(input.odds)}`,
    `confidence:${getConfidenceBucket(input.confidence)}`,
    `probability:${getProbabilityBucket(input.modelProb)}`,
    `edge:${getEdgeBucket(input.valueBet)}`,
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
          ? 1.25
          : segment.type === "market" || segment.type === "edge"
          ? 1
          : segment.type === "probability"
          ? 0.85
          : segment.type === "confidence"
          ? 0.7
          : segment.type === "league"
          ? 0.65
          : segment.type === "odds"
          ? 0.55
          : 0.35;

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
  const probabilityAdjustment =
    totalWeight > 0
      ? weighted.reduce(
          (sum, item) => sum + item.segment.probabilityAdjustment * item.weight,
          0
        ) / totalWeight
      : 0;
  const calibratedProb = clamp(input.modelProb * multiplier + probabilityAdjustment, 1, 99);
  const confidence = clamp(totalWeight / 4.6, 0, 1);
  const strongestSegment =
    weighted.sort((a, b) => b.weight - a.weight)[0]?.segment ?? null;
  const label: CalibrationResult["label"] =
    confidence < 0.18
      ? "Learning"
      : probabilityAdjustment <= -5 || multiplier <= 0.93
      ? "Avoid"
      : probabilityAdjustment <= -2 || multiplier <= 0.975
      ? "Caution"
      : probabilityAdjustment >= 3 || multiplier >= 1.035
      ? "Boosted"
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
          )}% actual vs ${strongestSegment.expectedHitRate.toFixed(
            1
          )}% expected, ${strongestSegment.brierScore.toFixed(
            3
          )} Brier, ${strongestSegment.probabilityAdjustment >= 0 ? "+" : ""}${strongestSegment.probabilityAdjustment.toFixed(
            1
          )}pp learned adjustment.`,
        ]
      : ["Not enough audited or settled history yet; using the raw model probability."];

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

export function applyCalibrationToResult(
  result: AnalysisResult,
  league: string,
  model: CalibrationModel
): AnalysisResult {
  const rawModelProb = result.rawModelProb ?? result.modelProb;
  const calibration = calibrateOpportunity(
    {
      league,
      market: result.market,
      odds: result.odds,
      confidence: result.confidence,
      modelProb: rawModelProb,
      valueBet: result.valueBet,
      marketFamily: result.marketFamily,
    },
    model
  );
  const calibrationAdjustment = roundTo(calibration.calibratedProb - rawModelProb, 1);
  const valueBet =
    result.odds > 1
      ? roundTo(calibration.calibratedProb - (result.impliedProb ?? 0), 1)
      : result.valueBet;
  const edgeLowerBound =
    typeof result.edgeLowerBound === "number" && result.edgeLowerBound > -100
      ? roundTo(result.edgeLowerBound + calibrationAdjustment, 1)
      : result.edgeLowerBound;

  return {
    ...result,
    rawModelProb: roundTo(rawModelProb, 1),
    modelProb: calibration.calibratedProb,
    valueBet,
    edgeLowerBound,
    expectedValue: valueBet,
    kelly: getKellyPct(calibration.calibratedProb, result.odds),
    stake: roundTo((result.stake || 0) * calibration.stakeMultiplier, 2),
    calibrationAdjustment,
    calibrationLabel: calibration.label,
    calibrationConfidence: calibration.confidence,
    calibrationReasons: calibration.reasons,
  };
}
