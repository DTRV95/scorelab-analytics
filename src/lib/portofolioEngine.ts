import type { SavedAnalysis, BetTier, BetStatus } from "@/types/analysis";
import * as EliteBetSystem from "@/lib/eliteBetSystem";

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
  totalStake: number;
  profitLoss: number;
  roi: number;
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
  const remainingCapacityPct = Math.max(0, policy.maxDailyExposurePct - currentOpenExposurePct);
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
    currentBankroll > 0 ? (currentBankroll * remainingDailyCapacityPct) / 100 : 0;

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

function getTrackedTier(analysis: SavedAnalysis): BetTier {
  const selected = analysis.results.find(
    (result) => result.market === analysis.tracking.selectedMarket
  );

  if (!selected?.tier) return "discard";
  return selected.tier;
}

function isSettled(status: BetStatus): boolean {
  return status === "green" || status === "red" || status === "void";
}

export function getTierPerformance(
  analyses: SavedAnalysis[]
): TierPerformance[] {
  const base: Record<BetTier, TierPerformance> = {
    premium: { tier: "premium", bets: 0, wins: 0, losses: 0, voids: 0, hitRate: 0, totalStake: 0, profitLoss: 0, roi: 0 },
    elite: { tier: "elite", bets: 0, wins: 0, losses: 0, voids: 0, hitRate: 0, totalStake: 0, profitLoss: 0, roi: 0 },
    bet: { tier: "bet", bets: 0, wins: 0, losses: 0, voids: 0, hitRate: 0, totalStake: 0, profitLoss: 0, roi: 0 },
    watchlist: { tier: "watchlist", bets: 0, wins: 0, losses: 0, voids: 0, hitRate: 0, totalStake: 0, profitLoss: 0, roi: 0 },
    discard: { tier: "discard", bets: 0, wins: 0, losses: 0, voids: 0, hitRate: 0, totalStake: 0, profitLoss: 0, roi: 0 },
  };

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const tier = getTrackedTier(analysis);
    const bucket = base[tier];

    bucket.bets += 1;
    bucket.totalStake += analysis.tracking.stakeUsed || 0;
    bucket.profitLoss += analysis.tracking.profitLoss || 0;

    if (analysis.tracking.resultStatus === "green") bucket.wins += 1;
    if (analysis.tracking.resultStatus === "red") bucket.losses += 1;
    if (analysis.tracking.resultStatus === "void") bucket.voids += 1;
  });

  return Object.values(base)
    .map((row) => ({
      ...row,
      hitRate: row.bets > 0 ? Number(((row.wins / row.bets) * 100).toFixed(1)) : 0,
      roi: row.totalStake > 0 ? Number(((row.profitLoss / row.totalStake) * 100).toFixed(1)) : 0,
      totalStake: Number(row.totalStake.toFixed(2)),
      profitLoss: Number(row.profitLoss.toFixed(2)),
    }))
    .filter((row) => row.bets > 0);
}

function getOddsBucket(odd: number): string {
  if (odd < 1.9) return "1.50–1.89";
  if (odd < 2.4) return "1.90–2.39";
  return "2.40+";
}

function getEdgeBucket(edge: number): string {
  if (edge < 5) return "3–4.9%";
  if (edge < 7) return "5–6.9%";
  return "7%+";
}

export function getOddsBucketPerformance(
  analyses: SavedAnalysis[]
): OddsBucketPerformance[] {
  const map = new Map<string, OddsBucketPerformance>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;
    if (!analysis.tracking.oddUsed) return;

    const bucket = getOddsBucket(analysis.tracking.oddUsed);
    if (!map.has(bucket)) {
      map.set(bucket, {
        bucket,
        bets: 0,
        wins: 0,
        losses: 0,
        voids: 0,
        totalStake: 0,
        profitLoss: 0,
        roi: 0,
      });
    }

    const row = map.get(bucket)!;
    row.bets += 1;
    row.totalStake += analysis.tracking.stakeUsed || 0;
    row.profitLoss += analysis.tracking.profitLoss || 0;

    if (analysis.tracking.resultStatus === "green") row.wins += 1;
    if (analysis.tracking.resultStatus === "red") row.losses += 1;
    if (analysis.tracking.resultStatus === "void") row.voids += 1;
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    totalStake: Number(row.totalStake.toFixed(2)),
    profitLoss: Number(row.profitLoss.toFixed(2)),
    roi: row.totalStake > 0 ? Number(((row.profitLoss / row.totalStake) * 100).toFixed(1)) : 0,
  }));
}

export function getEdgeBucketPerformance(
  analyses: SavedAnalysis[]
): EdgeBucketPerformance[] {
  const map = new Map<string, EdgeBucketPerformance>();

  analyses.forEach((analysis) => {
    if (!analysis.tracking?.betPlaced) return;
    if (!isSettled(analysis.tracking.resultStatus)) return;

    const selected = analysis.results.find(
      (result) => result.market === analysis.tracking.selectedMarket
    );

    if (!selected) return;

    const bucket = getEdgeBucket(selected.valueBet);
    if (!map.has(bucket)) {
      map.set(bucket, {
        bucket,
        bets: 0,
        wins: 0,
        losses: 0,
        voids: 0,
        totalStake: 0,
        profitLoss: 0,
        roi: 0,
      });
    }

    const row = map.get(bucket)!;
    row.bets += 1;
    row.totalStake += analysis.tracking.stakeUsed || 0;
    row.profitLoss += analysis.tracking.profitLoss || 0;

    if (analysis.tracking.resultStatus === "green") row.wins += 1;
    if (analysis.tracking.resultStatus === "red") row.losses += 1;
    if (analysis.tracking.resultStatus === "void") row.voids += 1;
  });

  return Array.from(map.values()).map((row) => ({
    ...row,
    totalStake: Number(row.totalStake.toFixed(2)),
    profitLoss: Number(row.profitLoss.toFixed(2)),
    roi: row.totalStake > 0 ? Number(((row.profitLoss / row.totalStake) * 100).toFixed(1)) : 0,
  }));
}

function getCorrelationGroup(market: string): string {
  const lower = market.toLowerCase();

  if (lower.includes("over 2.5") || lower.includes("over 3.5")) return "overs";
  if (lower.includes("under 2.5") || lower.includes("under 3.5")) return "unders";
  if (lower.includes("btts yes")) return "btts-yes";
  if (lower.includes("btts no")) return "btts-no";

  return "other";
}

export function suppressCorrelatedSignals(
  analyses: SavedAnalysis[],
  policy: BankrollPolicy = DEFAULT_BANKROLL_POLICY
) {
  const ranked = EliteBetSystem.buildRankedOpportunities(analyses);
  const bestPerMatch = EliteBetSystem.getUniqueBestPerMatch(ranked);

  if (!policy.suppressCorrelatedMarkets) return bestPerMatch;

  const seen = new Set<string>();

  return bestPerMatch.filter((item) => {
    const group = getCorrelationGroup(item.market);
    const key = `${item.match}-${group}`;

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function canAddBetForMatch(
  analyses: SavedAnalysis[],
  match: string,
  currentBankroll: number,
  additionalStakePct: number,
  policy: BankrollPolicy = DEFAULT_BANKROLL_POLICY
): { allowed: boolean; reason?: string } {
  const pendingSameMatch = analyses.filter(
    (analysis) =>
      `${analysis.homeTeam} vs ${analysis.awayTeam}` === match &&
      analysis.tracking?.betPlaced &&
      analysis.tracking?.resultStatus === "pending"
  );

  const sameMatchStake = pendingSameMatch.reduce(
    (sum, analysis) => sum + (analysis.tracking.stakeUsed || 0),
    0
  );

  const sameMatchPct =
    currentBankroll > 0 ? (sameMatchStake / currentBankroll) * 100 : 0;

  if (sameMatchPct + additionalStakePct > policy.maxPerMatchPct) {
    return {
      allowed: false,
      reason: "Match-level exposure cap exceeded",
    };
  }

  return { allowed: true };
}