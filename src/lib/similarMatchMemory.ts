import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";

export type SimilarMemoryTone = "positive" | "neutral" | "negative" | "learning";

export interface SimilarMatchExample {
  match: string;
  league: string;
  market: string;
  odds: number;
  modelProb: number;
  confidence: number;
  totalXg: number;
  outcome: "green" | "red";
  similarity: number;
}

export interface SimilarMatchMemory {
  samples: number;
  greens: number;
  reds: number;
  hitRate: number;
  expectedHitRate: number;
  calibrationGap: number;
  brierScore: number;
  avgSimilarity: number;
  verdict: "Validated" | "Caution" | "Unproven" | "No Real Sample";
  tone: SimilarMemoryTone;
  summary: string;
  examples: SimilarMatchExample[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals = 1) {
  return Number(value.toFixed(decimals));
}

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function proximityScore(distance: number, maxDistance: number, weight: number) {
  return clamp(1 - distance / maxDistance, 0, 1) * weight;
}

function getSimilarity({
  currentLeague,
  currentTotalXg,
  current,
  historical,
  historicalLeague,
  historicalTotalXg,
}: {
  currentLeague: string;
  currentTotalXg: number;
  current: AnalysisResult;
  historical: AnalysisResult;
  historicalLeague: string;
  historicalTotalXg: number;
}) {
  const leagueScore = normalize(currentLeague) === normalize(historicalLeague) ? 20 : 0;
  const oddsScore = proximityScore(Math.abs(current.odds - historical.odds), 1.1, 22);
  const probabilityScore = proximityScore(
    Math.abs((current.rawModelProb ?? current.modelProb) - (historical.rawModelProb ?? historical.modelProb)),
    24,
    24
  );
  const confidenceScore = proximityScore(
    Math.abs(current.confidence - historical.confidence),
    3.5,
    16
  );
  const xgScore = proximityScore(Math.abs(currentTotalXg - historicalTotalXg), 2.4, 18);

  return roundTo(leagueScore + oddsScore + probabilityScore + confidenceScore + xgScore, 0);
}

function emptyMemory(): SimilarMatchMemory {
  return {
    samples: 0,
    greens: 0,
    reds: 0,
    hitRate: 0,
    expectedHitRate: 0,
    calibrationGap: 0,
    brierScore: 0,
    avgSimilarity: 0,
    verdict: "No Real Sample",
    tone: "learning",
    summary: "No audited similar matches exist yet for this market profile.",
    examples: [],
  };
}

export function getSimilarMatchMemory({
  analyses,
  currentResult,
  currentLeague,
  currentTotalXg,
}: {
  analyses: SavedAnalysis[];
  currentResult: AnalysisResult;
  currentLeague: string;
  currentTotalXg: number;
}): SimilarMatchMemory {
  const currentMarket = normalize(currentResult.market);

  const candidates = analyses.flatMap((analysis) => {
    const audit = analysis.modelAudit;
    if (!audit) return [];

    return audit.outcomes.flatMap((outcome) => {
      if (outcome.outcome !== "green" && outcome.outcome !== "red") return [];
      if (normalize(outcome.market) !== currentMarket) return [];

      const sourceResult = analysis.results.find(
        (result) => normalize(result.market) === currentMarket
      );
      if (!sourceResult) return [];

      const similarity = getSimilarity({
        currentLeague,
        currentTotalXg,
        current: currentResult,
        historical: {
          ...sourceResult,
          odds: outcome.odds ?? sourceResult.odds,
          modelProb: outcome.modelProb,
        },
        historicalLeague: analysis.league || "Unspecified",
        historicalTotalXg: analysis.summary.totalXg,
      });

      if (similarity < 45) return [];

      return {
        match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
        league: analysis.league || "Unspecified",
        market: outcome.market,
        odds: outcome.odds ?? sourceResult.odds,
        modelProb: outcome.modelProb,
        confidence: outcome.confidence,
        totalXg: analysis.summary.totalXg,
        outcome: outcome.outcome,
        similarity,
      } satisfies SimilarMatchExample;
    });
  });

  const examples = candidates
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20);

  if (!examples.length) return emptyMemory();

  const greens = examples.filter((example) => example.outcome === "green").length;
  const reds = examples.filter((example) => example.outcome === "red").length;
  const samples = greens + reds;
  const hitRate = samples > 0 ? (greens / samples) * 100 : 0;
  const expectedHitRate =
    samples > 0
      ? examples.reduce((sum, example) => sum + example.modelProb, 0) / samples
      : 0;
  const brierScore =
    samples > 0
      ? examples.reduce((sum, example) => {
          const predicted = example.modelProb / 100;
          const actual = example.outcome === "green" ? 1 : 0;
          return sum + (predicted - actual) ** 2;
        }, 0) / samples
      : 0;
  const calibrationGap = hitRate - expectedHitRate;
  const avgSimilarity =
    samples > 0
      ? examples.reduce((sum, example) => sum + example.similarity, 0) / samples
      : 0;

  const verdict: SimilarMatchMemory["verdict"] =
    samples < 5
      ? "Unproven"
      : calibrationGap >= -5 && brierScore <= 0.24
      ? "Validated"
      : calibrationGap <= -10 || brierScore >= 0.3
      ? "Caution"
      : "Unproven";
  const tone: SimilarMemoryTone =
    verdict === "Validated"
      ? "positive"
      : verdict === "Caution"
      ? "negative"
      : "learning";

  return {
    samples,
    greens,
    reds,
    hitRate: roundTo(hitRate),
    expectedHitRate: roundTo(expectedHitRate),
    calibrationGap: roundTo(calibrationGap),
    brierScore: roundTo(brierScore, 3),
    avgSimilarity: roundTo(avgSimilarity, 0),
    verdict,
    tone,
    summary:
      samples < 5
        ? `Only ${samples} audited similar matches found. Treat this as learning, not proof.`
        : `${samples} audited similar matches: ${roundTo(hitRate)}% actual vs ${roundTo(expectedHitRate)}% expected.`,
    examples: examples.slice(0, 3),
  };
}
