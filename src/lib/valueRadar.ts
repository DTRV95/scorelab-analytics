import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";
import { getAnalysisTrackingEntries } from "@/lib/analysisStorage";

export type RadarOpportunity = {
  id: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  edge: number;
  modelProb: number;
  confidence: number;
  odds: number;
  kelly: number;
  stake: number;
  decision: "Bet" | "Caution" | "No Bet";
  tier?: "premium" | "elite" | "bet" | "watchlist" | "discard";
  risk: "Low" | "Medium" | "High";
  createdAt: string;
  xg: number;
  profitLoss?: number;
  betPlaced: boolean;
};

export function getTrackedOrBestResult(analysis: SavedAnalysis): AnalysisResult | null {
  if (analysis.tracking?.selectedMarket) {
    const tracked = analysis.results.find(
      (result) => result.market === analysis.tracking.selectedMarket
    );
    if (tracked) return tracked;
  }

  if (!analysis.results.length) return null;

  return analysis.results.reduce((best, current) =>
    best.valueBet > current.valueBet ? best : current
  );
}

export function buildRadarOpportunities(analyses: SavedAnalysis[]): RadarOpportunity[] {
  return analyses
    .map((analysis) => {
      const trackedEntries = getAnalysisTrackingEntries(analysis);
      const result = getTrackedOrBestResult(analysis);
      if (!result) return null;

      return {
        id: analysis.id,
        match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
        homeTeam: analysis.homeTeam,
        awayTeam: analysis.awayTeam,
        market: result.market,
        edge: result.valueBet,
        modelProb: result.modelProb,
        confidence: result.confidence,
        odds: result.odds,
        kelly: result.kelly,
        stake: result.stake,
        decision: result.decision,
        tier: result.tier,
        risk: result.risk,
        createdAt: analysis.createdAt,
        xg: analysis.summary.totalXg,
        profitLoss: trackedEntries.reduce(
          (sum, entry) => sum + (entry.tracking.profitLoss || 0),
          0
        ),
        betPlaced: trackedEntries.some((entry) => entry.tracking.betPlaced),
      };
    })
    .filter(Boolean) as RadarOpportunity[];
}
