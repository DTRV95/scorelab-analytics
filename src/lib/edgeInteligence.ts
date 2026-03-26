import { getAnalyses } from "@/lib/analysisStorage";
import type { SavedAnalysis } from "@/types/analysis";

export interface EdgeMarketInsight {
  market: string;
  bets: number;
  greens: number;
  reds: number;
  totalStake: number;
  totalProfitLoss: number;
  roi: number;
  hitRate: number;
  avgEdge: number;
  avgConfidence: number;
}

export interface EdgeBucketInsight {
  bucket: string;
  bets: number;
  greens: number;
  reds: number;
  totalStake: number;
  totalProfitLoss: number;
  roi: number;
  hitRate: number;
  avgConfidence: number;
}

export interface ConfidenceBucketInsight {
  bucket: string;
  bets: number;
  greens: number;
  reds: number;
  totalStake: number;
  totalProfitLoss: number;
  roi: number;
  hitRate: number;
  avgEdge: number;
}

export interface EdgeZoneSummary {
  bestMarket: EdgeMarketInsight | null;
  worstMarket: EdgeMarketInsight | null;
  bestEdgeBucket: EdgeBucketInsight | null;
  worstEdgeBucket: EdgeBucketInsight | null;
  bestConfidenceBucket: ConfidenceBucketInsight | null;
  worstConfidenceBucket: ConfidenceBucketInsight | null;
}

interface SettledBetContext {
  analysis: SavedAnalysis;
  selectedMarket: string;
  selectedResult: SavedAnalysis["results"][number];
  stake: number;
  profitLoss: number;
  status: "green" | "red" | "void";
}

function getSettledTrackedBets(): SettledBetContext[] {
  const analyses = getAnalyses();

  return analyses
    .filter(
      (analysis) =>
        analysis.tracking.betPlaced &&
        analysis.tracking.selectedMarket &&
        (analysis.tracking.resultStatus === "green" ||
          analysis.tracking.resultStatus === "red" ||
          analysis.tracking.resultStatus === "void")
    )
    .map((analysis) => {
      const selectedMarket = analysis.tracking.selectedMarket!;
      const selectedResult = analysis.results.find(
        (r) => r.market === selectedMarket
      );

      if (!selectedResult) return null;

      return {
        analysis,
        selectedMarket,
        selectedResult,
        stake: analysis.tracking.stakeUsed || 0,
        profitLoss: analysis.tracking.profitLoss || 0,
        status: analysis.tracking.resultStatus as "green" | "red" | "void",
      };
    })
    .filter(Boolean) as SettledBetContext[];
}

function getEdgeBucket(valueBet: number): string {
  if (valueBet < 3) return "0–2.9%";
  if (valueBet < 5) return "3–4.9%";
  if (valueBet < 7) return "5–6.9%";
  return "7%+";
}

function getConfidenceBucket(confidence: number): string {
  if (confidence <= 5) return "0–5";
  if (confidence <= 6) return "6";
  if (confidence <= 7) return "7";
  if (confidence <= 8) return "8";
  return "9–10";
}

export function getMarketEdgeInsights(): EdgeMarketInsight[] {
  const bets = getSettledTrackedBets();
  const map = new Map<
    string,
    {
      market: string;
      bets: number;
      greens: number;
      reds: number;
      totalStake: number;
      totalProfitLoss: number;
      totalEdge: number;
      totalConfidence: number;
    }
  >();

  bets.forEach((bet) => {
    const current = map.get(bet.selectedMarket) || {
      market: bet.selectedMarket,
      bets: 0,
      greens: 0,
      reds: 0,
      totalStake: 0,
      totalProfitLoss: 0,
      totalEdge: 0,
      totalConfidence: 0,
    };

    current.bets += 1;
    current.totalStake += bet.stake;
    current.totalProfitLoss += bet.profitLoss;
    current.totalEdge += bet.selectedResult.valueBet;
    current.totalConfidence += bet.selectedResult.confidence;

    if (bet.status === "green") current.greens += 1;
    if (bet.status === "red") current.reds += 1;

    map.set(bet.selectedMarket, current);
  });

  return Array.from(map.values())
    .map((item) => ({
      market: item.market,
      bets: item.bets,
      greens: item.greens,
      reds: item.reds,
      totalStake: Number(item.totalStake.toFixed(2)),
      totalProfitLoss: Number(item.totalProfitLoss.toFixed(2)),
      roi:
        item.totalStake > 0
          ? Number(((item.totalProfitLoss / item.totalStake) * 100).toFixed(2))
          : 0,
      hitRate:
        item.greens + item.reds > 0
          ? Number(((item.greens / (item.greens + item.reds)) * 100).toFixed(2))
          : 0,
      avgEdge: Number((item.totalEdge / item.bets).toFixed(2)),
      avgConfidence: Number((item.totalConfidence / item.bets).toFixed(2)),
    }))
    .sort((a, b) => b.roi - a.roi);
}

export function getEdgeBucketInsights(): EdgeBucketInsight[] {
  const bets = getSettledTrackedBets();
  const map = new Map<
    string,
    {
      bucket: string;
      bets: number;
      greens: number;
      reds: number;
      totalStake: number;
      totalProfitLoss: number;
      totalConfidence: number;
    }
  >();

  bets.forEach((bet) => {
    const bucket = getEdgeBucket(bet.selectedResult.valueBet);

    const current = map.get(bucket) || {
      bucket,
      bets: 0,
      greens: 0,
      reds: 0,
      totalStake: 0,
      totalProfitLoss: 0,
      totalConfidence: 0,
    };

    current.bets += 1;
    current.totalStake += bet.stake;
    current.totalProfitLoss += bet.profitLoss;
    current.totalConfidence += bet.selectedResult.confidence;

    if (bet.status === "green") current.greens += 1;
    if (bet.status === "red") current.reds += 1;

    map.set(bucket, current);
  });

  const order = ["0–2.9%", "3–4.9%", "5–6.9%", "7%+"];

  return Array.from(map.values())
    .map((item) => ({
      bucket: item.bucket,
      bets: item.bets,
      greens: item.greens,
      reds: item.reds,
      totalStake: Number(item.totalStake.toFixed(2)),
      totalProfitLoss: Number(item.totalProfitLoss.toFixed(2)),
      roi:
        item.totalStake > 0
          ? Number(((item.totalProfitLoss / item.totalStake) * 100).toFixed(2))
          : 0,
      hitRate:
        item.greens + item.reds > 0
          ? Number(((item.greens / (item.greens + item.reds)) * 100).toFixed(2))
          : 0,
      avgConfidence: Number((item.totalConfidence / item.bets).toFixed(2)),
    }))
    .sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));
}

export function getConfidenceBucketInsights(): ConfidenceBucketInsight[] {
  const bets = getSettledTrackedBets();
  const map = new Map<
    string,
    {
      bucket: string;
      bets: number;
      greens: number;
      reds: number;
      totalStake: number;
      totalProfitLoss: number;
      totalEdge: number;
    }
  >();

  bets.forEach((bet) => {
    const bucket = getConfidenceBucket(bet.selectedResult.confidence);

    const current = map.get(bucket) || {
      bucket,
      bets: 0,
      greens: 0,
      reds: 0,
      totalStake: 0,
      totalProfitLoss: 0,
      totalEdge: 0,
    };

    current.bets += 1;
    current.totalStake += bet.stake;
    current.totalProfitLoss += bet.profitLoss;
    current.totalEdge += bet.selectedResult.valueBet;

    if (bet.status === "green") current.greens += 1;
    if (bet.status === "red") current.reds += 1;

    map.set(bucket, current);
  });

  const order = ["0–5", "6", "7", "8", "9–10"];

  return Array.from(map.values())
    .map((item) => ({
      bucket: item.bucket,
      bets: item.bets,
      greens: item.greens,
      reds: item.reds,
      totalStake: Number(item.totalStake.toFixed(2)),
      totalProfitLoss: Number(item.totalProfitLoss.toFixed(2)),
      roi:
        item.totalStake > 0
          ? Number(((item.totalProfitLoss / item.totalStake) * 100).toFixed(2))
          : 0,
      hitRate:
        item.greens + item.reds > 0
          ? Number(((item.greens / (item.greens + item.reds)) * 100).toFixed(2))
          : 0,
      avgEdge: Number((item.totalEdge / item.bets).toFixed(2)),
    }))
    .sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));
}

export function getEdgeZoneSummary(): EdgeZoneSummary {
  const markets = getMarketEdgeInsights().filter((x) => x.bets >= 2);
  const edgeBuckets = getEdgeBucketInsights().filter((x) => x.bets >= 2);
  const confidenceBuckets = getConfidenceBucketInsights().filter((x) => x.bets >= 2);

  return {
    bestMarket: markets.length > 0 ? markets[0] : null,
    worstMarket: markets.length > 0 ? [...markets].sort((a, b) => a.roi - b.roi)[0] : null,

    bestEdgeBucket: edgeBuckets.length > 0
      ? [...edgeBuckets].sort((a, b) => b.roi - a.roi)[0]
      : null,
    worstEdgeBucket: edgeBuckets.length > 0
      ? [...edgeBuckets].sort((a, b) => a.roi - b.roi)[0]
      : null,

    bestConfidenceBucket: confidenceBuckets.length > 0
      ? [...confidenceBuckets].sort((a, b) => b.roi - a.roi)[0]
      : null,
    worstConfidenceBucket: confidenceBuckets.length > 0
      ? [...confidenceBuckets].sort((a, b) => a.roi - b.roi)[0]
      : null,
  };
}