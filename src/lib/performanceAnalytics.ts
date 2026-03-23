import type { SavedAnalysis } from "@/types/analysis";
import {
  getTierPerformance,
  getOddsBucketPerformance,
  getEdgeBucketPerformance,
} from "@/lib/portofolioEngine";

export interface PerformanceSummary {
  totalSettledBets: number;
  totalProfitLoss: number;
  totalStake: number;
  overallRoi: number;
  hitRate: number;
}

export function getPerformanceSummary(
  analyses: SavedAnalysis[]
): PerformanceSummary {
  const settled = analyses.filter(
    (analysis) =>
      analysis.tracking?.betPlaced &&
      ["green", "red", "void"].includes(analysis.tracking.resultStatus)
  );

  const totalStake = settled.reduce(
    (sum, item) => sum + (item.tracking.stakeUsed || 0),
    0
  );

  const totalProfitLoss = settled.reduce(
    (sum, item) => sum + (item.tracking.profitLoss || 0),
    0
  );

  const wins = settled.filter(
    (item) => item.tracking.resultStatus === "green"
  ).length;

  return {
    totalSettledBets: settled.length,
    totalProfitLoss: Number(totalProfitLoss.toFixed(2)),
    totalStake: Number(totalStake.toFixed(2)),
    overallRoi:
      totalStake > 0
        ? Number(((totalProfitLoss / totalStake) * 100).toFixed(1))
        : 0,
    hitRate:
      settled.length > 0
        ? Number(((wins / settled.length) * 100).toFixed(1))
        : 0,
  };
}

export function getAdvancedPerformanceBreakdown(analyses: SavedAnalysis[]) {
  return {
    summary: getPerformanceSummary(analyses),
    tierPerformance: getTierPerformance(analyses),
    oddsBucketPerformance: getOddsBucketPerformance(analyses),
    edgeBucketPerformance: getEdgeBucketPerformance(analyses),
  };
}