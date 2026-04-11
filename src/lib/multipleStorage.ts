import { getAnalyses, getBankrollStats } from "@/lib/analysisStorage";
type AnalysisResult = import("../types/analysis").AnalysisResult;
type BetStatus = import("../types/analysis").BetStatus;
type SavedAnalysis = import("../types/analysis").SavedAnalysis;

type MultipleRiskLevel = "Low" | "Medium" | "High";
type MultipleTier = "discard" | "watchlist" | "bet" | "elite" | "premium";

interface MultipleLeg {
  analysisId: string;
  homeTeam: string;
  awayTeam: string;
  match: string;
  market: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  valueBet: number;
  confidence: number;
  risk: MultipleRiskLevel;
  tier: MultipleTier;
}

interface MultipleTracking {
  betPlaced: boolean;
  stakeUsed: number | null;
  oddUsed: number | null;
  resultStatus: BetStatus;
  profitLoss: number;
  bankrollBefore: number | null;
  bankrollAfter: number | null;
  notes: string;
}

interface MultipleBet {
  id: string;
  createdAt: string;
  legs: MultipleLeg[];
  combinedOdds: number;
  combinedModelProb: number;
  combinedImpliedProb: number;
  combinedEdge: number;
  adjustedConfidence: number;
  correlationScore: number;
  correlationLevel: "Low" | "Medium" | "High";
  correlationReasons: string[];
  recommendedStakePct: number;
  recommendedStakeAmount: number;
  tracking: MultipleTracking;
}

const MULTIPLE_DRAFT_KEY = "scorelab_multiple_draft";
const MULTIPLES_KEY = "scorelab_multiples";
export const MULTIPLES_UPDATED_EVENT = "scorelab:multiples-updated";

export interface MultipleMetrics {
  combinedOdds: number;
  combinedModelProb: number;
  combinedImpliedProb: number;
  combinedEdge: number;
  adjustedConfidence: number;
  correlationScore: number;
  correlationLevel: "Low" | "Medium" | "High";
  correlationReasons: string[];
  recommendedStakePct: number;
  recommendedStakeAmount: number;
}

export interface MultiplePerformanceSummary {
  totalMultiples: number;
  placedMultiples: number;
  settledMultiples: number;
  greens: number;
  reds: number;
  voids: number;
  profitLoss: number;
  totalStake: number;
  roi: number;
  hitRate: number;
}

export interface MultipleSegmentPerformance {
  [key: string]: string | number;
  bucket: string;
  bets: number;
  greens: number;
  reds: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  hitRate: number;
}

function emitMultiplesUpdated() {
  window.dispatchEvent(new CustomEvent(MULTIPLES_UPDATED_EVENT));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeMarketName(market: string): string {
  const normalized = market.trim().toLowerCase();

  if (normalized === "ambas marcam") return "BTTS Yes";
  if (
    normalized === "ambas não marcam" ||
    normalized === "ambas nao marcam" ||
    normalized === "ambas nã£o marcam" ||
    normalized === "bttsn"
  ) {
    return "BTTS No";
  }

  return market;
}

function getMarketGroup(market: string) {
  const normalized = normalizeMarketName(market).toLowerCase();

  if (normalized.includes("btts")) return "btts";
  if (normalized.includes("over")) return "totals-over";
  if (normalized.includes("under")) return "totals-under";
  if (["home", "draw", "away"].includes(normalized)) return "1x2";
  return "other";
}

function getPairCorrelationScore(a: MultipleLeg, b: MultipleLeg) {
  if (a.analysisId !== b.analysisId) return { score: 0, reason: null as string | null };

  const groupA = getMarketGroup(a.market);
  const groupB = getMarketGroup(b.market);

  if (groupA === groupB) {
    return {
      score: 2,
      reason: `${a.match} has two selections from the same market family.`,
    };
  }

  if (
    (groupA === "btts" && groupB.startsWith("totals")) ||
    (groupB === "btts" && groupA.startsWith("totals"))
  ) {
    return {
      score: 3,
      reason: `${a.match} mixes BTTS and totals, which is strongly correlated.`,
    };
  }

  if (
    (groupA === "1x2" && groupB.startsWith("totals")) ||
    (groupB === "1x2" && groupA.startsWith("totals")) ||
    (groupA === "1x2" && groupB === "btts") ||
    (groupB === "1x2" && groupA === "btts")
  ) {
    return {
      score: 2,
      reason: `${a.match} combines result and scoring markets in the same game.`,
    };
  }

  return {
    score: 1,
    reason: `${a.match} contains multiple selections from the same game.`,
  };
}

export function getMultipleMetrics(
  legs: MultipleLeg[],
  bankroll = getBankrollStats().currentBankroll
): MultipleMetrics {
  if (!legs.length) {
    return {
      combinedOdds: 0,
      combinedModelProb: 0,
      combinedImpliedProb: 0,
      combinedEdge: 0,
      adjustedConfidence: 0,
      correlationScore: 0,
      correlationLevel: "Low",
      correlationReasons: [],
      recommendedStakePct: 0,
      recommendedStakeAmount: 0,
    };
  }

  const combinedOdds = legs.reduce((product, leg) => product * leg.odds, 1);
  const independentModelProb =
    legs.reduce((product, leg) => product * (leg.modelProb / 100), 1) * 100;
  const combinedImpliedProb =
    legs.reduce((product, leg) => product * (leg.impliedProb / 100), 1) * 100;

  let correlationScore = 0;
  const reasons = new Set<string>();

  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      const pair = getPairCorrelationScore(legs[i], legs[j]);
      correlationScore += pair.score;
      if (pair.reason) reasons.add(pair.reason);
    }
  }

  const penaltyPct = clamp(correlationScore * 0.06, 0, 0.3);
  const combinedModelProb = independentModelProb * (1 - penaltyPct);
  const combinedEdge = combinedModelProb - combinedImpliedProb;
  const averageConfidence =
    legs.reduce((sum, leg) => sum + leg.confidence, 0) / legs.length;
  const adjustedConfidence = clamp(
    Number((averageConfidence - correlationScore * 0.35 - Math.max(0, legs.length - 2) * 0.25).toFixed(1)),
    1,
    10
  );

  const baseStakePct =
    legs.length <= 2 ? 0.6 : legs.length === 3 ? 0.45 : 0.3;
  const correlationStakePenalty = clamp(correlationScore * 0.08, 0, 0.35);
  const recommendedStakePct = clamp(
    Number((baseStakePct * (1 - correlationStakePenalty)).toFixed(2)),
    0,
    0.75
  );

  let correlationLevel: "Low" | "Medium" | "High" = "Low";
  if (correlationScore >= 3) correlationLevel = "High";
  else if (correlationScore >= 1) correlationLevel = "Medium";

  return {
    combinedOdds: Number(combinedOdds.toFixed(2)),
    combinedModelProb: Number(combinedModelProb.toFixed(2)),
    combinedImpliedProb: Number(combinedImpliedProb.toFixed(2)),
    combinedEdge: Number(combinedEdge.toFixed(2)),
    adjustedConfidence,
    correlationScore,
    correlationLevel,
    correlationReasons: Array.from(reasons),
    recommendedStakePct,
    recommendedStakeAmount: Number(
      ((bankroll * recommendedStakePct) / 100).toFixed(2)
    ),
  };
}

export function createMultipleLeg(
  analysis: SavedAnalysis,
  result: AnalysisResult
): MultipleLeg {
  return {
    analysisId: analysis.id,
    homeTeam: analysis.homeTeam,
    awayTeam: analysis.awayTeam,
    match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
    market: normalizeMarketName(result.market),
    odds: Number(result.odds.toFixed(2)),
    modelProb: Number(result.modelProb.toFixed(2)),
    impliedProb: Number(result.impliedProb.toFixed(2)),
    valueBet: Number(result.valueBet.toFixed(2)),
    confidence: Number(result.confidence.toFixed(1)),
    risk: result.risk,
    tier: result.tier || "discard",
  };
}

function normalizeMultipleLeg(leg: MultipleLeg): MultipleLeg {
  return { ...leg, market: normalizeMarketName(leg.market) };
}

function normalizeMultipleBet(bet: MultipleBet): MultipleBet {
  return {
    ...bet,
    legs: bet.legs.map(normalizeMultipleLeg),
  };
}

export function getMultipleDraft(): MultipleLeg[] {
  try {
    const raw = localStorage.getItem(MULTIPLE_DRAFT_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as MultipleLeg[]).map(normalizeMultipleLeg);
  } catch {
    return [];
  }
}

function saveMultipleDraft(legs: MultipleLeg[]) {
  localStorage.setItem(
    MULTIPLE_DRAFT_KEY,
    JSON.stringify(legs.map(normalizeMultipleLeg))
  );
  emitMultiplesUpdated();
}

export function addLegToMultipleDraft(leg: MultipleLeg) {
  const draft = getMultipleDraft();
  const normalizedLeg = normalizeMultipleLeg(leg);
  const exists = draft.some(
    (item) =>
      item.analysisId === normalizedLeg.analysisId &&
      item.market === normalizedLeg.market
  );

  if (exists) return draft;

  const updated = [...draft, normalizedLeg];
  saveMultipleDraft(updated);
  return updated;
}

export function removeLegFromMultipleDraft(analysisId: string, market: string) {
  const updated = getMultipleDraft().filter(
    (item) => !(item.analysisId === analysisId && item.market === market)
  );
  saveMultipleDraft(updated);
  return updated;
}

export function clearMultipleDraft() {
  saveMultipleDraft([]);
}

export function getSavedMultiples(): MultipleBet[] {
  try {
    const raw = localStorage.getItem(MULTIPLES_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as MultipleBet[]).map(normalizeMultipleBet);
  } catch {
    return [];
  }
}

function saveMultiples(bets: MultipleBet[]) {
  localStorage.setItem(
    MULTIPLES_KEY,
    JSON.stringify(bets.map(normalizeMultipleBet))
  );
  emitMultiplesUpdated();
}

export function createEmptyMultipleTracking(): MultipleBet["tracking"] {
  return {
    betPlaced: false,
    stakeUsed: null,
    oddUsed: null,
    resultStatus: "pending",
    profitLoss: 0,
    bankrollBefore: null,
    bankrollAfter: null,
    notes: "",
  };
}

function recalculateMultipleTracking(
  tracking: MultipleBet["tracking"]
): MultipleBet["tracking"] {
  if (!tracking.betPlaced) {
    return {
      ...tracking,
      stakeUsed: null,
      oddUsed: null,
      resultStatus: "pending",
      profitLoss: 0,
      bankrollAfter: tracking.bankrollBefore,
    };
  }

  const stake = tracking.stakeUsed ?? 0;
  const odd = tracking.oddUsed ?? 0;
  const bankrollBefore = tracking.bankrollBefore ?? null;

  let profitLoss = 0;
  if (tracking.resultStatus === "green") profitLoss = stake * (odd - 1);
  if (tracking.resultStatus === "red") profitLoss = -stake;
  if (tracking.resultStatus === "void") profitLoss = 0;

  return {
    ...tracking,
    profitLoss,
    bankrollAfter:
      bankrollBefore !== null ? bankrollBefore + profitLoss : bankrollBefore,
  };
}

export function saveMultipleFromDraft(
  stakeUsed?: number | null
): MultipleBet | null {
  const legs = getMultipleDraft();
  if (legs.length < 2) return null;

  const bankroll = getBankrollStats().currentBankroll;
  const metrics = getMultipleMetrics(legs, bankroll);
  const normalizedStake =
    typeof stakeUsed === "number" && Number.isFinite(stakeUsed) && stakeUsed > 0
      ? Number(stakeUsed.toFixed(2))
      : null;

  const newMultiple: MultipleBet = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: new Date().toISOString(),
    legs,
    combinedOdds: metrics.combinedOdds,
    combinedModelProb: metrics.combinedModelProb,
    combinedImpliedProb: metrics.combinedImpliedProb,
    combinedEdge: metrics.combinedEdge,
    adjustedConfidence: metrics.adjustedConfidence,
    correlationScore: metrics.correlationScore,
    correlationLevel: metrics.correlationLevel,
    correlationReasons: metrics.correlationReasons,
    recommendedStakePct: metrics.recommendedStakePct,
    recommendedStakeAmount: metrics.recommendedStakeAmount,
    tracking: {
      ...createEmptyMultipleTracking(),
      betPlaced: normalizedStake !== null,
      stakeUsed: normalizedStake,
      oddUsed:
        normalizedStake !== null
          ? Number(metrics.combinedOdds.toFixed(2))
          : null,
      bankrollBefore: bankroll,
      bankrollAfter: bankroll,
    },
  };

  const updated = [newMultiple, ...getSavedMultiples()];
  saveMultiples(updated);
  clearMultipleDraft();
  return newMultiple;
}

export function updateMultipleTracking(
  multipleId: string,
  updates: Partial<MultipleBet["tracking"]>
) {
  const updated = getSavedMultiples().map((bet) => {
    if (bet.id !== multipleId) return bet;
    return {
      ...bet,
      tracking: recalculateMultipleTracking({
        ...bet.tracking,
        ...updates,
      }),
    };
  });

  saveMultiples(updated);
  return updated;
}

export function deleteMultipleBet(multipleId: string) {
  const updated = getSavedMultiples().filter((bet) => bet.id !== multipleId);
  saveMultiples(updated);
  return updated;
}

function buildPerformanceRow(items: MultipleBet[]) {
  const greens = items.filter((item) => item.tracking.resultStatus === "green").length;
  const reds = items.filter((item) => item.tracking.resultStatus === "red").length;
  const voids = items.filter((item) => item.tracking.resultStatus === "void").length;
  const totalStake = items.reduce((sum, item) => sum + (item.tracking.stakeUsed || 0), 0);
  const profitLoss = items.reduce((sum, item) => sum + item.tracking.profitLoss, 0);
  const settled = greens + reds;

  return {
    bets: items.length,
    greens,
    reds,
    voids,
    totalStake: Number(totalStake.toFixed(2)),
    profitLoss: Number(profitLoss.toFixed(2)),
    roi: totalStake > 0 ? Number(((profitLoss / totalStake) * 100).toFixed(2)) : 0,
    hitRate: settled > 0 ? Number(((greens / settled) * 100).toFixed(2)) : 0,
  };
}

function getSettledMultiples() {
  return getSavedMultiples().filter(
    (bet) =>
      bet.tracking.betPlaced &&
      (bet.tracking.resultStatus === "green" ||
        bet.tracking.resultStatus === "red" ||
        bet.tracking.resultStatus === "void")
  );
}

export function getMultiplePerformanceSummary(): MultiplePerformanceSummary {
  const multiples = getSavedMultiples();
  const placed = multiples.filter((bet) => bet.tracking.betPlaced);
  const settled = getSettledMultiples();
  const base = buildPerformanceRow(settled);

  return {
    totalMultiples: multiples.length,
    placedMultiples: placed.length,
    settledMultiples: settled.length,
    greens: base.greens,
    reds: base.reds,
    voids: base.voids,
    profitLoss: base.profitLoss,
    totalStake: base.totalStake,
    roi: base.roi,
    hitRate: base.hitRate,
  };
}

export function getBetTypePerformance(): Array<{
  type: "Singles" | "Multiples";
  bets: number;
  greens: number;
  reds: number;
  voids: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  hitRate: number;
}> {
  const analyses = getAnalyses().filter(
    (analysis) =>
      analysis.tracking.betPlaced &&
      (analysis.tracking.resultStatus === "green" ||
        analysis.tracking.resultStatus === "red" ||
        analysis.tracking.resultStatus === "void")
  );

  const singleGreens = analyses.filter((item) => item.tracking.resultStatus === "green").length;
  const singleReds = analyses.filter((item) => item.tracking.resultStatus === "red").length;
  const singleVoids = analyses.filter((item) => item.tracking.resultStatus === "void").length;
  const singleStake = analyses.reduce((sum, item) => sum + (item.tracking.stakeUsed || 0), 0);
  const singleProfitLoss = analyses.reduce((sum, item) => sum + item.tracking.profitLoss, 0);
  const singleSettled = singleGreens + singleReds;

  const multipleSummary = getMultiplePerformanceSummary();

  return [
    {
      type: "Singles",
      bets: analyses.length,
      greens: singleGreens,
      reds: singleReds,
      voids: singleVoids,
      totalStake: Number(singleStake.toFixed(2)),
      profitLoss: Number(singleProfitLoss.toFixed(2)),
      roi: singleStake > 0 ? Number(((singleProfitLoss / singleStake) * 100).toFixed(2)) : 0,
      hitRate: singleSettled > 0 ? Number(((singleGreens / singleSettled) * 100).toFixed(2)) : 0,
    },
    {
      type: "Multiples",
      bets: multipleSummary.settledMultiples,
      greens: multipleSummary.greens,
      reds: multipleSummary.reds,
      voids: multipleSummary.voids,
      totalStake: multipleSummary.totalStake,
      profitLoss: multipleSummary.profitLoss,
      roi: multipleSummary.roi,
      hitRate: multipleSummary.hitRate,
    },
  ];
}

export function getMultipleLegCountPerformance(): MultipleSegmentPerformance[] {
  const buckets = new Map<string, MultipleBet[]>();

  getSettledMultiples().forEach((bet) => {
    const bucket = `${bet.legs.length} legs`;
    const current = buckets.get(bucket) || [];
    current.push(bet);
    buckets.set(bucket, current);
  });

  return Array.from(buckets.entries())
    .map(([bucket, items]) => ({
      bucket,
      ...buildPerformanceRow(items),
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

export function getMultipleCorrelationPerformance(): MultipleSegmentPerformance[] {
  const buckets = new Map<string, MultipleBet[]>();

  getSettledMultiples().forEach((bet) => {
    const bucket = bet.correlationLevel;
    const current = buckets.get(bucket) || [];
    current.push(bet);
    buckets.set(bucket, current);
  });

  const order = ["Low", "Medium", "High"];

  return Array.from(buckets.entries())
    .map(([bucket, items]) => ({
      bucket,
      ...buildPerformanceRow(items),
    }))
    .sort((a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket));
}

export function getTierWeight(tier: MultipleTier) {
  if (tier === "premium") return 5;
  if (tier === "elite") return 4;
  if (tier === "bet") return 3;
  if (tier === "watchlist") return 2;
  return 1;
}
