import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/persistenceSync", () => ({
  persistAnalysisRecord: vi.fn(),
  deleteAnalysisRecord: vi.fn(),
  persistMultipleRecord: vi.fn(),
  deleteMultipleRecord: vi.fn(),
  queueEntitySync: vi.fn(),
}));

import { createEmptyTracking, overwriteAnalyses } from "@/lib/analysisStorage";
import {
  buildCalibrationModel,
  calibrateOpportunity,
} from "@/lib/calibrationEngine";
import type { AnalysisResult, BetStatus, SavedAnalysis } from "@/types/analysis";

const run = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

function settled(
  id: string,
  market: string,
  status: Exclude<BetStatus, "pending">
): SavedAnalysis {
  const result: AnalysisResult = {
    market,
    odds: 2,
    modelProb: 70,
    impliedProb: 50,
    valueBet: 20,
    kelly: 5,
    stake: 20,
    risk: "Medium",
    confidence: 7,
    decision: "Bet",
  };

  return {
    id,
    createdAt: "2026-09-01T10:00:00.000Z",
    homeTeam: "Porto",
    awayTeam: "Benfica",
    league: "Liga Portugal",
    summary: { homeXg: 1.6, awayXg: 1.2, totalXg: 2.8, confidence: 7 },
    results: [result],
    tracking: {
      ...createEmptyTracking(),
      betPlaced: true,
      selectedMarket: market,
      stakeUsed: 20,
      oddUsed: 2,
      resultStatus: status,
      profitLoss: status === "green" ? 20 : -20,
      bankrollBefore: 1000,
      bankrollAfter: status === "green" ? 1020 : 980,
    },
  };
}

/**
 * Model Lab is unlisted: nothing in the app navigates to it. That has to cost
 * nothing, which is only true because the lab never drove the calibration —
 * it reads it. These check that the model is built from the tracked history
 * alone, so it keeps correcting itself with the page never once opened.
 */
describe("calibration with nobody watching", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("learns a market is overrated from settled bets alone", () => {
    // The model called 70% thirty times over and landed six of them.
    const history = [
      ...run(6).map((n) => settled(`w${n}`, "Over 2.5", "green")),
      ...run(24).map((n) => settled(`l${n}`, "Over 2.5", "red")),
    ];
    overwriteAnalyses(history);

    const calibrated = calibrateOpportunity(
      {
        league: "Liga Portugal",
        market: "Over 2.5",
        odds: 2,
        confidence: 7,
        modelProb: 70,
      },
      buildCalibrationModel(history)
    );

    expect(calibrated.rawProb).toBe(70);
    expect(calibrated.calibratedProb).toBeLessThan(70);
    expect(calibrated.stakeMultiplier).toBeLessThan(1);
    expect(["Caution", "Avoid"]).toContain(calibrated.label);
    expect(calibrated.reasons[0]).toMatch(/actual vs .* expected/);
  });

  it("leaves a market that is landing as forecast alone", () => {
    const history = [
      ...run(21).map((n) => settled(`w${n}`, "Over 2.5", "green")),
      ...run(9).map((n) => settled(`l${n}`, "Over 2.5", "red")),
    ];
    overwriteAnalyses(history);

    const calibrated = calibrateOpportunity(
      {
        league: "Liga Portugal",
        market: "Over 2.5",
        odds: 2,
        confidence: 7,
        modelProb: 70,
      },
      buildCalibrationModel(history)
    );

    expect(calibrated.calibratedProb).toBeGreaterThanOrEqual(70);
    expect(calibrated.label).not.toBe("Avoid");
  });

  it("says it is still learning rather than inventing a correction", () => {
    const history = [settled("w1", "Over 2.5", "green")];
    overwriteAnalyses(history);

    const calibrated = calibrateOpportunity(
      {
        league: "Liga Portugal",
        market: "Over 2.5",
        odds: 2,
        confidence: 7,
        modelProb: 70,
      },
      buildCalibrationModel(history)
    );

    expect(calibrated.calibratedProb).toBe(70);
    expect(calibrated.label).toBe("Learning");
  });
});
