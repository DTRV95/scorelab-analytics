import {
  getAnalyses,
  getBankrollSettings,
  getBankrollStats,
} from "@/lib/analysisStorage";
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

  return {
    meta: {
      app: "ScoreLab",
      exportedAt: new Date().toISOString(),
      formatVersion: 1,
    },
    bankrollSettings,
    bankrollStats,
    multipleSummary,
    counts: {
      analyses: analyses.length,
      savedMultiples: savedMultiples.length,
      draftLegs: multipleDraft.length,
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
