import type { BetStatus } from "@/types/analysis";

export interface FinancialTrackingLike {
  betPlaced: boolean;
  stakeUsed: number | null;
  oddUsed?: number | null;
  resultStatus: BetStatus;
  settledAt?: string | null;
  profitLoss: number;
}

export interface FinancialSourceItem {
  createdAt: string;
  tracking: FinancialTrackingLike;
  combinedOdds?: number | null;
}

export interface FinancialStats {
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

export interface FinancialDailyPerformanceItem {
  date: string;
  startBankroll: number;
  endBankroll: number;
  profitLoss: number;
  growthPct: number;
  settledBets: number;
}

export interface FinancialDrawdownPoint {
  step: string;
  bankroll: number;
  peak: number;
  drawdownPct: number;
}

export interface FinancialBankrollPoint {
  name: string;
  bankroll: number;
}

export interface FinancialSettledEntry {
  occurredAt: string;
  profitLoss: number;
  date: string;
}

export interface FinancialSnapshot {
  stats: FinancialStats;
  openExposure: number;
  openPotentialProfit: number;
  settledEntries: FinancialSettledEntry[];
  dailyPerformance: FinancialDailyPerformanceItem[];
  bankrollEvolution: FinancialBankrollPoint[];
  drawdownSeries: FinancialDrawdownPoint[];
  todayPerformance: FinancialDailyPerformanceItem | null;
}

function roundTo(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

export function getFinancialLocalDateKey(dateInput: string | Date | null | undefined): string | null {
  if (!dateInput) return null;

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isSettledStatus(status: BetStatus) {
  return status === "green" || status === "red" || status === "void";
}

function resolvePotentialOdds(item: FinancialSourceItem) {
  const trackingOdds = item.tracking.oddUsed;
  if (typeof trackingOdds === "number" && Number.isFinite(trackingOdds)) {
    return trackingOdds;
  }

  if (typeof item.combinedOdds === "number" && Number.isFinite(item.combinedOdds)) {
    return item.combinedOdds;
  }

  return 0;
}

export function buildFinancialSnapshot({
  analyses,
  multiples,
  initialBankroll,
}: {
  analyses: FinancialSourceItem[];
  multiples: FinancialSourceItem[];
  initialBankroll: number;
}): FinancialSnapshot {
  const safeInitialBankroll = Number.isFinite(initialBankroll) ? initialBankroll : 0;
  const placedSingles = analyses.filter((item) => item.tracking.betPlaced);
  const placedMultiples = multiples.filter((item) => item.tracking.betPlaced);
  const placedItems = [...placedSingles, ...placedMultiples];

  const totalProfitLoss = placedItems.reduce(
    (sum, item) => sum + (item.tracking.profitLoss || 0),
    0
  );
  const totalStaked = placedItems.reduce(
    (sum, item) => sum + (item.tracking.stakeUsed || 0),
    0
  );
  const totalGreens = placedItems.filter(
    (item) => item.tracking.resultStatus === "green"
  ).length;
  const totalReds = placedItems.filter(
    (item) => item.tracking.resultStatus === "red"
  ).length;
  const totalVoids = placedItems.filter(
    (item) => item.tracking.resultStatus === "void"
  ).length;
  const totalPending = placedItems.filter(
    (item) => item.tracking.resultStatus === "pending"
  ).length;

  const openExposure = placedItems
    .filter((item) => item.tracking.resultStatus === "pending")
    .reduce((sum, item) => sum + (item.tracking.stakeUsed || 0), 0);

  const openPotentialProfit = placedItems
    .filter((item) => item.tracking.resultStatus === "pending")
    .reduce((sum, item) => {
      const stake = item.tracking.stakeUsed || 0;
      const odds = resolvePotentialOdds(item);
      return sum + Math.max(0, stake * (odds - 1));
    }, 0);

  const currentBankroll = safeInitialBankroll + totalProfitLoss - openExposure;
  const settledBets = totalGreens + totalReds;
  const hitRate = settledBets > 0 ? (totalGreens / settledBets) * 100 : 0;
  const roi = totalStaked > 0 ? (totalProfitLoss / totalStaked) * 100 : 0;
  const bankrollGrowthPct =
    safeInitialBankroll > 0 ? (totalProfitLoss / safeInitialBankroll) * 100 : 0;

  const settledEntries = placedItems
    .filter((item) => isSettledStatus(item.tracking.resultStatus))
    .map((item) => {
      const occurredAt = item.tracking.settledAt || item.createdAt;
      return {
        occurredAt,
        profitLoss: item.tracking.profitLoss || 0,
        date: getFinancialLocalDateKey(occurredAt) || "",
      };
    })
    .filter((item) => item.date)
    .sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

  const groupedDaily = new Map<string, FinancialDailyPerformanceItem>();
  let runningBankroll = safeInitialBankroll;

  settledEntries.forEach((entry) => {
    const current = groupedDaily.get(entry.date) || {
      date: entry.date,
      startBankroll: runningBankroll,
      endBankroll: runningBankroll,
      profitLoss: 0,
      growthPct: 0,
      settledBets: 0,
    };

    current.profitLoss += entry.profitLoss;
    current.endBankroll = current.startBankroll + current.profitLoss;
    current.settledBets += 1;
    groupedDaily.set(entry.date, current);
    runningBankroll += entry.profitLoss;
  });

  const dailyPerformance = Array.from(groupedDaily.values())
    .map((item) => ({
      ...item,
      startBankroll: roundTo(item.startBankroll),
      endBankroll: roundTo(item.endBankroll),
      profitLoss: roundTo(item.profitLoss),
      growthPct:
        item.startBankroll > 0
          ? roundTo((item.profitLoss / item.startBankroll) * 100)
          : 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const bankrollEvolution: FinancialBankrollPoint[] = [
    { name: "Start", bankroll: roundTo(safeInitialBankroll) },
  ];
  let evolutionBankroll = safeInitialBankroll;

  settledEntries.forEach((entry, index) => {
    evolutionBankroll += entry.profitLoss;
    bankrollEvolution.push({
      name: `${index + 1}`,
      bankroll: roundTo(evolutionBankroll),
    });
  });

  const drawdownSeries: FinancialDrawdownPoint[] = [
    {
      step: "Start",
      bankroll: roundTo(safeInitialBankroll),
      peak: roundTo(safeInitialBankroll),
      drawdownPct: 0,
    },
  ];
  let peak = safeInitialBankroll;
  let drawdownBankroll = safeInitialBankroll;

  settledEntries.forEach((entry, index) => {
    drawdownBankroll += entry.profitLoss;
    peak = Math.max(peak, drawdownBankroll);
    const drawdownPct = peak > 0 ? ((drawdownBankroll - peak) / peak) * 100 : 0;

    drawdownSeries.push({
      step: `${index + 1}`,
      bankroll: roundTo(drawdownBankroll),
      peak: roundTo(peak),
      drawdownPct: roundTo(drawdownPct),
    });
  });

  const todayKey = getFinancialLocalDateKey(new Date());
  const todayPerformance =
    dailyPerformance.find((item) => item.date === todayKey) || null;

  return {
    stats: {
      initialBankroll: safeInitialBankroll,
      currentBankroll: roundTo(currentBankroll),
      totalProfitLoss: roundTo(totalProfitLoss),
      totalStaked: roundTo(totalStaked),
      totalBetsPlaced: placedItems.length,
      totalGreens,
      totalReds,
      totalVoids,
      totalPending,
      hitRate: roundTo(hitRate),
      roi: roundTo(roi),
      bankrollGrowthPct: roundTo(bankrollGrowthPct),
    },
    openExposure: roundTo(openExposure),
    openPotentialProfit: roundTo(openPotentialProfit),
    settledEntries,
    dailyPerformance,
    bankrollEvolution,
    drawdownSeries,
    todayPerformance,
  };
}
