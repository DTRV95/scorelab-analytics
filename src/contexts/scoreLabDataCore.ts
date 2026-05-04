import { createContext } from "react";
import {
  getAllAnalysisTrackingEntries,
  getAnalyses,
  getBankrollSettings,
} from "@/lib/analysisStorage";
import { getSavedMultiples } from "@/lib/multipleStorage";
import {
  buildFinancialSnapshot,
  type FinancialSnapshot,
} from "@/lib/financialEngine";
import { buildRadarOpportunities, type RadarOpportunity } from "@/lib/valueRadar";
import { buildCalibrationModel, type CalibrationModel } from "@/lib/calibrationEngine";
import type { SavedAnalysis } from "@/types/analysis";

type MultipleBet = ReturnType<typeof getSavedMultiples>[number];
type AnalysisTrackingEntry = ReturnType<typeof getAllAnalysisTrackingEntries>[number];

export interface ScoreLabDataContextValue {
  analyses: SavedAnalysis[];
  multiples: MultipleBet[];
  trackingEntries: AnalysisTrackingEntry[];
  financialSnapshot: FinancialSnapshot;
  radarOpportunities: RadarOpportunity[];
  calibrationModel: CalibrationModel;
  dataVersion: number;
  refresh: () => void;
}

export const ScoreLabDataContext =
  createContext<ScoreLabDataContextValue | null>(null);

export function loadCoreScoreLabData() {
  const analyses = getAnalyses();
  const multiples = getSavedMultiples();
  const trackingEntries = getAllAnalysisTrackingEntries(analyses);
  const { initialBankroll } = getBankrollSettings();
  const financialSnapshot = buildFinancialSnapshot({
    analyses: trackingEntries.map((entry) => ({
      createdAt: entry.createdAt,
      tracking: entry.tracking,
    })),
    multiples: multiples.map((multiple) => ({
      createdAt: multiple.createdAt,
      tracking: multiple.tracking,
      combinedOdds: multiple.combinedOdds,
    })),
    initialBankroll,
  });
  const calibrationModel = buildCalibrationModel(analyses);
  const radarOpportunities = buildRadarOpportunities(analyses, calibrationModel);

  return {
    analyses,
    multiples,
    trackingEntries,
    financialSnapshot,
    radarOpportunities,
    calibrationModel,
  };
}
