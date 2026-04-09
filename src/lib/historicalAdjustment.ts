import { getAnalyses } from "@/lib/analysisStorage";
import type { AnalysisResult } from "@/types/analysis";

interface SettledTrackedBet {
  market: string;
  marketFamily: string;
  oddsBand: string;
  confidenceBucket: string;
  impliedProb: number;
  stake: number;
  profitLoss: number;
  status: "green" | "red" | "void";
}

interface SegmentStats {
  bets: number;
  roi: number;
  hitRate: number;
  expectedHitRate: number;
}

interface SegmentAdjustment {
  adjustment: number;
  weight: number;
  stats: SegmentStats;
}

export interface HistoricalAdjustmentMetrics {
  adjustment: number;
  settledBets: number;
  blendedRoi: number;
  blendedHitRate: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getMarketFamily(market: string): string {
  const lower = market.toLowerCase();

  if (lower.includes("over")) return "totals-over";
  if (lower.includes("under")) return "totals-under";
  if (lower.includes("btts")) return "btts";
  if (["home", "draw", "away"].includes(lower)) return "1x2";
  return "other";
}

function getOddsBand(odds: number): string {
  if (odds < 1.9) return "low";
  if (odds < 2.4) return "mid";
  return "high";
}

function getConfidenceBucket(confidence: number): string {
  if (confidence <= 5) return "0-5";
  if (confidence <= 6) return "6";
  if (confidence <= 7) return "7";
  if (confidence <= 8) return "8";
  return "9-10";
}

function getResultConfidence(result: AnalysisResult): number {
  const baseConfidence =
    "baseConfidence" in result && typeof result.baseConfidence === "number"
      ? result.baseConfidence
      : undefined;

  return baseConfidence ?? result.confidence;
}

function isSettledTrackedBet(
  bet: SettledTrackedBet | null
): bet is SettledTrackedBet {
  return bet !== null;
}

function getSettledTrackedBets(): SettledTrackedBet[] {
  const analyses = getAnalyses();

  return analyses
    .filter(
      (analysis) =>
        analysis?.tracking?.betPlaced &&
        analysis?.tracking?.selectedMarket &&
        (analysis.tracking.resultStatus === "green" ||
          analysis.tracking.resultStatus === "red" ||
          analysis.tracking.resultStatus === "void")
    )
    .map((analysis) => {
      const selectedMarket = analysis.tracking.selectedMarket!;
      const selectedResult = analysis.results.find(
        (result) => result.market === selectedMarket
      );

      if (!selectedResult) return null;

      return {
        market: selectedMarket,
        marketFamily: selectedResult.marketFamily || getMarketFamily(selectedMarket),
        oddsBand: selectedResult.oddsBand || getOddsBand(selectedResult.odds),
        confidenceBucket: getConfidenceBucket(getResultConfidence(selectedResult)),
        impliedProb: selectedResult.impliedProb,
        stake: analysis.tracking.stakeUsed || 0,
        profitLoss: analysis.tracking.profitLoss || 0,
        status: analysis.tracking.resultStatus,
      };
    })
    .filter(isSettledTrackedBet);
}

function computeSegmentStats(items: SettledTrackedBet[]): SegmentStats {
  const bets = items.length;
  const totalStake = items.reduce((sum, item) => sum + item.stake, 0);
  const totalProfitLoss = items.reduce((sum, item) => sum + item.profitLoss, 0);
  const settledDecisions = items.filter(
    (item) => item.status === "green" || item.status === "red"
  );
  const wins = settledDecisions.filter((item) => item.status === "green").length;
  const expectedHitRate =
    settledDecisions.length > 0
      ? settledDecisions.reduce((sum, item) => sum + item.impliedProb, 0) /
        settledDecisions.length
      : 0;

  return {
    bets,
    roi: totalStake > 0 ? (totalProfitLoss / totalStake) * 100 : 0,
    hitRate:
      settledDecisions.length > 0
        ? (wins / settledDecisions.length) * 100
        : expectedHitRate,
    expectedHitRate,
  };
}

function buildSegmentAdjustment(
  items: SettledTrackedBet[],
  minSample: number,
  idealSample: number,
  maxAdjustment: number
): SegmentAdjustment | null {
  if (items.length < minSample) return null;

  const stats = computeSegmentStats(items);
  const sampleStrength = clamp((stats.bets - minSample) / (idealSample - minSample), 0, 1);
  const reliabilityWeight = 0.35 + sampleStrength * 0.65;

  const roiSignal = clamp(stats.roi / 18, -1, 1);
  const hitRateSignal = clamp(
    (stats.hitRate - stats.expectedHitRate) / 22,
    -1,
    1
  );
  const blendedSignal = roiSignal * 0.65 + hitRateSignal * 0.35;

  return {
    adjustment: Number((blendedSignal * maxAdjustment).toFixed(2)),
    weight: reliabilityWeight,
    stats,
  };
}

export function getHistoricalAdjustmentMetrics(
  result: AnalysisResult
): HistoricalAdjustmentMetrics {
  const settledBets = getSettledTrackedBets();
  const marketFamily = result.marketFamily || getMarketFamily(result.market);
  const oddsBand = result.oddsBand || getOddsBand(result.odds);
  const confidenceBucket = getConfidenceBucket(getResultConfidence(result));

  const candidateAdjustments = [
    buildSegmentAdjustment(
      settledBets.filter((bet) => bet.market === result.market),
      18,
      40,
      0.45
    ),
    buildSegmentAdjustment(
      settledBets.filter((bet) => bet.marketFamily === marketFamily),
      24,
      60,
      0.3
    ),
    buildSegmentAdjustment(
      settledBets.filter((bet) => bet.oddsBand === oddsBand),
      24,
      60,
      0.2
    ),
    buildSegmentAdjustment(
      settledBets.filter((bet) => bet.confidenceBucket === confidenceBucket),
      24,
      60,
      0.2
    ),
  ].filter(Boolean) as SegmentAdjustment[];

  if (!candidateAdjustments.length) {
    return {
      adjustment: 0,
      settledBets: 0,
      blendedRoi: 0,
      blendedHitRate: 0,
    };
  }

  const totalWeight = candidateAdjustments.reduce(
    (sum, segment) => sum + segment.weight,
    0
  );

  const weightedAdjustment =
    totalWeight > 0
      ? candidateAdjustments.reduce(
          (sum, segment) => sum + segment.adjustment * segment.weight,
          0
        ) / totalWeight
      : 0;

  const blendedRoi =
    totalWeight > 0
      ? candidateAdjustments.reduce(
          (sum, segment) => sum + segment.stats.roi * segment.weight,
          0
        ) / totalWeight
      : 0;

  const blendedHitRate =
    totalWeight > 0
      ? candidateAdjustments.reduce(
          (sum, segment) => sum + segment.stats.hitRate * segment.weight,
          0
        ) / totalWeight
      : 0;

  const maxSample = candidateAdjustments.reduce(
    (max, segment) => Math.max(max, segment.stats.bets),
    0
  );

  return {
    adjustment: Number(clamp(weightedAdjustment, -1, 1).toFixed(2)),
    settledBets: maxSample,
    blendedRoi: Number(blendedRoi.toFixed(2)),
    blendedHitRate: Number(blendedHitRate.toFixed(2)),
  };
}
