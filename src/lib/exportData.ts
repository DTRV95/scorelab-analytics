import {
  getAnalyses,
  getBankrollSettings,
  getBankrollStats,
} from "@/lib/analysisStorage";
import { buildCalibrationModel } from "@/lib/calibrationEngine";
import { buildLearningDataset, getLearningDatasetSummary } from "@/lib/learningDataset";
import { getModelAuditSummary } from "@/lib/modelAudit";
import {
  getMultipleDraft,
  getMultiplePerformanceSummary,
  getSavedMultiples,
} from "@/lib/multipleStorage";

function buildTimestamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(
    now.getHours()
  )}-${pad(now.getMinutes())}`;
}

export function buildScoreLabExport() {
  const analyses = getAnalyses();
  const savedMultiples = getSavedMultiples();
  const bankrollSettings = getBankrollSettings();
  const bankrollStats = getBankrollStats();
  const multipleDraft = getMultipleDraft();
  const multipleSummary = getMultiplePerformanceSummary();
  const modelAuditSummary = getModelAuditSummary(analyses);
  const learningDataset = buildLearningDataset(analyses);
  const learningSummary = getLearningDatasetSummary(analyses);
  const calibrationModel = buildCalibrationModel(analyses);

  return {
    meta: {
      app: "ScoreLab",
      exportedAt: new Date().toISOString(),
      formatVersion: 2,
      includes: [
        "bankroll",
        "analyses",
        "multiples",
        "modelAudit",
        "modelLab",
        "learningDataset",
        "calibrationModel",
      ],
    },
    bankrollSettings,
    bankrollStats,
    multipleSummary,
    counts: {
      analyses: analyses.length,
      savedMultiples: savedMultiples.length,
      draftLegs: multipleDraft.length,
      auditedMatches: modelAuditSummary.auditedMatches,
      auditedMarkets: modelAuditSummary.auditedMarkets,
      learningRows: learningDataset.length,
      calibrationSegments: calibrationModel.segments.length,
    },
    modelLab: {
      modelAuditSummary,
      learningSummary,
      learningDataset,
      calibrationModel: {
        segments: calibrationModel.segments,
        insights: calibrationModel.insights,
      },
      handoffNotes: {
        purpose:
          "Use this section to recalibrate ScoreLab from audited final-score outcomes, model probability gaps, Brier score, league/market behavior, odds bands, confidence buckets, edge buckets, and learned calibration segments.",
        preferredUpdateFlow:
          "Send this full JSON export back to Codex so the model can be reviewed against real audited outcomes before changing probability rules.",
      },
    },
    analyses,
    savedMultiples,
    multipleDraft,
  };
}

export function downloadScoreLabExport() {
  const payload = buildScoreLabExport();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `scorelab-export_${buildTimestamp()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
