import { describe, expect, it } from "vitest";

import { getMarketPerformance } from "@/lib/portofolioEngine";
import type { SavedAnalysis } from "@/types/analysis";

function makeAnalysis(
  id: string,
  resultStatus: "green" | "red" | "void",
  profitLoss: number
): SavedAnalysis {
  return {
    id,
    createdAt: `2026-04-2${id}T10:00:00.000Z`,
    league: "Test League",
    homeTeam: "Home",
    awayTeam: "Away",
    summary: {
      totalXg: 2,
      avgPossession: 50,
      totalShots: 20,
      totalShotsOnTarget: 8,
      avgPassAccuracy: 80,
      disciplineScore: 0,
    },
    results: [
      {
        market: "Over 2.5",
        odds: 2,
        probability: 55,
        impliedProbability: 50,
        valueBet: 5,
        confidence: 7,
        tier: "bet",
        risk: "Medium",
        edgeLowerBound: 2,
        robustness: 70,
        decision: "bet",
      },
    ],
    tracking: {
      id: "primary",
      betPlaced: true,
      selectedMarket: "Over 2.5",
      stakeUsed: 10,
      oddUsed: 2,
      resultStatus,
      placedAt: `2026-04-2${id}T10:00:00.000Z`,
      settledAt: `2026-04-2${id}T12:00:00.000Z`,
      profitLoss,
      bankrollBefore: null,
      bankrollAfter: null,
      qualityScore: null,
      qualityLabel: null,
      qualityTone: null,
      qualitySummary: null,
      qualitySnapshotAt: null,
      decisionMemory: null,
      postBetTruth: null,
      notes: "",
    },
    extraBets: [],
  } as SavedAnalysis;
}

describe("portofolioEngine", () => {
  it("excludes void bets from hit-rate denominator", () => {
    const rows = getMarketPerformance([
      makeAnalysis("0", "green", 10),
      makeAnalysis("1", "red", -10),
      makeAnalysis("2", "void", 0),
    ]);

    expect(rows[0]).toMatchObject({
      market: "Over 2.5",
      bets: 3,
      wins: 1,
      losses: 1,
      voids: 1,
      hitRate: 50,
    });
  });
});
