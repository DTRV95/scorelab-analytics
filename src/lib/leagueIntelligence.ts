import {
  getAllAnalysisTrackingEntries,
  getAnalyses,
} from "@/lib/analysisStorage";
import { getSavedMultiples } from "@/lib/multipleStorage";
import type { SavedAnalysis } from "@/types/analysis";

export type LeagueIntelligenceStatus =
  | "Reliable"
  | "Stable"
  | "Volatile"
  | "Avoid"
  | "Needs Data";

export interface LeagueIntelligenceRow {
  league: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  avgConfidence: number;
  avgEdge: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  bestMarket: string;
  trustScore: number;
  intelligenceStatus: LeagueIntelligenceStatus;
  recommendation: string;
}

function roundTo(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function classifyLeague(row: {
  bets: number;
  hitRate: number;
  roi: number;
  avgConfidence: number;
  profitLoss: number;
}) {
  if (row.bets < 3) {
    return {
      trustScore: Math.max(10, row.bets * 18),
      intelligenceStatus: "Needs Data" as const,
      recommendation: "Track more results before trusting this league operationally.",
    };
  }

  const sampleScore = Math.min(30, row.bets * 3);
  const roiScore = Math.max(-30, Math.min(35, row.roi * 0.9));
  const hitRateScore = Math.max(-20, Math.min(25, (row.hitRate - 50) * 1.2));
  const confidenceScore = Math.max(-10, Math.min(10, (row.avgConfidence - 7) * 4));
  const trustScore = Math.max(
    0,
    Math.min(100, roundTo(45 + sampleScore + roiScore + hitRateScore + confidenceScore, 0))
  );

  if (row.bets >= 6 && row.roi >= 12 && row.hitRate >= 55 && trustScore >= 72) {
    return {
      trustScore,
      intelligenceStatus: "Reliable" as const,
      recommendation: "Can be prioritized when the radar also shows strong probability.",
    };
  }

  if (row.roi >= 0 && row.hitRate >= 50 && trustScore >= 58) {
    return {
      trustScore,
      intelligenceStatus: "Stable" as const,
      recommendation: "Usable, but keep stake disciplined until the sample grows.",
    };
  }

  if (row.roi < -15 || (row.bets >= 5 && row.hitRate < 42)) {
    return {
      trustScore,
      intelligenceStatus: "Avoid" as const,
      recommendation: "Avoid new mission exposure here until the pattern improves.",
    };
  }

  return {
    trustScore,
    intelligenceStatus: "Volatile" as const,
    recommendation: "Only use premium setups; do not force volume in this league.",
  };
}

export function getLeagueIntelligenceTone(status: LeagueIntelligenceStatus) {
  if (status === "Reliable") {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "Stable") {
    return "border-cyan-400/25 bg-cyan-400/10 text-cyan-200";
  }

  if (status === "Volatile") {
    return "border-amber-400/25 bg-amber-400/10 text-amber-200";
  }

  if (status === "Avoid") {
    return "border-red-400/25 bg-red-400/10 text-red-200";
  }

  return "border-white/10 bg-white/[0.05] text-white/55";
}

export function buildLeagueIntelligenceRows(
  analyses: SavedAnalysis[] = getAnalyses()
): LeagueIntelligenceRow[] {
  const savedMultiples = getSavedMultiples();
  const analysisMap = new Map(analyses.map((analysis) => [analysis.id, analysis]));
  const leagueMap = new Map<
    string,
    {
      bets: number;
      wins: number;
      losses: number;
      voids: number;
      totalStake: number;
      profitLoss: number;
      confidenceSum: number;
      edgeSum: number;
      marketMap: Map<string, { bets: number; totalStake: number; profitLoss: number }>;
    }
  >();

  const ensureLeague = (league: string) => {
    if (!leagueMap.has(league)) {
      leagueMap.set(league, {
        bets: 0,
        wins: 0,
        losses: 0,
        voids: 0,
        totalStake: 0,
        profitLoss: 0,
        confidenceSum: 0,
        edgeSum: 0,
        marketMap: new Map(),
      });
    }

    return leagueMap.get(league)!;
  };

  getAllAnalysisTrackingEntries(analyses)
    .filter(
      (entry) =>
        entry.tracking.betPlaced &&
        entry.tracking.selectedMarket &&
        (entry.tracking.resultStatus === "green" ||
          entry.tracking.resultStatus === "red" ||
          entry.tracking.resultStatus === "void")
    )
    .forEach((entry) => {
      const selectedResult = entry.analysis.results.find(
        (result) => result.market === entry.tracking.selectedMarket
      );

      if (!selectedResult) return;

      const league = entry.league?.trim() || "Unspecified";
      const row = ensureLeague(league);
      const stake = entry.tracking.stakeUsed || 0;
      const profitLoss = entry.tracking.profitLoss || 0;
      const market = selectedResult.market;

      row.bets += 1;
      row.totalStake += stake;
      row.profitLoss += profitLoss;
      row.confidenceSum += selectedResult.confidence || 0;
      row.edgeSum += selectedResult.valueBet || 0;

      if (entry.tracking.resultStatus === "green") row.wins += 1;
      if (entry.tracking.resultStatus === "red") row.losses += 1;
      if (entry.tracking.resultStatus === "void") row.voids += 1;

      const currentMarket = row.marketMap.get(market) || {
        bets: 0,
        totalStake: 0,
        profitLoss: 0,
      };
      currentMarket.bets += 1;
      currentMarket.totalStake += stake;
      currentMarket.profitLoss += profitLoss;
      row.marketMap.set(market, currentMarket);
    });

  savedMultiples
    .filter(
      (multiple) =>
        multiple.tracking.betPlaced &&
        (multiple.tracking.resultStatus === "green" ||
          multiple.tracking.resultStatus === "red" ||
          multiple.tracking.resultStatus === "void")
    )
    .forEach((multiple) => {
      const resolvedLegs = multiple.legs.filter(
        (leg) =>
          leg.resultStatus === "green" ||
          leg.resultStatus === "red" ||
          leg.resultStatus === "void"
      );

      if (!resolvedLegs.length) return;

      const allocatedStake = (multiple.tracking.stakeUsed || 0) / resolvedLegs.length;
      const allocatedProfitLoss =
        (multiple.tracking.profitLoss || 0) / resolvedLegs.length;

      resolvedLegs.forEach((leg) => {
        const sourceAnalysis = analysisMap.get(leg.analysisId);
        const league = sourceAnalysis?.league?.trim() || "Unspecified";
        const row = ensureLeague(league);
        const market = leg.market;

        row.bets += 1;
        row.totalStake += allocatedStake;
        row.profitLoss += allocatedProfitLoss;
        row.confidenceSum += leg.confidence || 0;
        row.edgeSum += leg.valueBet || 0;

        if (leg.resultStatus === "green") row.wins += 1;
        if (leg.resultStatus === "red") row.losses += 1;
        if (leg.resultStatus === "void") row.voids += 1;

        const currentMarket = row.marketMap.get(market) || {
          bets: 0,
          totalStake: 0,
          profitLoss: 0,
        };
        currentMarket.bets += 1;
        currentMarket.totalStake += allocatedStake;
        currentMarket.profitLoss += allocatedProfitLoss;
        row.marketMap.set(market, currentMarket);
      });
    });

  return Array.from(leagueMap.entries())
    .map(([league, row]) => {
      const settled = row.wins + row.losses;
      const hitRate = settled > 0 ? (row.wins / settled) * 100 : 0;
      const roi = row.totalStake > 0 ? (row.profitLoss / row.totalStake) * 100 : 0;
      const avgConfidence = row.bets > 0 ? row.confidenceSum / row.bets : 0;
      const avgEdge = row.bets > 0 ? row.edgeSum / row.bets : 0;
      const bestMarketEntry =
        Array.from(row.marketMap.entries()).sort((a, b) => {
          const aRoi =
            a[1].totalStake > 0 ? (a[1].profitLoss / a[1].totalStake) * 100 : 0;
          const bRoi =
            b[1].totalStake > 0 ? (b[1].profitLoss / b[1].totalStake) * 100 : 0;

          if (bRoi !== aRoi) return bRoi - aRoi;
          return b[1].bets - a[1].bets;
        })[0];

      const intelligence = classifyLeague({
        bets: row.bets,
        hitRate,
        roi,
        avgConfidence,
        profitLoss: row.profitLoss,
      });

      return {
        league,
        bets: row.bets,
        wins: row.wins,
        losses: row.losses,
        voids: row.voids,
        hitRate: roundTo(hitRate, 1),
        avgConfidence: roundTo(avgConfidence),
        avgEdge: roundTo(avgEdge),
        totalStake: roundTo(row.totalStake),
        profitLoss: roundTo(row.profitLoss),
        roi: roundTo(roi, 1),
        bestMarket: bestMarketEntry?.[0] ?? "No clear read yet",
        ...intelligence,
      };
    })
    .sort((a, b) => {
      const statusOrder: Record<LeagueIntelligenceStatus, number> = {
        Reliable: 0,
        Stable: 1,
        Volatile: 2,
        "Needs Data": 3,
        Avoid: 4,
      };

      const statusDiff =
        statusOrder[a.intelligenceStatus] - statusOrder[b.intelligenceStatus];
      if (statusDiff !== 0) return statusDiff;
      return b.trustScore - a.trustScore;
    });
}

export function getLeagueIntelligenceSummary(analyses: SavedAnalysis[] = getAnalyses()) {
  const rows = buildLeagueIntelligenceRows(analyses);
  const reliable = rows.filter((row) => row.intelligenceStatus === "Reliable");
  const stable = rows.filter((row) => row.intelligenceStatus === "Stable");
  const avoid = rows.filter((row) => row.intelligenceStatus === "Avoid");
  const volatile = rows.filter((row) => row.intelligenceStatus === "Volatile");

  return {
    rows,
    bestLeague: reliable[0] ?? stable[0] ?? rows[0] ?? null,
    avoidLeagues: avoid,
    cautionLeagues: [...volatile, ...avoid],
    reliableCount: reliable.length,
    trackedCount: rows.length,
  };
}
