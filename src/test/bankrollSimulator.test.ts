import { describe, expect, it } from "vitest";

import { simulateBankrollMission } from "@/lib/bankrollSimulator";

describe("simulateBankrollMission", () => {
  it("keeps success metrics numeric when mission inputs become invalid", () => {
    const result = simulateBankrollMission({
      currentBankroll: 73,
      targetBankroll: 150,
      daysRemaining: 30,
      dailyStakeCap: 0,
      dailyProfitTarget: Number.NaN,
      hitRatePct: Number.NaN,
      averageOdds: Number.NaN,
      simulations: Number.NaN,
    });

    expect(Number.isFinite(result.successRatePct)).toBe(true);
    expect(Number.isFinite(result.rawSuccessRatePct)).toBe(true);
    expect(Number.isFinite(result.planFeasibilityPct)).toBe(true);
    expect(Number.isFinite(result.dailyProfitCoveragePct)).toBe(true);
    expect(Number.isFinite(result.targetGapCoveragePct)).toBe(true);
    expect(result.simulations).toBeGreaterThanOrEqual(250);
  });

  it("keeps success chance visible when the target is already reached", () => {
    const result = simulateBankrollMission({
      currentBankroll: 160,
      targetBankroll: 150,
      daysRemaining: 30,
      dailyStakeCap: 0,
      dailyProfitTarget: 0,
      hitRatePct: 80,
      averageOdds: 1.55,
    });

    expect(result.successRatePct).toBe(100);
    expect(result.daysToTargetMedian).toBe(0);
    expect(result.recommendation.label).toBe("Proceed");
  });

  it("keeps Monte Carlo success separate from plan feasibility", () => {
    const result = simulateBankrollMission({
      currentBankroll: 99,
      targetBankroll: 100,
      daysRemaining: 30,
      dailyStakeCap: 10,
      dailyProfitTarget: 1,
      hitRatePct: 58,
      averageOdds: 1.2,
      simulations: 1000,
    });

    expect(result.planFeasibilityPct).toBe(0);
    expect(result.successRatePct).toBeGreaterThan(0);
  });

  it("improves success chance when the same mission gets more days", () => {
    const shortMission = simulateBankrollMission({
      currentBankroll: 60,
      targetBankroll: 150,
      daysRemaining: 10,
      dailyStakeCap: 18,
      dailyProfitTarget: 7.2,
      hitRatePct: 75,
      averageOdds: 1.55,
      simulations: 1000,
    });
    const extendedMission = simulateBankrollMission({
      currentBankroll: 60,
      targetBankroll: 150,
      daysRemaining: 30,
      dailyStakeCap: 18,
      dailyProfitTarget: 2.35,
      hitRatePct: 75,
      averageOdds: 1.55,
      simulations: 1000,
    });

    expect(extendedMission.successRatePct).toBeGreaterThan(shortMission.successRatePct);
  });
});
