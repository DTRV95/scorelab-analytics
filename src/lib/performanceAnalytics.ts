import type { SavedAnalysis } from "@/types/analysis";
import { buildFinancialSnapshot, getFinancialLocalDateKey } from "@/lib/financialEngine";
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

interface MultiplePerformanceInput {
  createdAt: string;
  tracking: {
    betPlaced: boolean;
    stakeUsed: number | null;
    resultStatus: string;
    placedAt?: string | null;
    profitLoss: number;
  };
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
  analyses: SavedAnalysis[],
  multiples: MultiplePerformanceInput[] = []
): PerformanceSummary {
  const trackedEntries = getAllAnalysisTrackingEntries(analyses).filter(
    (entry) =>
      entry.tracking.betPlaced && isSettledResult(entry.tracking.resultStatus)
  );
  const settledMultiples = multiples.filter(
    (multiple) =>
      multiple.tracking.betPlaced && isSettledResult(multiple.tracking.resultStatus)
  );

  const snapshot = buildFinancialSnapshot({
    analyses: trackedEntries.map((entry) => ({
      createdAt: entry.createdAt,
      tracking: entry.tracking,
    })),
    multiples: settledMultiples.map((multiple) => ({
      createdAt: multiple.createdAt,
      tracking: multiple.tracking,
    })),
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
  analyses: SavedAnalysis[],
  multiples: MultiplePerformanceInput[] = []
): DailyProfitPoint[] {
  const settled = getAllAnalysisTrackingEntries(analyses).filter(
    (entry) => entry.tracking.betPlaced && isSettledResult(entry.tracking.resultStatus)
  );
  const settledMultiples = multiples.filter(
    (multiple) =>
      multiple.tracking.betPlaced && isSettledResult(multiple.tracking.resultStatus)
  );
  const grouped = new Map<
    string,
    { profitLoss: number; stake: number; bets: number; ts: number }
  >();

  const addPoint = ({
    createdAt,
    tracking,
  }: {
    createdAt: string;
    tracking: {
      placedAt?: string | null;
      profitLoss: number;
      stakeUsed: number | null;
    };
  }) => {
    const occurredAt = tracking.placedAt || createdAt;
    const dateObj = new Date(occurredAt);
    const safeTime = Number.isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();
    const dateKey = getFinancialLocalDateKey(occurredAt) || "Unknown";

    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, {
        profitLoss: 0,
        stake: 0,
        bets: 0,
        ts: safeTime,
      });
    }

    const row = grouped.get(dateKey)!;
    row.profitLoss += tracking.profitLoss || 0;
    row.stake += tracking.stakeUsed || 0;
    row.bets += 1;
    row.ts = Math.min(row.ts, safeTime);
  };

  settled.forEach((entry) => addPoint({ createdAt: entry.createdAt, tracking: entry.tracking }));
  settledMultiples.forEach((multiple) =>
    addPoint({ createdAt: multiple.createdAt, tracking: multiple.tracking })
  );

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
  analyses: SavedAnalysis[],
  multiples: MultiplePerformanceInput[] = []
): AdvancedPerformanceBreakdown {
  const safeAnalyses = Array.isArray(analyses) ? analyses : [];
  const safeMultiples = Array.isArray(multiples) ? multiples : [];

  return {
    summary: getPerformanceSummary(safeAnalyses, safeMultiples),
    dailyProfitTrend: getDailyProfitTrend(safeAnalyses, safeMultiples),
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
