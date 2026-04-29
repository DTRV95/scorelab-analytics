import {
  getAllAnalysisTrackingEntries,
  getAnalyses,
  getBankrollStats,
} from "@/lib/analysisStorage";
import {
  deleteMultipleRecord,
  persistMultipleRecord,
  queueEntitySync,
} from "@/lib/persistenceSync";
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
  resultStatus: BetStatus;
}

interface MultipleTracking {
  betPlaced: boolean;
  stakeUsed: number | null;
  oddUsed: number | null;
  resultStatus: BetStatus;
  settledAt?: string | null;
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

export interface MultipleMarketPerformanceItem {
  market: string;
  marketGroup: string;
  bets: number;
  greens: number;
  reds: number;
  voids: number;
  pending: number;
  hitRate: number;
  avgOdds: number;
  avgConfidence: number;
  avgEdge: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
}

interface MultipleMarketPerformanceOptions {
  excludeDuplicateSingles?: boolean;
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

function getMarketGroupLabel(market: string) {
  const group = getMarketGroup(market);

  if (group === "btts") return "BTTS";
  if (group === "totals-over") return "Over";
  if (group === "totals-under") return "Under";
  if (group === "1x2") return "1X2";
  return "Other";
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
    resultStatus: "pending",
  };
}

function normalizeMultipleLeg(leg: MultipleLeg): MultipleLeg {
  return {
    ...leg,
    market: normalizeMarketName(leg.market),
    resultStatus: leg.resultStatus || "pending",
  };
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
  queueEntitySync("multiple_draft");
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
    const normalized = (JSON.parse(raw) as MultipleBet[]).map(normalizeMultipleBet);
    const derived = normalized.map((bet) => ({
      ...bet,
      tracking: deriveMultipleTrackingFromLegs(bet, bet.tracking),
    }));

    if (JSON.stringify(normalized) !== JSON.stringify(derived)) {
      localStorage.setItem(MULTIPLES_KEY, JSON.stringify(derived.map(normalizeMultipleBet)));
      derived.forEach((bet) => {
        persistMultipleRecord(bet as unknown as Record<string, unknown> & { id: string });
      });
      queueEntitySync("multiples");
    }

    return derived;
  } catch {
    return [];
  }
}

function saveMultiples(bets: MultipleBet[]) {
  const previousIds = new Set(getSavedMultiples().map((bet) => bet.id));
  const nextIds = new Set(bets.map((bet) => bet.id));
  localStorage.setItem(
    MULTIPLES_KEY,
    JSON.stringify(bets.map(normalizeMultipleBet))
  );
  bets.forEach((bet) => {
    persistMultipleRecord(bet as unknown as Record<string, unknown> & { id: string });
  });
  previousIds.forEach((id) => {
    if (!nextIds.has(id)) {
      deleteMultipleRecord(id);
    }
  });
  queueEntitySync("multiples");
  emitMultiplesUpdated();
}

export function createEmptyMultipleTracking(): MultipleBet["tracking"] {
  return {
    betPlaced: false,
    stakeUsed: null,
    oddUsed: null,
    resultStatus: "pending",
    settledAt: null,
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
      settledAt: null,
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
  const settledAt =
    tracking.resultStatus === "pending"
      ? null
      : tracking.settledAt && typeof tracking.settledAt === "string"
      ? tracking.settledAt
      : new Date().toISOString();

  return {
    ...tracking,
    settledAt,
    profitLoss,
    bankrollAfter:
      bankrollBefore !== null ? bankrollBefore + profitLoss : bankrollBefore,
  };
}

function deriveMultipleTrackingFromLegs(
  bet: MultipleBet,
  tracking: MultipleBet["tracking"]
): MultipleBet["tracking"] {
  if (!tracking.betPlaced) {
    return recalculateMultipleTracking({
      ...tracking,
      resultStatus: "pending",
      oddUsed: null,
    });
  }

  const legStatuses = bet.legs.map((leg) => leg.resultStatus || "pending");
  const hasRed = legStatuses.some((status) => status === "red");
  const hasPending = legStatuses.some((status) => status === "pending");
  const allVoid = legStatuses.every((status) => status === "void");
  const allResolvedWithoutRed = legStatuses.every(
    (status) => status === "green" || status === "void"
  );

  let resultStatus: BetStatus = "pending";
  let oddUsed = tracking.oddUsed ?? Number(bet.combinedOdds.toFixed(2));

  if (hasRed) {
    resultStatus = "red";
  } else if (allVoid) {
    resultStatus = "void";
    oddUsed = 1;
  } else if (!hasPending && allResolvedWithoutRed) {
    resultStatus = "green";
    oddUsed = Number(
      bet.legs
        .filter((leg) => leg.resultStatus !== "void")
        .reduce((product, leg) => product * leg.odds, 1)
        .toFixed(2)
    );
  }

  return recalculateMultipleTracking({
    ...tracking,
    resultStatus,
    oddUsed,
  });
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

  const derivedMultiple = {
    ...newMultiple,
    tracking: deriveMultipleTrackingFromLegs(newMultiple, newMultiple.tracking),
  };
  const updated = [derivedMultiple, ...getSavedMultiples()];
  saveMultiples(updated);
  clearMultipleDraft();
  return derivedMultiple;
}

export function updateMultipleTracking(
  multipleId: string,
  updates: Partial<MultipleBet["tracking"]>
) {
  const updated = getSavedMultiples().map((bet) => {
    if (bet.id !== multipleId) return bet;
    return {
      ...bet,
      tracking: deriveMultipleTrackingFromLegs(bet, {
        ...bet.tracking,
        ...updates,
      }),
    };
  });

  saveMultiples(updated);
  return updated;
}

export function updateMultipleLegStatus(
  multipleId: string,
  analysisId: string,
  market: string,
  resultStatus: BetStatus
) {
  const updated = getSavedMultiples().map((bet) => {
    if (bet.id !== multipleId) return bet;

    const nextBet = {
      ...bet,
      legs: bet.legs.map((leg) =>
        leg.analysisId === analysisId && normalizeMarketName(leg.market) === normalizeMarketName(market)
          ? { ...leg, resultStatus }
          : leg
      ),
    };

    return {
      ...nextBet,
      tracking: deriveMultipleTrackingFromLegs(nextBet, nextBet.tracking),
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
  const singles = getAllAnalysisTrackingEntries().filter(
    (entry) =>
      entry.tracking.betPlaced &&
      (entry.tracking.resultStatus === "green" ||
        entry.tracking.resultStatus === "red" ||
        entry.tracking.resultStatus === "void")
  );

  const singleGreens = singles.filter((item) => item.tracking.resultStatus === "green").length;
  const singleReds = singles.filter((item) => item.tracking.resultStatus === "red").length;
  const singleVoids = singles.filter((item) => item.tracking.resultStatus === "void").length;
  const singleStake = singles.reduce((sum, item) => sum + (item.tracking.stakeUsed || 0), 0);
  const singleProfitLoss = singles.reduce((sum, item) => sum + item.tracking.profitLoss, 0);
  const singleSettled = singleGreens + singleReds;

  const multipleSummary = getMultiplePerformanceSummary();

  return [
    {
      type: "Singles",
      bets: singles.length,
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

export function getMultipleMarketPerformance(
  options: MultipleMarketPerformanceOptions = {}
): MultipleMarketPerformanceItem[] {
  const duplicateSingleKeys = options.excludeDuplicateSingles
    ? new Set(
        getAllAnalysisTrackingEntries()
          .filter(
            (entry) =>
              entry.tracking.betPlaced && entry.tracking.selectedMarket
          )
          .map(
            (entry) =>
              `${entry.analysisId}::${normalizeMarketName(
                entry.tracking.selectedMarket || ""
              )}`
          )
      )
    : null;

  const marketMap = new Map<
    string,
    {
      market: string;
      marketGroup: string;
      bets: number;
      greens: number;
      reds: number;
      voids: number;
      pending: number;
      oddsSum: number;
      confidenceSum: number;
      edgeSum: number;
      totalStake: number;
      profitLoss: number;
    }
  >();

  getSavedMultiples()
    .filter((bet) => bet.tracking.betPlaced && bet.legs.length > 0)
    .forEach((bet) => {
      const legCount = bet.legs.length;
      const stakeShare = (bet.tracking.stakeUsed || 0) / legCount;
      const profitShare =
        bet.tracking.resultStatus === "green" ||
        bet.tracking.resultStatus === "red" ||
        bet.tracking.resultStatus === "void"
          ? bet.tracking.profitLoss / legCount
          : 0;

      bet.legs.forEach((leg) => {
        const market = normalizeMarketName(leg.market);
        const legKey = `${leg.analysisId}::${market}`;

        if (duplicateSingleKeys?.has(legKey)) {
          return;
        }

        const current = marketMap.get(market) || {
          market,
          marketGroup: getMarketGroupLabel(market),
          bets: 0,
          greens: 0,
          reds: 0,
          voids: 0,
          pending: 0,
          oddsSum: 0,
          confidenceSum: 0,
          edgeSum: 0,
          totalStake: 0,
          profitLoss: 0,
        };

        current.bets += 1;
        current.oddsSum += leg.odds || 0;
        current.confidenceSum += leg.confidence || 0;
        current.edgeSum += leg.valueBet || 0;
        current.totalStake += stakeShare;
        current.profitLoss += profitShare;

        if (leg.resultStatus === "green") current.greens += 1;
        if (leg.resultStatus === "red") current.reds += 1;
        if (leg.resultStatus === "void") current.voids += 1;
        if (leg.resultStatus === "pending") current.pending += 1;

        marketMap.set(market, current);
      });
    });

  return Array.from(marketMap.values())
    .map((row) => {
      const settled = row.greens + row.reds;

      return {
        market: row.market,
        marketGroup: row.marketGroup,
        bets: row.bets,
        greens: row.greens,
        reds: row.reds,
        voids: row.voids,
        pending: row.pending,
        hitRate: settled > 0 ? Number(((row.greens / settled) * 100).toFixed(1)) : 0,
        avgOdds: row.bets > 0 ? Number((row.oddsSum / row.bets).toFixed(2)) : 0,
        avgConfidence:
          row.bets > 0 ? Number((row.confidenceSum / row.bets).toFixed(2)) : 0,
        avgEdge: row.bets > 0 ? Number((row.edgeSum / row.bets).toFixed(2)) : 0,
        totalStake: Number(row.totalStake.toFixed(2)),
        profitLoss: Number(row.profitLoss.toFixed(2)),
        roi:
          row.totalStake > 0
            ? Number(((row.profitLoss / row.totalStake) * 100).toFixed(1))
            : 0,
      };
    })
    .sort((a, b) => b.profitLoss - a.profitLoss);
}

export function getTierWeight(tier: MultipleTier) {
  if (tier === "premium") return 5;
  if (tier === "elite") return 4;
  if (tier === "bet") return 3;
  if (tier === "watchlist") return 2;
  return 1;
}
