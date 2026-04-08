import { getAnalyses } from "@/lib/analysisStorage";
import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";

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

export interface HistoricalSignal {
  label: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
}

export interface DashboardAutoInsight {
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
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
        analysis?.tracking?.betPlaced &&
        analysis?.tracking?.selectedMarket &&
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
    current.totalEdge += bet.selectedResult.valueBet || 0;
    current.totalConfidence += bet.selectedResult.confidence || 0;

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
      avgEdge: item.bets > 0 ? Number((item.totalEdge / item.bets).toFixed(2)) : 0,
      avgConfidence:
        item.bets > 0 ? Number((item.totalConfidence / item.bets).toFixed(2)) : 0,
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
    const bucket = getEdgeBucket(bet.selectedResult.valueBet || 0);

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
    current.totalConfidence += bet.selectedResult.confidence || 0;

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
      avgConfidence:
        item.bets > 0 ? Number((item.totalConfidence / item.bets).toFixed(2)) : 0,
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
    const bucket = getConfidenceBucket(bet.selectedResult.confidence || 0);

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
    current.totalEdge += bet.selectedResult.valueBet || 0;

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
      avgEdge: item.bets > 0 ? Number((item.totalEdge / item.bets).toFixed(2)) : 0,
    }))
    .sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));
}

export function getEdgeZoneSummary(): EdgeZoneSummary {
  const markets = getMarketEdgeInsights().filter((x) => x.bets >= 2);
  const edgeBuckets = getEdgeBucketInsights().filter((x) => x.bets >= 2);
  const confidenceBuckets = getConfidenceBucketInsights().filter((x) => x.bets >= 2);

  return {
    bestMarket: markets.length > 0 ? markets[0] : null,
    worstMarket:
      markets.length > 0 ? [...markets].sort((a, b) => a.roi - b.roi)[0] : null,
    bestEdgeBucket:
      edgeBuckets.length > 0
        ? [...edgeBuckets].sort((a, b) => b.roi - a.roi)[0]
        : null,
    worstEdgeBucket:
      edgeBuckets.length > 0
        ? [...edgeBuckets].sort((a, b) => a.roi - b.roi)[0]
        : null,
    bestConfidenceBucket:
      confidenceBuckets.length > 0
        ? [...confidenceBuckets].sort((a, b) => b.roi - a.roi)[0]
        : null,
    worstConfidenceBucket:
      confidenceBuckets.length > 0
        ? [...confidenceBuckets].sort((a, b) => a.roi - b.roi)[0]
        : null,
  };
}

export function getDashboardAutoInsights(): DashboardAutoInsight[] {
  const summary = getEdgeZoneSummary();
  const insights: DashboardAutoInsight[] = [];

  if (summary.bestMarket) {
    insights.push({
      title: "Best market",
      detail: `${summary.bestMarket.market} is the strongest tracked market so far with ${summary.bestMarket.roi.toFixed(1)}% ROI across ${summary.bestMarket.bets} bets.`,
      tone: summary.bestMarket.roi >= 0 ? "positive" : "neutral",
    });
  }

  if (summary.worstMarket && summary.worstMarket.market !== summary.bestMarket?.market) {
    insights.push({
      title: "Weak market",
      detail: `${summary.worstMarket.market} is currently the weakest market with ${summary.worstMarket.roi.toFixed(1)}% ROI.`,
      tone: "negative",
    });
  }

  if (summary.bestEdgeBucket) {
    insights.push({
      title: "Best edge zone",
      detail: `Edge bucket ${summary.bestEdgeBucket.bucket} is performing best at ${summary.bestEdgeBucket.roi.toFixed(1)}% ROI.`,
      tone: summary.bestEdgeBucket.roi >= 0 ? "positive" : "neutral",
    });
  }

  if (summary.bestConfidenceBucket) {
    insights.push({
      title: "Best confidence zone",
      detail: `Confidence bucket ${summary.bestConfidenceBucket.bucket} is your strongest tracked confidence zone.`,
      tone: summary.bestConfidenceBucket.roi >= 0 ? "neutral" : "negative",
    });
  }

  if (!insights.length) {
    insights.push({
      title: "Not enough tracked data",
      detail:
        "Start tracking more settled bets to unlock reliable historical insights.",
      tone: "neutral",
    });
  }

  return insights.slice(0, 4);
}

export function getHistoricalSignalsForResult(
  result: AnalysisResult
): HistoricalSignal[] {
  const signals: HistoricalSignal[] = [];

  const marketInsight = getMarketEdgeInsights().find(
    (item) => item.market === result.market
  );
  const edgeInsight = getEdgeBucketInsights().find(
    (item) => item.bucket === getEdgeBucket(result.valueBet || 0)
  );
  const confidenceInsight = getConfidenceBucketInsights().find(
    (item) => item.bucket === getConfidenceBucket(result.confidence || 0)
  );

  if (marketInsight && marketInsight.bets >= 2) {
    signals.push({
      label: "Market history",
      detail:
        marketInsight.roi >= 0
          ? `${result.market} is historically positive at ${marketInsight.roi.toFixed(1)}% ROI over ${marketInsight.bets} tracked bets.`
          : `${result.market} is historically weak at ${marketInsight.roi.toFixed(1)}% ROI over ${marketInsight.bets} tracked bets.`,
      tone: marketInsight.roi >= 0 ? "positive" : "negative",
    });
  }

  if (edgeInsight && edgeInsight.bets >= 2) {
    signals.push({
      label: "Edge bucket",
      detail:
        edgeInsight.roi >= 0
          ? `Edge bucket ${edgeInsight.bucket} is performing well with ${edgeInsight.roi.toFixed(1)}% ROI.`
          : `Edge bucket ${edgeInsight.bucket} is underperforming with ${edgeInsight.roi.toFixed(1)}% ROI.`,
      tone: edgeInsight.roi >= 0 ? "positive" : "negative",
    });
  }

  if (confidenceInsight && confidenceInsight.bets >= 2) {
    signals.push({
      label: "Confidence bucket",
      detail:
        confidenceInsight.roi >= 0
          ? `Confidence bucket ${confidenceInsight.bucket} is holding up at ${confidenceInsight.roi.toFixed(1)}% ROI.`
          : `Confidence bucket ${confidenceInsight.bucket} is not validating well at ${confidenceInsight.roi.toFixed(1)}% ROI.`,
      tone: confidenceInsight.roi >= 0 ? "neutral" : "negative",
    });
  }

  if (!signals.length) {
    signals.push({
      label: "Historical coverage",
      detail:
        "Not enough tracked sample yet to generate reliable historical warnings for this pick.",
      tone: "neutral",
    });
  }

  return signals.slice(0, 3);
}