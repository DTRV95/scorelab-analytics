import type {
  SavedAnalysis,
  BetTier,
  BetStatus,
  AnalysisResult,
  RiskLevel,
} from "@/types/analysis";

export interface BankrollPolicy {
  premiumStakePct: number;
  eliteStakePct: number;
  betStakePct: number;
  watchlistStakePct: number;
  maxDailyExposurePct: number;
  maxPerBetPct: number;
  maxPerMatchPct: number;
  suppressCorrelatedMarkets: boolean;
}

export const DEFAULT_BANKROLL_POLICY: BankrollPolicy = {
  premiumStakePct: 2.0,
  eliteStakePct: 1.25,
  betStakePct: 0.75,
  watchlistStakePct: 0,
  maxDailyExposurePct: 6,
  maxPerBetPct: 2,
  maxPerMatchPct: 2.5,
  suppressCorrelatedMarkets: true,
};

export interface RecommendedStakeOutput {
  recommendedPct: number;
  recommendedAmount: number;
  capped: boolean;
  reason?: string;
}

export interface ExposureSummary {
  openExposureAmount: number;
  openExposurePct: number;
  totalPendingBets: number;
  remainingDailyCapacityPct: number;
  remainingDailyCapacityAmount: number;
  riskLevel: "Low" | "Moderate" | "High";
}

export interface TierPerformance {
  tier: BetTier;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

export interface OddsBucketPerformance {
  bucket: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

export interface EdgeBucketPerformance {
  bucket: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

export interface MarketPerformance {
  market: string;
  marketGroup: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  avgOdds: number;
  avgConfidence: number;
  avgEdge: number;
  avgEdgeLowerBound: number;
  avgRobustness: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

export interface ConfidenceBucketPerformance {
  bucket: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  avgOdds: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

export interface RiskPerformance {
  risk: RiskLevel;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  avgOdds: number;
  avgConfidence: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

export interface RobustnessBucketPerformance {
  bucket: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  avgOdds: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

export interface EdgeLowerBoundBucketPerformance {
  bucket: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  avgOdds: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

type AggregateRow = {
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  totalStake: number;
  profitLoss: number;
  oddsSum: number;
  confidenceSum: number;
  edgeSum: number;
  edgeLowerBoundSum: number;
  robustnessSum: number;
};

function createAggregateRow(): AggregateRow {
  return {
    bets: 0,
    wins: 0,
    losses: 0,
    voids: 0,
    totalStake: 0,
    profitLoss: 0,
    oddsSum: 0,
    confidenceSum: 0,
    edgeSum: 0,
    edgeLowerBoundSum: 0,
    robustnessSum: 0,
  };
}

function isSettled(status: BetStatus): boolean {
  return status === "green" || status === "red" || status === "void";
}

function getTrackedResult(analysis: SavedAnalysis): AnalysisResult | null {
  if (!analysis?.tracking?.selectedMarket) return null;

  const selected = analysis.results.find(
    (result) => result.market === analysis.tracking.selectedMarket
  );

  return selected || null;
}

function getTrackedTier(analysis: SavedAnalysis): BetTier {
  const selected = getTrackedResult(analysis);
  return selected?.tier || "discard";
}

function updateAggregate(
  row: AggregateRow,
  analysis: SavedAnalysis,
  result: AnalysisResult
) {
  row.bets += 1;
  row.totalStake += analysis.tracking.stakeUsed || 0;
  row.profitLoss += analysis.tracking.profitLoss || 0;
  row.oddsSum += analysis.tracking.oddUsed || result.odds || 0;
  row.confidenceSum += result.confidence || 0;
  row.edgeSum += result.valueBet || 0;
  row.edgeLowerBoundSum += result.edgeLowerBound || 0;
  row.robustnessSum += result.robustness || 0;

  if (analysis.tracking.resultStatus === "green") row.wins += 1;
  if (analysis.tracking.resultStatus === "red") row.losses += 1;
  if (analysis.tracking.resultStatus === "void") row.voids += 1;
}

function finalizeBaseRow(row: AggregateRow) {
  const avgOdds = row.bets > 0 ? row.oddsSum / row.bets : 0;
  const avgConfidence = row.bets > 0 ? row.confidenceSum / row.bets : 0;
  const avgEdge = row.bets > 0 ? row.edgeSum / row.bets : 0;
  const avgEdgeLowerBound = row.bets > 0 ? row.edgeLowerBoundSum / row.bets : 0;
  const avgRobustness = row.bets > 0 ? row.robustnessSum / row.bets : 0;
  const hitRate = row.bets > 0 ? (row.wins / row.bets) * 100 : 0;
  const roi = row.totalStake > 0 ? (row.profitLoss / row.totalStake) * 100 : 0;

  return {
    bets: row.bets,
    wins: row.wins,
    losses: row.losses,
    voids: row.voids,
    hitRate: Number(hitRate.toFixed(1)),
    totalStake: Number(row.totalStake.toFixed(2)),
    profitLoss: Number(row.profitLoss.toFixed(2)),
    roi: Number(roi.toFixed(1)),
    avgOdds: Number(avgOdds.toFixed(2)),
    avgConfidence: Number(avgConfidence.toFixed(2)),
    avgEdge: Number(avgEdge.toFixed(2)),
    avgEdgeLowerBound: Number(avgEdgeLowerBound.toFixed(2)),
    avgRobustness: Number(avgRobustness.toFixed(2)),
  };
}

export function getRecommendedStakePctForTier(
  tier: BetTier,
  policy: BankrollPolicy = DEFAULT_BANKROLL_POLICY
): number {
  if (tier === "premium") return policy.premiumStakePct;
  if (tier === "elite") return policy.eliteStakePct;
  if (tier === "bet") return policy.betStakePct;
  return policy.watchlistStakePct;
}

export function getRecommendedStake(
  bankroll: number,
  tier: BetTier,
  currentOpenExposurePct: number,
  policy: BankrollPolicy = DEFAULT_BANKROLL_POLICY
): RecommendedStakeOutput {
  const basePct = getRecommendedStakePctForTier(tier, policy);

  if (basePct <= 0) {
    return {
      recommendedPct: 0,
      recommendedAmount: 0,
      capped: false,
      reason: "No stake recommended for this tier",
    };
  }

  const cappedPct = Math.min(basePct, policy.maxPerBetPct);
  const remainingCapacityPct = Math.max(
    0,
    policy.maxDailyExposurePct - currentOpenExposurePct
  );
  const finalPct = Math.min(cappedPct, remainingCapacityPct);

  if (finalPct <= 0) {
    return {
      recommendedPct: 0,
      recommendedAmount: 0,
      capped: true,
      reason: "Daily exposure cap reached",
    };
  }

  return {
    recommendedPct: Number(finalPct.toFixed(2)),
    recommendedAmount: Number(((bankroll * finalPct) / 100).toFixed(2)),
    capped: finalPct < basePct,
    reason: finalPct < basePct ? "Capped by portfolio exposure rules" : undefined,
  };
}

export function getOpenExposureSummary(
  analyses: SavedAnalysis[],
  currentBankroll: number,
  policy: BankrollPolicy = DEFAULT_BANKROLL_POLICY
): ExposureSummary {
  const pending = analyses.filter(
    (analysis) =>
      analysis.tracking?.betPlaced &&
      analysis.tracking?.resultStatus === "pending"
  );

  const openExposureAmount = pending.reduce(
    (sum, analysis) => sum + (analysis.tracking.stakeUsed || 0),
    0
  );

  const openExposurePct =
    currentBankroll > 0 ? (openExposureAmount / currentBankroll) * 100 : 0;

  const remainingDailyCapacityPct = Math.max(
    0,
    policy.maxDailyExposurePct - openExposurePct
  );

  const remainingDailyCapacityAmount =
    currentBankroll > 0
      ? (currentBankroll * remainingDailyCapacityPct) / 100
      : 0;

  let riskLevel: "Low" | "Moderate" | "High" = "Low";
  if (openExposurePct > 8) riskLevel = "High";
  else if (openExposurePct > 3) riskLevel = "Moderate";

  return {
    openExposureAmount: Number(openExposureAmount.toFixed(2)),
    openExposurePct: Number(openExposurePct.toFixed(2)),
    totalPendingBets: pending.length,
    remainingDailyCapacityPct: Number(remainingDailyCapacityPct.toFixed(2)),
    remainingDailyCapacityAmount: Number(remainingDailyCapacityAmount.toFixed(2)),
    riskLevel,
  };
}

export function getTierPerformance(
  analyses: SavedAnalysis[]
): TierPerformance[] {
  const base: Record<BetTier, AggregateRow> = {
    premium: createAggregateRow(),
    elite: createAggregateRow(),
    bet: createAggregateRow(),
    watchlist: createAggregateRow(),
    discard: createAggregateRow(),
  };

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    const tier = getTrackedTier(analysis);
    updateAggregate(base[tier], analysis, selected);
  });

  return (Object.entries(base) as [BetTier, AggregateRow][])
    .map(([tier, row]) => ({
      tier,
      ...finalizeBaseRow(row),
    }))
    .filter((row) => row.bets > 0);
}

function getOddsBucket(odd: number): string {
  if (odd < 1.60) return "1.30–1.59";
  if (odd < 1.80) return "1.60–1.79";
  if (odd < 2.00) return "1.80–1.99";
  if (odd < 2.25) return "2.00–2.24";
  if (odd < 2.50) return "2.25–2.49";
  if (odd < 3.00) return "2.50–2.99";
  return "3.00+";
}

function getEdgeBucket(edge: number): string {
  if (edge < 1) return "0–0.99%";
  if (edge < 2) return "1–1.99%";
  if (edge < 3) return "2–2.99%";
  if (edge < 5) return "3–4.99%";
  return "5%+";
}

function getConfidenceBucket(confidence: number): string {
  if (confidence < 5) return "0–4.9";
  if (confidence < 6) return "5–5.9";
  if (confidence < 7) return "6–6.9";
  if (confidence < 8) return "7–7.9";
  return "8+";
}

function getRobustnessBucket(robustness?: number): string {
  const value = robustness ?? 0;
  if (value < 55) return "<55";
  if (value < 65) return "55–64";
  if (value < 75) return "65–74";
  if (value < 85) return "75–84";
  return "85+";
}

function getEdgeLowerBoundBucket(edgeLowerBound?: number): string {
  const value = edgeLowerBound ?? 0;
  if (value < 0) return "<0";
  if (value < 1) return "0–0.99";
  if (value < 2) return "1–1.99";
  if (value < 3) return "2–2.99";
  return "3+";
}

function getMarketGroup(market: string): string {
  const lower = market.toLowerCase();

  if (lower.includes("over")) return "Over";
  if (lower.includes("under")) return "Under";
  if (lower.includes("btts")) return "BTTS";
  if (lower === "home") return "Home";
  if (lower === "draw") return "Draw";
  if (lower === "away") return "Away";

  return market;
}

export function getOddsBucketPerformance(
  analyses: SavedAnalysis[]
): OddsBucketPerformance[] {
  const map = new Map<string, AggregateRow>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    const odd = analysis.tracking.oddUsed || selected.odds || 0;
    const bucket = getOddsBucket(odd);

    if (!map.has(bucket)) map.set(bucket, createAggregateRow());
    updateAggregate(map.get(bucket)!, analysis, selected);
  });

  return Array.from(map.entries()).map(([bucket, row]) => ({
    bucket,
    ...finalizeBaseRow(row),
  }));
}

export function getEdgeBucketPerformance(
  analyses: SavedAnalysis[]
): EdgeBucketPerformance[] {
  const map = new Map<string, AggregateRow>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    const bucket = getEdgeBucket(selected.valueBet || 0);

    if (!map.has(bucket)) map.set(bucket, createAggregateRow());
    updateAggregate(map.get(bucket)!, analysis, selected);
  });

  return Array.from(map.entries()).map(([bucket, row]) => ({
    bucket,
    ...finalizeBaseRow(row),
  }));
}

export function getMarketPerformance(
  analyses: SavedAnalysis[]
): MarketPerformance[] {
  const map = new Map<string, AggregateRow>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    const key = selected.market;

    if (!map.has(key)) map.set(key, createAggregateRow());
    updateAggregate(map.get(key)!, analysis, selected);
  });

  return Array.from(map.entries())
    .map(([market, row]) => ({
      market,
      marketGroup: getMarketGroup(market),
      ...finalizeBaseRow(row),
    }))
    .sort((a, b) => b.roi - a.roi);
}

export function getConfidenceBucketPerformance(
  analyses: SavedAnalysis[]
): ConfidenceBucketPerformance[] {
  const map = new Map<string, AggregateRow>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    const bucket = getConfidenceBucket(selected.confidence);

    if (!map.has(bucket)) map.set(bucket, createAggregateRow());
    updateAggregate(map.get(bucket)!, analysis, selected);
  });

  return Array.from(map.entries()).map(([bucket, row]) => ({
    bucket,
    ...finalizeBaseRow(row),
  }));
}

export function getRiskPerformance(
  analyses: SavedAnalysis[]
): RiskPerformance[] {
  const base: Record<RiskLevel, AggregateRow> = {
    Low: createAggregateRow(),
    Medium: createAggregateRow(),
    High: createAggregateRow(),
  };

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    updateAggregate(base[selected.risk], analysis, selected);
  });

  return (Object.entries(base) as [RiskLevel, AggregateRow][])
    .map(([risk, row]) => ({
      risk,
      ...finalizeBaseRow(row),
    }))
    .filter((row) => row.bets > 0);
}

export function getRobustnessBucketPerformance(
  analyses: SavedAnalysis[]
): RobustnessBucketPerformance[] {
  const map = new Map<string, AggregateRow>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    const bucket = getRobustnessBucket(selected.robustness);

    if (!map.has(bucket)) map.set(bucket, createAggregateRow());
    updateAggregate(map.get(bucket)!, analysis, selected);
  });

  return Array.from(map.entries()).map(([bucket, row]) => ({
    bucket,
    ...finalizeBaseRow(row),
  }));
}

export function getEdgeLowerBoundBucketPerformance(
  analyses: SavedAnalysis[]
): EdgeLowerBoundBucketPerformance[] {
  const map = new Map<string, AggregateRow>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = getTrackedResult(analysis);
    if (!selected) return;

    const bucket = getEdgeLowerBoundBucket(selected.edgeLowerBound);

    if (!map.has(bucket)) map.set(bucket, createAggregateRow());
    updateAggregate(map.get(bucket)!, analysis, selected);
  });

  return Array.from(map.entries()).map(([bucket, row]) => ({
    bucket,
    ...finalizeBaseRow(row),
  }));
}