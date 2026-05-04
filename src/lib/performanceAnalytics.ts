import type { SavedAnalysis } from "@/types/analysis";
import { buildFinancialSnapshot } from "@/lib/financialEngine";
import { getAllAnalysisTrackingEntries } from "@/lib/analysisStorage";
import {
  getTierPerformance,
  getOddsBucketPerformance,
  getEdgeBucketPerformance,
  getMarketPerformance,
  getConfidenceBucketPerformance,
  getRiskPerformance,
  getRobustnessBucketPerformance,
  getEdgeLowerBoundBucketPerformance,
} from "@/lib/portofolioEngine";

export interface PerformanceSummary {
  totalSettledBets: number;
  totalProfitLoss: number;
  totalStake: number;
  overallRoi: number;
  hitRate: number;
}

export interface DailyProfitPoint {
  date: string;
  profitLoss: number;
  stake: number;
  roi: number;
  bets: number;
}

export interface AdvancedPerformanceBreakdown {
  summary: PerformanceSummary;
  dailyProfitTrend: DailyProfitPoint[];
  tierPerformance: ReturnType<typeof getTierPerformance>;
  oddsBucketPerformance: ReturnType<typeof getOddsBucketPerformance>;
  edgeBucketPerformance: ReturnType<typeof getEdgeBucketPerformance>;
  marketPerformance: ReturnType<typeof getMarketPerformance>;
  confidenceBucketPerformance: ReturnType<typeof getConfidenceBucketPerformance>;
  riskPerformance: ReturnType<typeof getRiskPerformance>;
  robustnessBucketPerformance: ReturnType<typeof getRobustnessBucketPerformance>;
  edgeLowerBoundBucketPerformance: ReturnType<typeof getEdgeLowerBoundBucketPerformance>;
}

function isSettledResult(status?: string): boolean {
  return status === "green" || status === "red" || status === "void";
}

function isValidTrackedBet(analysis: SavedAnalysis): boolean {
  return Boolean(
    analysis?.tracking?.betPlaced &&
      isSettledResult(analysis.tracking?.resultStatus)
  );
}

export function getPerformanceSummary(
  analyses: SavedAnalysis[]
): PerformanceSummary {
  const trackedEntries = getAllAnalysisTrackingEntries(analyses).filter(
    (entry) =>
      entry.tracking.betPlaced && isSettledResult(entry.tracking.resultStatus)
  );

  const snapshot = buildFinancialSnapshot({
    analyses: trackedEntries.map((entry) => ({
      createdAt: entry.createdAt,
      tracking: entry.tracking,
    })),
    multiples: [],
    initialBankroll: 0,
  });

  return {
    totalSettledBets:
      snapshot.stats.totalGreens +
      snapshot.stats.totalReds +
      snapshot.stats.totalVoids,
    totalProfitLoss: snapshot.stats.totalProfitLoss,
    totalStake: snapshot.stats.totalStaked,
    overallRoi: Number(snapshot.stats.roi.toFixed(1)),
    hitRate: Number(snapshot.stats.hitRate.toFixed(1)),
  };
}

export function getDailyProfitTrend(
  analyses: SavedAnalysis[]
): DailyProfitPoint[] {
  const settled = getAllAnalysisTrackingEntries(analyses).filter(
    (entry) => entry.tracking.betPlaced && isSettledResult(entry.tracking.resultStatus)
  );
  const grouped = new Map<
    string,
    { profitLoss: number; stake: number; bets: number; ts: number }
  >();

  settled.forEach((entry) => {
    const occurredAt = entry.tracking.placedAt || entry.createdAt;
    const dateObj = new Date(occurredAt);
    const safeTime = Number.isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
    const dateKey = dateObj.toLocaleDateString();

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        profitLoss: 0,
        stake: 0,
        bets: 0,
        ts: safeTime,
      });
    }

    const row = grouped.get(dateKey)!;
    row.profitLoss += entry.tracking.profitLoss || 0;
    row.stake += entry.tracking.stakeUsed || 0;
    row.bets += 1;
    row.ts = Math.min(row.ts, safeTime);
  });

  return Array.from(grouped.entries())
    .map(([date, row]) => ({
      date,
      profitLoss: Number(row.profitLoss.toFixed(2)),
      stake: Number(row.stake.toFixed(2)),
      roi:
        row.stake > 0
          ? Number(((row.profitLoss / row.stake) * 100).toFixed(1))
          : 0,
      bets: row.bets,
      ts: row.ts,
    }))
    .sort((a, b) => a.ts - b.ts)
    .map(({ ts, ...rest }) => rest);
}

export function getAdvancedPerformanceBreakdown(
  analyses: SavedAnalysis[]
): AdvancedPerformanceBreakdown {
  const safeAnalyses = Array.isArray(analyses) ? analyses : [];

  return {
    summary: getPerformanceSummary(safeAnalyses),
    dailyProfitTrend: getDailyProfitTrend(safeAnalyses),
    tierPerformance: getTierPerformance(safeAnalyses),
    oddsBucketPerformance: getOddsBucketPerformance(safeAnalyses),
    edgeBucketPerformance: getEdgeBucketPerformance(safeAnalyses),
    marketPerformance: getMarketPerformance(safeAnalyses),
    confidenceBucketPerformance: getConfidenceBucketPerformance(safeAnalyses),
    riskPerformance: getRiskPerformance(safeAnalyses),
    robustnessBucketPerformance: getRobustnessBucketPerformance(safeAnalyses),
    edgeLowerBoundBucketPerformance:
      getEdgeLowerBoundBucketPerformance(safeAnalyses),
  };
}
