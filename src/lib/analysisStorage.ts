import type { SavedAnalysis } from "../types/analysis";

const ANALYSES_KEY = "scorelab_analyses";
const BANKROLL_SETTINGS_KEY = "scorelab_bankroll_settings";
const MULTIPLES_KEY = "scorelab_multiples";
export const ANALYSES_UPDATED_EVENT = "scorelab:analyses-updated";

interface StoredMultipleForBankroll {
  tracking: {
    betPlaced: boolean;
    stakeUsed: number | null;
    resultStatus: "pending" | "green" | "red" | "void";
    profitLoss: number;
  };
}

export interface BankrollSettings {
  initialBankroll: number;
}

export interface BankrollStats {
  initialBankroll: number;
  currentBankroll: number;
  totalProfitLoss: number;
  totalStaked: number;
  totalBetsPlaced: number;
  totalGreens: number;
  totalReds: number;
  totalVoids: number;
  totalPending: number;
  hitRate: number;
  roi: number;
  bankrollGrowthPct: number;
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

export interface DailyPerformanceItem {
  date: string;
  startBankroll: number;
  endBankroll: number;
  profitLoss: number;
  growthPct: number;
  settledBets: number;
}

export interface EdgeBucketPerformanceItem {
  bucket: string;
  bets: number;
  greens: number;
  reds: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  hitRate: number;
}

export interface ConfidenceBucketPerformanceItem {
  bucket: string;
  bets: number;
  greens: number;
  reds: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  hitRate: number;
}

export interface DrawdownPoint {
  step: string;
  bankroll: number;
  peak: number;
  drawdownPct: number;
}

export interface CumulativeMarketSeries {
  markets: string[];
  data: Array<Record<string, string | number>>;
}

function normalizeMarketName(market: string | null | undefined): string | null {
  if (!market) return null;

  const normalized = market.trim().toLowerCase();

  if (normalized === "btts yes" || normalized === "ambas marcam") {
    return "BTTS Yes";
  }

  if (
    normalized === "btts no" ||
    normalized === "bttsn" ||
    normalized === "ambas não marcam" ||
    normalized === "ambas nao marcam" ||
    normalized === "ambas nÃ£o marcam"
  ) {
    return "BTTS No";
  }

  return market;
}

function normalizeSavedAnalysis(analysis: SavedAnalysis): SavedAnalysis {
  return {
    ...analysis,
    results: analysis.results.map((result) => ({
      ...result,
      market: normalizeMarketName(result.market) || result.market,
    })),
    tracking: {
      ...analysis.tracking,
      selectedMarket: normalizeMarketName(analysis.tracking.selectedMarket),
    },
  };
}

function getSavedMultiplesForBankroll(): StoredMultipleForBankroll[] {
  try {
    const raw = localStorage.getItem(MULTIPLES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredMultipleForBankroll[];
  } catch {
    return [];
  }
}

export function getAnalyses(): SavedAnalysis[] {
  try {
    const raw = localStorage.getItem(ANALYSES_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SavedAnalysis[]).map(normalizeSavedAnalysis);
  } catch {
    return [];
  }
}

export function saveAnalysis(analysis: SavedAnalysis): void {
  const existing = getAnalyses();
  const updated = [normalizeSavedAnalysis(analysis), ...existing];
  localStorage.setItem(ANALYSES_KEY, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent(ANALYSES_UPDATED_EVENT));
}

export function overwriteAnalyses(analyses: SavedAnalysis[]): void {
  localStorage.setItem(
    ANALYSES_KEY,
    JSON.stringify(analyses.map(normalizeSavedAnalysis))
  );
  window.dispatchEvent(new CustomEvent(ANALYSES_UPDATED_EVENT));
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
  const multiples = getSavedMultiplesForBankroll();
  const { initialBankroll } = getBankrollSettings();

  const placedSingles = analyses.filter((a) => a.tracking.betPlaced);
  const placedMultiples = multiples.filter((m) => m.tracking.betPlaced);

  const totalProfitLoss =
    placedSingles.reduce(
      (acc, analysis) => acc + (analysis.tracking.profitLoss || 0),
      0
    ) +
    placedMultiples.reduce(
      (acc, multiple) => acc + (multiple.tracking.profitLoss || 0),
      0
    );

  const totalStaked =
    placedSingles.reduce(
      (acc, analysis) => acc + (analysis.tracking.stakeUsed || 0),
      0
    ) +
    placedMultiples.reduce(
      (acc, multiple) => acc + (multiple.tracking.stakeUsed || 0),
      0
    );

  const totalGreens =
    placedSingles.filter((a) => a.tracking.resultStatus === "green").length +
    placedMultiples.filter((a) => a.tracking.resultStatus === "green").length;

  const totalReds =
    placedSingles.filter((a) => a.tracking.resultStatus === "red").length +
    placedMultiples.filter((a) => a.tracking.resultStatus === "red").length;

  const totalVoids =
    placedSingles.filter((a) => a.tracking.resultStatus === "void").length +
    placedMultiples.filter((a) => a.tracking.resultStatus === "void").length;

  const totalPending =
    placedSingles.filter((a) => a.tracking.resultStatus === "pending").length +
    placedMultiples.filter((a) => a.tracking.resultStatus === "pending").length;

  const pendingExposure =
    placedSingles
      .filter((a) => a.tracking.resultStatus === "pending")
      .reduce((acc, analysis) => acc + (analysis.tracking.stakeUsed || 0), 0) +
    placedMultiples
      .filter((a) => a.tracking.resultStatus === "pending")
      .reduce((acc, multiple) => acc + (multiple.tracking.stakeUsed || 0), 0);

  const settledBets = totalGreens + totalReds;
  const hitRate = settledBets > 0 ? (totalGreens / settledBets) * 100 : 0;
  const roi = totalStaked > 0 ? (totalProfitLoss / totalStaked) * 100 : 0;
  const bankrollGrowthPct =
    initialBankroll > 0 ? (totalProfitLoss / initialBankroll) * 100 : 0;

  return {
    initialBankroll,
    currentBankroll: initialBankroll + totalProfitLoss - pendingExposure,
    totalProfitLoss,
    totalStaked,
    totalBetsPlaced: placedSingles.length + placedMultiples.length,
    totalGreens,
    totalReds,
    totalVoids,
    totalPending,
    hitRate,
    roi,
    bankrollGrowthPct,
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

export function getMarketPerformance(): MarketPerformanceItem[] {
  const analyses = getAnalyses();

  const placedBets = analyses.filter(
    (analysis) => analysis.tracking.betPlaced && analysis.tracking.selectedMarket
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

export function getDailyPerformance(): DailyPerformanceItem[] {
  const analyses = getAnalyses();
  const { initialBankroll } = getBankrollSettings();

  const settledAnalyses = analyses
    .filter(
      (analysis) =>
        analysis.tracking.betPlaced &&
        (analysis.tracking.resultStatus === "green" ||
          analysis.tracking.resultStatus === "red" ||
          analysis.tracking.resultStatus === "void")
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

  const grouped = new Map<string, DailyPerformanceItem>();
  let runningBankroll = initialBankroll;

  settledAnalyses.forEach((analysis) => {
    const date = new Date(analysis.createdAt).toISOString().split("T")[0];
    const profitLoss = analysis.tracking.profitLoss || 0;

    if (!grouped.has(date)) {
      grouped.set(date, {
        date,
        startBankroll: runningBankroll,
        endBankroll: runningBankroll,
        profitLoss: 0,
        growthPct: 0,
        settledBets: 0,
      });
    }

    const current = grouped.get(date)!;

    current.profitLoss += profitLoss;
    current.endBankroll += profitLoss;
    current.settledBets += 1;

    grouped.set(date, current);

    runningBankroll += profitLoss;
  });

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      growthPct:
        item.startBankroll > 0
          ? (item.profitLoss / item.startBankroll) * 100
          : 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getSettledBetsWithContext() {
  const analyses = getAnalyses();

  return analyses
    .filter(
      (analysis) =>
        analysis.tracking.betPlaced &&
        analysis.tracking.selectedMarket &&
        (analysis.tracking.resultStatus === "green" ||
          analysis.tracking.resultStatus === "red" ||
          analysis.tracking.resultStatus === "void")
    )
    .map((analysis) => {
      const selectedMarket = analysis.tracking.selectedMarket!;
      const selectedResult =
        analysis.results.find((r) => r.market === selectedMarket) || null;

      return {
        analysis,
        selectedResult,
        market: selectedMarket,
        stake: analysis.tracking.stakeUsed || 0,
        profitLoss: analysis.tracking.profitLoss || 0,
        status: analysis.tracking.resultStatus,
      };
    })
    .sort(
      (a, b) =>
        new Date(a.analysis.createdAt).getTime() -
        new Date(b.analysis.createdAt).getTime()
    );
}

function getEdgeBucket(valueBet: number): string {
  if (valueBet < 3) return "0-2.9%";
  if (valueBet < 5) return "3-4.9%";
  if (valueBet < 7) return "5-6.9%";
  return "7%+";
}

function getConfidenceBucket(confidence: number): string {
  if (confidence <= 5) return "0-5";
  if (confidence <= 6) return "6";
  if (confidence <= 7) return "7";
  if (confidence <= 8) return "8";
  return "9-10";
}

export function getEdgeBucketPerformance(): EdgeBucketPerformanceItem[] {
  const bets = getSettledBetsWithContext();
  const bucketMap = new Map<string, EdgeBucketPerformanceItem>();

  bets.forEach((bet) => {
    if (!bet.selectedResult) return;

    const bucket = getEdgeBucket(bet.selectedResult.valueBet);
    const current = bucketMap.get(bucket) || {
      bucket,
      bets: 0,
      greens: 0,
      reds: 0,
      totalStake: 0,
      profitLoss: 0,
      roi: 0,
      hitRate: 0,
    };

    current.bets += 1;
    current.totalStake += bet.stake;
    current.profitLoss += bet.profitLoss;

    if (bet.status === "green") current.greens += 1;
    if (bet.status === "red") current.reds += 1;

    const settled = current.greens + current.reds;
    current.hitRate = settled > 0 ? (current.greens / settled) * 100 : 0;
    current.roi = current.totalStake > 0 ? (current.profitLoss / current.totalStake) * 100 : 0;
    bucketMap.set(bucket, current);
  });

  const order = ["0-2.9%", "3-4.9%", "5-6.9%", "7%+"];

  return Array.from(bucketMap.values()).sort(
    (a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket)
  );
}

export function getConfidenceBucketPerformance(): ConfidenceBucketPerformanceItem[] {
  const bets = getSettledBetsWithContext();
  const bucketMap = new Map<string, ConfidenceBucketPerformanceItem>();

  bets.forEach((bet) => {
    if (!bet.selectedResult) return;

    const bucket = getConfidenceBucket(bet.selectedResult.confidence);
    const current = bucketMap.get(bucket) || {
      bucket,
      bets: 0,
      greens: 0,
      reds: 0,
      totalStake: 0,
      profitLoss: 0,
      roi: 0,
      hitRate: 0,
    };

    current.bets += 1;
    current.totalStake += bet.stake;
    current.profitLoss += bet.profitLoss;

    if (bet.status === "green") current.greens += 1;
    if (bet.status === "red") current.reds += 1;

    const settled = current.greens + current.reds;
    current.hitRate = settled > 0 ? (current.greens / settled) * 100 : 0;
    current.roi = current.totalStake > 0 ? (current.profitLoss / current.totalStake) * 100 : 0;
    bucketMap.set(bucket, current);
  });

  const order = ["0-5", "6", "7", "8", "9-10"];

  return Array.from(bucketMap.values()).sort(
    (a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket)
  );
}

export function getDrawdownSeries(): DrawdownPoint[] {
  const { initialBankroll } = getBankrollSettings();
  const bets = getSettledBetsWithContext();

  let bankroll = initialBankroll;
  let peak = initialBankroll;

  const series: DrawdownPoint[] = [
    {
      step: "Start",
      bankroll: Number(initialBankroll.toFixed(2)),
      peak: Number(initialBankroll.toFixed(2)),
      drawdownPct: 0,
    },
  ];

  bets.forEach((bet, index) => {
    bankroll += bet.profitLoss;
    peak = Math.max(peak, bankroll);

    const drawdownPct = peak > 0 ? ((bankroll - peak) / peak) * 100 : 0;

    series.push({
      step: `${index + 1}`,
      bankroll: Number(bankroll.toFixed(2)),
      peak: Number(peak.toFixed(2)),
      drawdownPct: Number(drawdownPct.toFixed(2)),
    });
  });

  return series;
}

export function getDailyProfitSeries() {
  return getDailyPerformance()
    .slice()
    .reverse()
    .map((day) => ({
      date: day.date.slice(5),
      profitLoss: Number(day.profitLoss.toFixed(2)),
      growthPct: Number(day.growthPct.toFixed(2)),
    }));
}

export function getCumulativeMarketSeries(): CumulativeMarketSeries {
  const bets = getSettledBetsWithContext();
  const markets = Array.from(
    new Set(bets.map((bet) => bet.market))
  ).sort();

  const runningTotals: Record<string, number> = {};
  markets.forEach((market) => {
    runningTotals[market] = 0;
  });

  const data = bets.map((bet, index) => {
    runningTotals[bet.market] += bet.profitLoss;

    const row: Record<string, string | number> = {
      step: `${index + 1}`,
    };

    markets.forEach((market) => {
      row[market] = Number(runningTotals[market].toFixed(2));
    });

    return row;
  });

  return { markets, data };
}

export interface BestPerformingZone {
  bestMarket: {
    market: string;
    roi: number;
    bets: number;
    profitLoss: number;
  } | null;
  bestEdgeBucket: {
    bucket: string;
    roi: number;
    bets: number;
    profitLoss: number;
  } | null;
  bestConfidenceBucket: {
    bucket: string;
    roi: number;
    bets: number;
    profitLoss: number;
  } | null;
}

export function getBestPerformingZone(): BestPerformingZone {
  const marketPerformance = getMarketPerformance();
  const edgePerformance = getEdgeBucketPerformance();
  const confidencePerformance = getConfidenceBucketPerformance();

  const validMarkets = marketPerformance.filter(
    (item) => item.bets >= 2
  );

  const bestMarket =
    validMarkets.length > 0
      ? validMarkets.reduce((best, current) => {
          const currentRoi =
            current.bets > 0
              ? (current.profitLoss /
                  Math.max(
                    1,
                    getAnalyses()
                      .filter(
                        (a) =>
                          a.tracking.betPlaced &&
                          a.tracking.selectedMarket === current.market
                      )
                      .reduce((acc, a) => acc + (a.tracking.stakeUsed || 0), 0)
                )) *
                100
              : 0;

          const bestRoi =
            best.bets > 0
              ? (best.profitLoss /
                  Math.max(
                    1,
                    getAnalyses()
                      .filter(
                        (a) =>
                          a.tracking.betPlaced &&
                          a.tracking.selectedMarket === best.market
                      )
                      .reduce((acc, a) => acc + (a.tracking.stakeUsed || 0), 0)
                )) *
                100
              : 0;

          return currentRoi > bestRoi ? current : best;
        })
      : null;

  const validEdgeBuckets = edgePerformance.filter((item) => item.bets >= 2);
  const bestEdgeBucket =
    validEdgeBuckets.length > 0
      ? validEdgeBuckets.reduce((best, current) =>
          current.roi > best.roi ? current : best
        )
      : null;

  const validConfidenceBuckets = confidencePerformance.filter(
    (item) => item.bets >= 2
  );
  const bestConfidenceBucket =
    validConfidenceBuckets.length > 0
      ? validConfidenceBuckets.reduce((best, current) =>
          current.roi > best.roi ? current : best
        )
      : null;

  return {
    bestMarket: bestMarket
      ? {
          market: bestMarket.market,
          roi: Number(
            (
              (bestMarket.profitLoss /
                Math.max(
                  1,
                  getAnalyses()
                    .filter(
                      (a) =>
                        a.tracking.betPlaced &&
                        a.tracking.selectedMarket === bestMarket.market
                    )
                    .reduce((acc, a) => acc + (a.tracking.stakeUsed || 0), 0)
                )) *
              100
            ).toFixed(2)
          ),
          bets: bestMarket.bets,
          profitLoss: Number(bestMarket.profitLoss.toFixed(2)),
        }
      : null,

    bestEdgeBucket: bestEdgeBucket
      ? {
          bucket: bestEdgeBucket.bucket,
          roi: Number(bestEdgeBucket.roi.toFixed(2)),
          bets: bestEdgeBucket.bets,
          profitLoss: Number(bestEdgeBucket.profitLoss.toFixed(2)),
        }
      : null,

    bestConfidenceBucket: bestConfidenceBucket
      ? {
          bucket: bestConfidenceBucket.bucket,
          roi: Number(bestConfidenceBucket.roi.toFixed(2)),
          bets: bestConfidenceBucket.bets,
          profitLoss: Number(bestConfidenceBucket.profitLoss.toFixed(2)),
        }
      : null,
  };
}
