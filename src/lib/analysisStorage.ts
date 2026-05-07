import type { SavedAnalysis } from "../types/analysis";

import { buildFinancialSnapshot } from "@/lib/financialEngine";
import {
  deleteAnalysisRecord,
  persistAnalysisRecord,
  queueEntitySync,
} from "@/lib/persistenceSync";
import type { TrackedAnalysisBet, TrackedBet } from "@/types/analysis";

const ANALYSES_KEY = "scorelab_analyses";
const BANKROLL_SETTINGS_KEY = "scorelab_bankroll_settings";
const MULTIPLES_KEY = "scorelab_multiples";
export const ANALYSES_UPDATED_EVENT = "scorelab:analyses-updated";

let analysesCacheRaw: string | null = null;
let analysesCacheValue: SavedAnalysis[] | null = null;
let bankrollSettingsCacheRaw: string | null = null;
let bankrollSettingsCacheValue: BankrollSettings | null = null;

interface StoredMultipleForBankroll {
  tracking: {
    betPlaced: boolean;
    stakeUsed: number | null;
    resultStatus: "pending" | "green" | "red" | "void";
    profitLoss: number;
  };
}

export interface AnalysisTrackingEntry {
  analysisId: string;
  betId: string;
  isPrimary: boolean;
  label: string;
  createdAt: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  tracking: TrackedAnalysisBet;
  analysis: SavedAnalysis;
}

const PRIMARY_TRACKING_BET_ID = "primary";

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
  totalStake: number;
  profitLoss: number;
  hitRate: number;
  roi: number;
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

export interface QualityScorePerformanceItem {
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

function getLocalDateKey(dateInput: string | null | undefined): string | null {
  if (!dateInput) return null;

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function createTrackingBetId() {
  return `bet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTrackingBet(
  tracking: TrackedBet | TrackedAnalysisBet,
  fallbackId = createTrackingBetId()
): TrackedAnalysisBet {
  return {
    ...tracking,
    id:
      typeof tracking.id === "string" && tracking.id.trim().length > 0
        ? tracking.id
        : fallbackId,
    settledAt:
      typeof tracking.settledAt === "string" ? tracking.settledAt : null,
    placedAt:
      typeof tracking.placedAt === "string" ? tracking.placedAt : null,
    selectedMarket: normalizeMarketName(tracking.selectedMarket),
  };
}

function normalizeSavedAnalysis(analysis: SavedAnalysis): SavedAnalysis {
  const legacySource = analysis as SavedAnalysis & {
    liga?: string;
    competition?: string;
  };
  const legacyLeague =
    typeof legacySource.liga === "string"
      ? legacySource.liga
      : typeof legacySource.competition === "string"
      ? legacySource.competition
      : "";

  return {
    ...analysis,
    league:
      typeof analysis.league === "string" && analysis.league.trim().length > 0
        ? analysis.league
        : legacyLeague.trim().length > 0
        ? legacyLeague
        : "Unspecified",
    results: analysis.results.map((result) => ({
      ...result,
      market: normalizeMarketName(result.market) || result.market,
    })),
    tracking: normalizeTrackingBet(analysis.tracking, PRIMARY_TRACKING_BET_ID),
    extraBets: Array.isArray(analysis.extraBets)
      ? analysis.extraBets.map((bet, index) =>
          normalizeTrackingBet(bet, `extra-${index + 1}`)
        )
      : [],
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
    if (raw === analysesCacheRaw && analysesCacheValue) {
      return analysesCacheValue;
    }

    const normalized = (JSON.parse(raw) as SavedAnalysis[]).map(normalizeSavedAnalysis);
    analysesCacheRaw = raw;
    analysesCacheValue = normalized;
    return normalized;
  } catch {
    return [];
  }
}

export function getAnalysisTrackingEntries(
  analysis: SavedAnalysis
): AnalysisTrackingEntry[] {
  const primary = normalizeTrackingBet(analysis.tracking, PRIMARY_TRACKING_BET_ID);
  const extraBets = Array.isArray(analysis.extraBets) ? analysis.extraBets : [];

  return [primary, ...extraBets.map((bet) => normalizeTrackingBet(bet))]
    .map((tracking, index) => ({
      analysisId: analysis.id,
      betId: tracking.id,
      isPrimary: tracking.id === PRIMARY_TRACKING_BET_ID,
      label: `Bet ${index + 1}`,
      createdAt: analysis.createdAt,
      league: analysis.league,
      homeTeam: analysis.homeTeam,
      awayTeam: analysis.awayTeam,
      tracking,
      analysis,
    }));
}

export function getAllAnalysisTrackingEntries(
  analyses: SavedAnalysis[] = getAnalyses()
): AnalysisTrackingEntry[] {
  return analyses.flatMap((analysis) => getAnalysisTrackingEntries(analysis));
}

export function saveAnalysis(analysis: SavedAnalysis): void {
  const normalizedAnalysis = normalizeSavedAnalysis(analysis);
  const existing = getAnalyses();
  const updated = [normalizedAnalysis, ...existing];
  const nextRaw = JSON.stringify(updated);
  localStorage.setItem(ANALYSES_KEY, nextRaw);
  analysesCacheRaw = nextRaw;
  analysesCacheValue = updated;
  persistAnalysisRecord(normalizedAnalysis as unknown as Record<string, unknown> & { id: string });
  queueEntitySync("analyses");
  window.dispatchEvent(new CustomEvent(ANALYSES_UPDATED_EVENT));
}

export function overwriteAnalyses(analyses: SavedAnalysis[]): void {
  const normalized = analyses.map(normalizeSavedAnalysis);
  const nextRaw = JSON.stringify(normalized);
  localStorage.setItem(ANALYSES_KEY, nextRaw);
  analysesCacheRaw = nextRaw;
  analysesCacheValue = normalized;
  normalized.forEach((analysis) => {
    persistAnalysisRecord(analysis as unknown as Record<string, unknown> & { id: string });
  });
  queueEntitySync("analyses");
  window.dispatchEvent(new CustomEvent(ANALYSES_UPDATED_EVENT));
}

export function deleteAnalysis(analysisId: string): SavedAnalysis[] {
  const analyses = getAnalyses();
  const updated = analyses.filter((analysis) => analysis.id !== analysisId);
  deleteAnalysisRecord(analysisId);
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

    const fallbackPlacedAt =
      analysis.tracking.betPlaced && !analysis.tracking.placedAt
        ? analysis.createdAt
        : undefined;
    const recalculatedTracking = recalculateTracking(
      mergedTracking,
      fallbackPlacedAt
    );

    return {
      ...analysis,
      tracking: recalculatedTracking,
    };
  });

  overwriteAnalyses(updated);
  return updated;
}

export function updateTrackedBet(
  analysisId: string,
  betId: string,
  updates: Partial<TrackedBet>
): SavedAnalysis[] {
  const analyses = getAnalyses();

  const updated = analyses.map((analysis) => {
    if (analysis.id !== analysisId) return analysis;

    if (betId === PRIMARY_TRACKING_BET_ID) {
      const mergedTracking = {
        ...analysis.tracking,
        ...updates,
      };

      return {
        ...analysis,
        tracking: recalculateTracking(
          mergedTracking,
          analysis.tracking.betPlaced && !analysis.tracking.placedAt
            ? analysis.createdAt
            : undefined
        ),
      };
    }

    const extraBets = (analysis.extraBets || []).map((bet) =>
      bet.id === betId
        ? recalculateTracking(
            {
              ...bet,
              ...updates,
            },
            bet.betPlaced && !bet.placedAt ? analysis.createdAt : undefined
          )
        : bet
    );

    return {
      ...analysis,
      extraBets,
    };
  });

  overwriteAnalyses(updated);
  return updated;
}

export function addExtraTrackedBet(
  analysisId: string,
  seed?: Partial<TrackedBet>
): SavedAnalysis[] {
  const analyses = getAnalyses();
  const updated = analyses.map((analysis) => {
    if (analysis.id !== analysisId) return analysis;

    const nextBet = normalizeTrackingBet(
      recalculateTracking({
        ...createEmptyTracking(),
        ...seed,
      }),
      createTrackingBetId()
    );

    return {
      ...analysis,
      extraBets: [...(analysis.extraBets || []), nextBet],
    };
  });

  overwriteAnalyses(updated);
  return updated;
}

export function deleteExtraTrackedBet(
  analysisId: string,
  betId: string
): SavedAnalysis[] {
  const analyses = getAnalyses();
  const updated = analyses.map((analysis) =>
    analysis.id === analysisId
      ? {
          ...analysis,
          extraBets: (analysis.extraBets || []).filter((bet) => bet.id !== betId),
        }
      : analysis
  );

  overwriteAnalyses(updated);
  return updated;
}

function recalculateTracking(
  tracking: SavedAnalysis["tracking"],
  fallbackPlacedAt?: string
): SavedAnalysis["tracking"] {
  let profitLoss = 0;

  if (!tracking.betPlaced) {
    return {
      ...tracking,
      selectedMarket: null,
      stakeUsed: null,
      oddUsed: null,
      resultStatus: "pending",
      settledAt: null,
      placedAt: null,
      profitLoss: 0,
      bankrollAfter: tracking.bankrollBefore,
      qualityScore: null,
      qualityLabel: null,
      qualityTone: null,
      qualitySummary: null,
      qualitySnapshotAt: null,
    };
  }

  const stake = tracking.stakeUsed ?? 0;
  const odd = tracking.oddUsed ?? 0;
  const bankrollBefore = tracking.bankrollBefore ?? null;
  const placedAt =
    tracking.placedAt && typeof tracking.placedAt === "string"
      ? tracking.placedAt
      : fallbackPlacedAt
      ? fallbackPlacedAt
      : new Date().toISOString();

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
  const settledAt =
    tracking.resultStatus === "pending"
      ? null
      : tracking.settledAt && typeof tracking.settledAt === "string"
      ? tracking.settledAt
      : new Date().toISOString();

  return {
    ...tracking,
    placedAt,
    settledAt,
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
    if (raw === bankrollSettingsCacheRaw && bankrollSettingsCacheValue) {
      return bankrollSettingsCacheValue;
    }

    const settings = JSON.parse(raw) as BankrollSettings;
    bankrollSettingsCacheRaw = raw;
    bankrollSettingsCacheValue = settings;
    return settings;
  } catch {
    return { initialBankroll: 0 };
  }
}

export function saveBankrollSettings(settings: BankrollSettings): void {
  const nextRaw = JSON.stringify(settings);
  localStorage.setItem(BANKROLL_SETTINGS_KEY, nextRaw);
  bankrollSettingsCacheRaw = nextRaw;
  bankrollSettingsCacheValue = settings;
  queueEntitySync("bankroll_settings");
}

export function getBankrollStats(): BankrollStats {
  const analyses = getAnalyses();
  const multiples = getSavedMultiplesForBankroll();
  const { initialBankroll } = getBankrollSettings();

  return buildFinancialSnapshot({
    analyses: getAllAnalysisTrackingEntries(analyses).map((entry) => ({
      createdAt: entry.createdAt,
      tracking: entry.tracking,
    })),
    multiples,
    initialBankroll,
  }).stats;
}

export function createEmptyTracking(): SavedAnalysis["tracking"] {
  return {
    betPlaced: false,
    selectedMarket: null,
    stakeUsed: null,
    oddUsed: null,
    resultStatus: "pending",
    placedAt: null,
    settledAt: null,
    profitLoss: 0,
    bankrollBefore: null,
    bankrollAfter: null,
    qualityScore: null,
    qualityLabel: null,
    qualityTone: null,
    qualitySummary: null,
    qualitySnapshotAt: null,
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

function getSelectedResultForEntry(entry: AnalysisTrackingEntry) {
  if (!entry.tracking.selectedMarket) return null;

  return (
    entry.analysis.results.find(
      (result) => result.market === entry.tracking.selectedMarket
    ) || null
  );
}

export function getMarketPerformance(
  analyses: SavedAnalysis[] = getAnalyses()
): MarketPerformanceItem[] {
  const placedBets = getAllAnalysisTrackingEntries(analyses).filter(
    (entry) => entry.tracking.betPlaced && entry.tracking.selectedMarket
  );

  const marketMap = new Map<string, MarketPerformanceItem>();

  placedBets.forEach((entry) => {
    const market = entry.tracking.selectedMarket!;
    const status = entry.tracking.resultStatus;
    const profitLoss = entry.tracking.profitLoss || 0;

    const existing = marketMap.get(market) || {
      market,
      bets: 0,
      greens: 0,
      reds: 0,
      voids: 0,
      pending: 0,
      totalStake: 0,
      profitLoss: 0,
      hitRate: 0,
      roi: 0,
    };

    existing.bets += 1;
    existing.totalStake += entry.tracking.stakeUsed || 0;
    existing.profitLoss += profitLoss;

    if (status === "green") existing.greens += 1;
    if (status === "red") existing.reds += 1;
    if (status === "void") existing.voids += 1;
    if (status === "pending") existing.pending += 1;

    const settled = existing.greens + existing.reds;
    existing.hitRate = settled > 0 ? (existing.greens / settled) * 100 : 0;
    existing.roi =
      existing.totalStake > 0 ? (existing.profitLoss / existing.totalStake) * 100 : 0;

    marketMap.set(market, existing);
  });

  return Array.from(marketMap.values()).sort(
    (a, b) => b.profitLoss - a.profitLoss
  );
}

export function getDailyPerformance(): DailyPerformanceItem[] {
  const { initialBankroll } = getBankrollSettings();

  const settledAnalyses = getAllAnalysisTrackingEntries()
    .filter(
      (entry) =>
        entry.tracking.betPlaced &&
        (entry.tracking.resultStatus === "green" ||
          entry.tracking.resultStatus === "red" ||
          entry.tracking.resultStatus === "void")
    )
    .sort(
      (a, b) =>
        new Date(a.tracking.placedAt || a.createdAt).getTime() -
        new Date(b.tracking.placedAt || b.createdAt).getTime()
    );

  const grouped = new Map<string, DailyPerformanceItem>();
  let runningBankroll = initialBankroll;

  settledAnalyses.forEach((analysis) => {
    const date =
      getLocalDateKey(analysis.tracking.placedAt) ||
      getLocalDateKey(analysis.createdAt);

    if (!date) return;

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

function getSettledBetsWithContext(analyses: SavedAnalysis[] = getAnalyses()) {
  return getAllAnalysisTrackingEntries(analyses)
    .filter(
      (entry) =>
        entry.tracking.betPlaced &&
        entry.tracking.selectedMarket &&
        (entry.tracking.resultStatus === "green" ||
          entry.tracking.resultStatus === "red" ||
          entry.tracking.resultStatus === "void")
    )
    .map((entry) => {
      const selectedMarket = entry.tracking.selectedMarket!;
      const selectedResult = getSelectedResultForEntry(entry);

      return {
        analysis: entry.analysis,
        tracking: entry.tracking,
        selectedResult,
        market: selectedMarket,
        stake: entry.tracking.stakeUsed || 0,
        profitLoss: entry.tracking.profitLoss || 0,
        status: entry.tracking.resultStatus,
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

function getQualityScoreBucket(score: number): string {
  if (score >= 82) return "82-100 Premium";
  if (score >= 68) return "68-81 Approved";
  if (score >= 50) return "50-67 Caution";
  return "0-49 Avoid";
}

export function getEdgeBucketPerformance(
  analyses: SavedAnalysis[] = getAnalyses()
): EdgeBucketPerformanceItem[] {
  const bets = getSettledBetsWithContext(analyses);
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

export function getConfidenceBucketPerformance(
  analyses: SavedAnalysis[] = getAnalyses()
): ConfidenceBucketPerformanceItem[] {
  const bets = getSettledBetsWithContext(analyses);
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

export function getQualityScorePerformance(
  analyses: SavedAnalysis[] = getAnalyses()
): QualityScorePerformanceItem[] {
  const bets = getSettledBetsWithContext(analyses);
  const bucketMap = new Map<string, QualityScorePerformanceItem>();

  bets.forEach((bet) => {
    const qualityScore = bet.tracking.qualityScore;

    if (typeof qualityScore !== "number" || !Number.isFinite(qualityScore)) return;

    const bucket = getQualityScoreBucket(qualityScore);
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
    current.roi =
      current.totalStake > 0 ? (current.profitLoss / current.totalStake) * 100 : 0;
    bucketMap.set(bucket, current);
  });

  const order = ["82-100 Premium", "68-81 Approved", "50-67 Caution", "0-49 Avoid"];

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
          return current.roi > best.roi ? current : best;
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
          roi: Number(bestMarket.roi.toFixed(2)),
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
