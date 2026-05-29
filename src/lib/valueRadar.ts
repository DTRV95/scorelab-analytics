import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";
import { getAnalysisTrackingEntries } from "@/lib/analysisStorage";
import {
  buildCalibrationModel,
  calibrateOpportunity,
  type CalibrationModel,
} from "@/lib/calibrationEngine";

export type RadarOpportunity = {
  id: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  edge: number;
  modelProb: number;
  calibratedProb: number;
  calibrationLabel: "Boosted" | "Calibrated" | "Caution" | "Avoid" | "Learning";
  calibrationMultiplier: number;
  stakeMultiplier: number;
  calibrationConfidence: number;
  calibrationReasons: string[];
  confidence: number;
  odds: number;
  kelly: number;
  stake: number;
  rawStake: number;
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

export function buildRadarOpportunities(
  analyses: SavedAnalysis[],
  calibrationModel: CalibrationModel = buildCalibrationModel(analyses)
): RadarOpportunity[] {
  return analyses
    .map((analysis) => {
      const trackedEntries = getAnalysisTrackingEntries(analysis);
      const result = getTrackedOrBestResult(analysis);
      if (!result) return null;
      const league = analysis.league || "Unspecified";
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
        calibrationModel
      );

      return {
        id: analysis.id,
        match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
        homeTeam: analysis.homeTeam,
        awayTeam: analysis.awayTeam,
        league,
        market: result.market,
        edge: result.valueBet,
        modelProb: rawModelProb,
        calibratedProb: calibration.calibratedProb,
        calibrationLabel: calibration.label,
        calibrationMultiplier: calibration.multiplier,
        stakeMultiplier: calibration.stakeMultiplier,
        calibrationConfidence: calibration.confidence,
        calibrationReasons: calibration.reasons,
        confidence: result.confidence,
        odds: result.odds,
        kelly: result.kelly,
        stake: Number((result.stake * calibration.stakeMultiplier).toFixed(2)),
        rawStake: result.stake,
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
