import type { SavedAnalysis } from "../types/analysis";

const ANALYSES_KEY = "scorelab_analyses";
const BANKROLL_SETTINGS_KEY = "scorelab_bankroll_settings";

export interface BankrollSettings {
  initialBankroll: number;
}

export interface BankrollStats {
  initialBankroll: number;
  currentBankroll: number;
  totalProfitLoss: number;
  totalBetsPlaced: number;
  totalGreens: number;
  totalReds: number;
  totalVoids: number;
  totalPending: number;
  hitRate: number;
  roi: number;
}

export function getAnalyses(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(ANALYSES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedAnalysis[];
  } catch {
    return [];
  }
}

export function saveAnalysis(analysis: SavedAnalysis): void {
  const existing = getAnalyses();
  const updated = [analysis, ...existing];
  localStorage.setItem(ANALYSES_KEY, JSON.stringify(updated));
}

export function overwriteAnalyses(analyses: SavedAnalysis[]): void {
  localStorage.setItem(ANALYSES_KEY, JSON.stringify(analyses));
}

export function deleteAnalysis(analysisId: string): SavedAnalysis[] {
  const analyses = getAnalyses();
  const updated = analyses.filter((analysis) => analysis.id !== analysisId);
  overwriteAnalyses(updated);
  return updated;
}

export function updateAnalysisTracking(
  analysisId: string,
  updates: Partial<SavedAnalysis["tracking"]>
): SavedAnalysis[] {
  const analyses = getAnalyses();

  const updated = analyses.map((analysis) => {
    if (analysis.id !== analysisId) return analysis;

    const mergedTracking = {
      ...analysis.tracking,
      ...updates,
    };

    const recalculatedTracking = recalculateTracking(mergedTracking);

    return {
      ...analysis,
      tracking: recalculatedTracking,
    };
  });

  overwriteAnalyses(updated);
  return updated;
}

function recalculateTracking(
  tracking: SavedAnalysis["tracking"]
): SavedAnalysis["tracking"] {
  let profitLoss = 0;

  if (!tracking.betPlaced) {
    return {
      ...tracking,
      selectedMarket: null,
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

  if (tracking.resultStatus === "green") {
    profitLoss = stake * (odd - 1);
  } else if (tracking.resultStatus === "red") {
    profitLoss = -stake;
  } else if (tracking.resultStatus === "void") {
    profitLoss = 0;
  } else {
    profitLoss = 0;
  }

  const bankrollAfter =
    bankrollBefore !== null ? bankrollBefore + profitLoss : null;

  return {
    ...tracking,
    profitLoss,
    bankrollAfter,
  };
}

export function getBankrollSettings(): BankrollSettings {
  try {
    const raw = localStorage.getItem(BANKROLL_SETTINGS_KEY);
    if (!raw) {
      return { initialBankroll: 0 };
    }
    return JSON.parse(raw) as BankrollSettings;
  } catch {
    return { initialBankroll: 0 };
  }
}

export function saveBankrollSettings(settings: BankrollSettings): void {
  localStorage.setItem(BANKROLL_SETTINGS_KEY, JSON.stringify(settings));
}

export function getBankrollStats(): BankrollStats {
  const analyses = getAnalyses();
  const { initialBankroll } = getBankrollSettings();

  const placedBets = analyses.filter((a) => a.tracking.betPlaced);

  const totalProfitLoss = placedBets.reduce(
    (acc, analysis) => acc + (analysis.tracking.profitLoss || 0),
    0
  );

  const totalStaked = placedBets.reduce(
    (acc, analysis) => acc + (analysis.tracking.stakeUsed || 0),
    0
  );

  const totalGreens = placedBets.filter(
    (a) => a.tracking.resultStatus === "green"
  ).length;

  const totalReds = placedBets.filter(
    (a) => a.tracking.resultStatus === "red"
  ).length;

  const totalVoids = placedBets.filter(
    (a) => a.tracking.resultStatus === "void"
  ).length;

  const totalPending = placedBets.filter(
    (a) => a.tracking.resultStatus === "pending"
  ).length;

  const settledBets = totalGreens + totalReds;
  const hitRate = settledBets > 0 ? (totalGreens / settledBets) * 100 : 0;
  const roi = totalStaked > 0 ? (totalProfitLoss / totalStaked) * 100 : 0;

  return {
    initialBankroll,
    currentBankroll: initialBankroll + totalProfitLoss,
    totalProfitLoss,
    totalBetsPlaced: placedBets.length,
    totalGreens,
    totalReds,
    totalVoids,
    totalPending,
    hitRate,
    roi,
  };
}

export function createEmptyTracking(): SavedAnalysis["tracking"] {
  return {
    betPlaced: false,
    selectedMarket: null,
    stakeUsed: null,
    oddUsed: null,
    resultStatus: "pending",
    profitLoss: 0,
    bankrollBefore: null,
    bankrollAfter: null,
    notes: "",
  };
}

export function createAnalysisId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function calculateNextBankrollBefore(): number {
  const stats = getBankrollStats();
  return stats.currentBankroll;
}

export interface MarketPerformanceItem {
  market: string;
  bets: number;
  greens: number;
  reds: number;
  voids: number;
  pending: number;
  profitLoss: number;
  hitRate: number;
}

export function getMarketPerformance(): MarketPerformanceItem[] {
  const analyses = getAnalyses();

  const placedBets = analyses.filter(
    (analysis) =>
      analysis.tracking.betPlaced &&
      analysis.tracking.selectedMarket
  );

  const marketMap = new Map<string, MarketPerformanceItem>();

  placedBets.forEach((analysis) => {
    const market = analysis.tracking.selectedMarket!;
    const status = analysis.tracking.resultStatus;
    const profitLoss = analysis.tracking.profitLoss || 0;

    const existing = marketMap.get(market) || {
      market,
      bets: 0,
      greens: 0,
      reds: 0,
      voids: 0,
      pending: 0,
      profitLoss: 0,
      hitRate: 0,
    };

    existing.bets += 1;
    existing.profitLoss += profitLoss;

    if (status === "green") existing.greens += 1;
    if (status === "red") existing.reds += 1;
    if (status === "void") existing.voids += 1;
    if (status === "pending") existing.pending += 1;

    const settled = existing.greens + existing.reds;
    existing.hitRate = settled > 0 ? (existing.greens / settled) * 100 : 0;

    marketMap.set(market, existing);
  });

  return Array.from(marketMap.values()).sort(
    (a, b) => b.profitLoss - a.profitLoss
  );
}