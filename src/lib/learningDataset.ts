import type { BetTier, DecisionType, ModelAuditMarketResult, SavedAnalysis } from "@/types/analysis";

export interface LearningDatasetRow {
  id: string;
  analysisId: string;
  match: string;
  league: string;
  market: string;
  marketFamily: string;
  odds: number;
  oddsBucket: string;
  modelProb: number;
  impliedProb: number;
  edge: number;
  confidence: number;
  probabilityBucket: string;
  confidenceBucket: string;
  edgeBucket: string;
  decision: DecisionType;
  tier: BetTier | "unknown";
  homeXg: number;
  awayXg: number;
  totalXg: number;
  xgDiff: number;
  finalHomeGoals: number;
  finalAwayGoals: number;
  finalTotalGoals: number;
  target: 0 | 1;
  outcome: "green" | "red";
  createdAt: string;
  auditedAt: string;
}

export interface LearningSegmentRead {
  label: string;
  samples: number;
  greens: number;
  hitRate: number;
  avgModelProb: number;
  calibrationGap: number;
  brierScore: number;
}

export interface LearningReadiness {
  rows: number;
  markets: number;
  leagues: number;
  readinessScore: number;
  level: "Not Ready" | "Learning" | "Usable" | "Strong";
  recommendation: string;
}

export interface LearningDatasetSummary {
  readiness: LearningReadiness;
  marketReads: LearningSegmentRead[];
  leagueReads: LearningSegmentRead[];
  oddsReads: LearningSegmentRead[];
  confidenceReads: LearningSegmentRead[];
  edgeReads: LearningSegmentRead[];
}

function roundTo(value: number, decimals = 1) {
  return Number(value.toFixed(decimals));
}

function normalize(value: string | null | undefined) {
  return (value || "Unspecified").trim();
}

function getMarketFamily(market: string) {
  const normalized = market.toLowerCase();
  if (normalized.includes("btts")) return "BTTS";
  if (normalized.includes("over") || normalized.includes("under")) return "Goals";
  if (normalized.includes("1x") || normalized.includes("2x")) return "Double Chance";
  if (normalized.includes("home") || normalized.includes("draw") || normalized.includes("away")) {
    return "1X2";
  }
  return "Other";
}

function getOddsBucket(odds: number): string {
  if (!Number.isFinite(odds) || odds <= 0) return "unknown";
  if (odds < 1.5) return "<1.50";
  if (odds < 1.8) return "1.50-1.79";
  if (odds < 2.2) return "1.80-2.19";
  if (odds < 3) return "2.20-2.99";
  return "3.00+";
}

function getProbabilityBucket(probability: number): string {
  if (probability < 45) return "<45%";
  if (probability < 55) return "45-54%";
  if (probability < 65) return "55-64%";
  if (probability < 75) return "65-74%";
  if (probability < 85) return "75-84%";
  return "85%+";
}

function getConfidenceBucket(confidence: number): string {
  if (confidence < 5) return "<5";
  if (confidence < 6) return "5-5.9";
  if (confidence < 7) return "6-6.9";
  if (confidence < 8) return "7-7.9";
  return "8+";
}

function getEdgeBucket(edge: number): string {
  if (edge < 0) return "<0%";
  if (edge < 3) return "0-2.9%";
  if (edge < 7) return "3-6.9%";
  if (edge < 12) return "7-11.9%";
  return "12%+";
}

function isScoredOutcome(
  outcome: ModelAuditMarketResult
): outcome is ModelAuditMarketResult & { outcome: "green" | "red" } {
  return outcome.outcome === "green" || outcome.outcome === "red";
}

export function buildLearningDataset(analyses: SavedAnalysis[]): LearningDatasetRow[] {
  return analyses.flatMap((analysis) => {
    const audit = analysis.modelAudit;
    if (!audit) return [];

    return audit.outcomes.filter(isScoredOutcome).map((outcome) => {
      const sourceResult = analysis.results.find((result) => result.market === outcome.market);
      const odds = outcome.odds ?? sourceResult?.odds ?? 0;
      const modelProb = outcome.modelProb;
      const edge = outcome.valueBet;
      const confidence = outcome.confidence;

      return {
        id: `${analysis.id}::${outcome.market}`,
        analysisId: analysis.id,
        match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
        league: normalize(analysis.league),
        market: outcome.market,
        marketFamily: getMarketFamily(outcome.market),
        odds,
        oddsBucket: getOddsBucket(odds),
        modelProb,
        impliedProb: outcome.impliedProb,
        edge,
        confidence,
        probabilityBucket: getProbabilityBucket(modelProb),
        confidenceBucket: getConfidenceBucket(confidence),
        edgeBucket: getEdgeBucket(edge),
        decision: outcome.decision,
        tier: outcome.tier ?? sourceResult?.tier ?? "unknown",
        homeXg: analysis.summary.homeXg,
        awayXg: analysis.summary.awayXg,
        totalXg: analysis.summary.totalXg,
        xgDiff: analysis.summary.homeXg - analysis.summary.awayXg,
        finalHomeGoals: audit.homeGoals,
        finalAwayGoals: audit.awayGoals,
        finalTotalGoals: audit.homeGoals + audit.awayGoals,
        target: outcome.outcome === "green" ? 1 : 0,
        outcome: outcome.outcome,
        createdAt: analysis.createdAt,
        auditedAt: audit.auditedAt,
      } satisfies LearningDatasetRow;
    });
  });
}

function buildSegmentRead(
  rows: LearningDatasetRow[],
  label: string,
  getSegment: (row: LearningDatasetRow) => string
): LearningSegmentRead[] {
  const segments = new Map<string, LearningDatasetRow[]>();

  rows.forEach((row) => {
    const segment = getSegment(row);
    segments.set(segment, [...(segments.get(segment) ?? []), row]);
  });

  return Array.from(segments.entries())
    .map(([segment, items]) => {
      const greens = items.filter((item) => item.target === 1).length;
      const hitRate = items.length > 0 ? (greens / items.length) * 100 : 0;
      const avgModelProb =
        items.reduce((sum, item) => sum + item.modelProb, 0) / Math.max(items.length, 1);
      const brierScore =
        items.reduce((sum, item) => {
          const predicted = item.modelProb / 100;
          return sum + (predicted - item.target) ** 2;
        }, 0) / Math.max(items.length, 1);

      return {
        label: `${label}: ${segment}`,
        samples: items.length,
        greens,
        hitRate: roundTo(hitRate),
        avgModelProb: roundTo(avgModelProb),
        calibrationGap: roundTo(hitRate - avgModelProb),
        brierScore: roundTo(brierScore, 3),
      };
    })
    .sort((a, b) => b.samples - a.samples || a.brierScore - b.brierScore);
}

function getReadiness(rows: LearningDatasetRow[]): LearningReadiness {
  const markets = new Set(rows.map((row) => row.market)).size;
  const leagues = new Set(rows.map((row) => row.league)).size;
  const sampleScore = Math.min(rows.length / 500, 1) * 60;
  const marketScore = Math.min(markets / 12, 1) * 20;
  const leagueScore = Math.min(leagues / 8, 1) * 20;
  const readinessScore = roundTo(sampleScore + marketScore + leagueScore, 0);
  const level: LearningReadiness["level"] =
    readinessScore >= 78 ? "Strong" : readinessScore >= 55 ? "Usable" : readinessScore >= 25 ? "Learning" : "Not Ready";
  const recommendation =
    level === "Strong"
      ? "Dataset is strong enough to let ML influence final probabilities with guardrails."
      : level === "Usable"
      ? "Dataset can support a lightweight ML read, but keep the mathematical model as the anchor."
      : level === "Learning"
      ? "Keep collecting final-score audits before allowing ML to move final probabilities."
      : "Not enough audited outcomes yet for machine learning.";

  return {
    rows: rows.length,
    markets,
    leagues,
    readinessScore,
    level,
    recommendation,
  };
}

export function getLearningDatasetSummary(analyses: SavedAnalysis[]): LearningDatasetSummary {
  const rows = buildLearningDataset(analyses);

  return {
    readiness: getReadiness(rows),
    marketReads: buildSegmentRead(rows, "Market", (row) => row.market),
    leagueReads: buildSegmentRead(rows, "League", (row) => row.league),
    oddsReads: buildSegmentRead(rows, "Odds", (row) => row.oddsBucket),
    confidenceReads: buildSegmentRead(rows, "Confidence", (row) => row.confidenceBucket),
    edgeReads: buildSegmentRead(rows, "Edge", (row) => row.edgeBucket),
  };
}
