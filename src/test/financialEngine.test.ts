import { describe, expect, it } from "vitest";
import { buildFinancialSnapshot } from "@/lib/financialEngine";

describe("financialEngine", () => {
  it("computes bankroll stats from settled and pending singles and multiples", () => {
    const snapshot = buildFinancialSnapshot({
      initialBankroll: 100,
      analyses: [
        {
          createdAt: "2026-04-20T10:00:00.000Z",
          tracking: {
            betPlaced: true,
            stakeUsed: 10,
            oddUsed: 2,
            resultStatus: "green",
            settledAt: "2026-04-21T12:00:00.000Z",
            profitLoss: 10,
          },
        },
        {
          createdAt: "2026-04-20T12:00:00.000Z",
          tracking: {
            betPlaced: true,
            stakeUsed: 5,
            oddUsed: 1.8,
            resultStatus: "pending",
            settledAt: null,
            profitLoss: 0,
          },
        },
      ],
      multiples: [
        {
          createdAt: "2026-04-20T14:00:00.000Z",
          combinedOdds: 3.2,
          tracking: {
            betPlaced: true,
            stakeUsed: 8,
            oddUsed: 3.2,
            resultStatus: "red",
            settledAt: "2026-04-21T18:00:00.000Z",
            profitLoss: -8,
          },
        },
        {
          createdAt: "2026-04-21T09:00:00.000Z",
          combinedOdds: 2.4,
          tracking: {
            betPlaced: true,
            stakeUsed: 12,
            oddUsed: null,
            resultStatus: "pending",
            settledAt: null,
            profitLoss: 0,
          },
        },
      ],
    });

    expect(snapshot.stats.totalProfitLoss).toBe(2);
    expect(snapshot.stats.totalStaked).toBe(35);
    expect(snapshot.stats.totalGreens).toBe(1);
    expect(snapshot.stats.totalReds).toBe(1);
    expect(snapshot.stats.totalPending).toBe(2);
    expect(snapshot.stats.hitRate).toBe(50);
    expect(snapshot.stats.roi).toBeCloseTo(5.71, 2);
    expect(snapshot.openExposure).toBe(17);
    expect(snapshot.stats.currentBankroll).toBe(85);
  });

  it("groups daily performance by placed date, not settled date", () => {
    const snapshot = buildFinancialSnapshot({
      initialBankroll: 50,
      analyses: [
        {
          createdAt: "2026-04-19T10:00:00.000Z",
          tracking: {
            betPlaced: true,
            placedAt: "2026-04-20T10:00:00.000Z",
            stakeUsed: 10,
            oddUsed: 2,
            resultStatus: "green",
            settledAt: "2026-04-21T11:00:00.000Z",
            profitLoss: 10,
          },
        },
      ],
      multiples: [
        {
          createdAt: "2026-04-19T12:00:00.000Z",
          combinedOdds: 2.5,
          tracking: {
            betPlaced: true,
            placedAt: "2026-04-20T12:00:00.000Z",
            stakeUsed: 6,
            oddUsed: 2.5,
            resultStatus: "red",
            settledAt: "2026-04-21T20:00:00.000Z",
            profitLoss: -6,
          },
        },
      ],
    });

    expect(snapshot.dailyPerformance).toHaveLength(1);
    expect(snapshot.dailyPerformance[0]).toMatchObject({
      date: "2026-04-20",
      startBankroll: 50,
      endBankroll: 54,
      profitLoss: 4,
      settledBets: 2,
    });
  });

  it("falls back to created date for legacy placed bets without placedAt", () => {
    const snapshot = buildFinancialSnapshot({
      initialBankroll: 50,
      analyses: [
        {
          createdAt: "2026-04-19T10:00:00.000Z",
          tracking: {
            betPlaced: true,
            stakeUsed: 10,
            oddUsed: 2,
            resultStatus: "green",
            settledAt: "2026-04-21T11:00:00.000Z",
            profitLoss: 10,
          },
        },
      ],
      multiples: [],
    });

    expect(snapshot.dailyPerformance).toHaveLength(1);
    expect(snapshot.dailyPerformance[0]).toMatchObject({
      date: "2026-04-19",
      profitLoss: 10,
      settledBets: 1,
    });
  });

  it("uses combined odds as pending potential profit fallback", () => {
    const snapshot = buildFinancialSnapshot({
      initialBankroll: 40,
      analyses: [],
      multiples: [
        {
          createdAt: "2026-04-21T09:00:00.000Z",
          combinedOdds: 2.5,
          tracking: {
            betPlaced: true,
            stakeUsed: 10,
            oddUsed: null,
            resultStatus: "pending",
            settledAt: null,
            profitLoss: 0,
          },
        },
      ],
    });

    expect(snapshot.openPotentialProfit).toBe(15);
  });
});
