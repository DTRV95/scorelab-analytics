import { createContext } from "react";
import {
  getAllAnalysisTrackingEntries,
  getAnalyses,
  getBankrollSettings,
} from "@/lib/analysisStorage";
import {
  buildFinancialSnapshot,
  type FinancialSnapshot,
} from "@/lib/financialEngine";
import { buildRadarOpportunities, type RadarOpportunity } from "@/lib/valueRadar";
import { buildCalibrationModel, type CalibrationModel } from "@/lib/calibrationEngine";
import type { SavedAnalysis } from "@/types/analysis";

type AnalysisTrackingEntry = ReturnType<typeof getAllAnalysisTrackingEntries>[number];

export interface ScoreLabDataContextValue {
  analyses: SavedAnalysis[];
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
  const trackingEntries = getAllAnalysisTrackingEntries(analyses);
  const { initialBankroll } = getBankrollSettings();
  const financialSnapshot = buildFinancialSnapshot({
    analyses: trackingEntries.map((entry) => ({
      createdAt: entry.createdAt,
      tracking: entry.tracking,
    })),
    initialBankroll,
  });
  const calibrationModel = buildCalibrationModel(analyses);
  const radarOpportunities = buildRadarOpportunities(analyses, calibrationModel);

  return {
    analyses,
    trackingEntries,
    financialSnapshot,
    radarOpportunities,
    calibrationModel,
  };
}
