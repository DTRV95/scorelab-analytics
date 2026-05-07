import { describe, expect, it } from "vitest";

import {
  buildTrueEdgeValidationModel,
  evaluateTrueEdgeOpportunity,
} from "@/lib/trueEdgeValidation";
import type { BetStatus, SavedAnalysis } from "@/types/analysis";

function makeAnalysis({
  id,
  league = "Portugal Liga",
  market = "Over 2.5",
  modelProb = 70,
  odds = 1.7,
  status,
}: {
  id: number;
  league?: string;
  market?: string;
  modelProb?: number;
  odds?: number;
  status: BetStatus;
}): SavedAnalysis {
  const stake = 10;
  const profitLoss =
    status === "green" ? stake * (odds - 1) : status === "red" ? -stake : 0;

  return {
    id: String(id),
    createdAt: `2026-04-${String(id + 1).padStart(2, "0")}T10:00:00.000Z`,
    homeTeam: `Home ${id}`,
    awayTeam: `Away ${id}`,
    league,
    summary: {
      homeXg: 1.4,
      awayXg: 0.9,
      totalXg: 2.3,
      confidence: 7,
    },
    results: [
      {
        market,
        odds,
        modelProb,
        impliedProb: 100 / odds,
        valueBet: modelProb - 100 / odds,
        kelly: 4,
        stake,
        risk: "Medium",
        confidence: 7.6,
        decision: "Bet",
        tier: "bet",
      },
    ],
    tracking: {
      id: "primary",
      betPlaced: true,
      selectedMarket: market,
      stakeUsed: stake,
      oddUsed: odds,
      resultStatus: status,
      placedAt: `2026-04-${String(id + 1).padStart(2, "0")}T10:00:00.000Z`,
      settledAt: `2026-04-${String(id + 1).padStart(2, "0")}T12:00:00.000Z`,
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
  };
}

describe("trueEdgeValidation", () => {
  it("marks a segment as trusted only after enough profitable validation", () => {
    const analyses = Array.from({ length: 8 }, (_, index) =>
      makeAnalysis({ id: index, status: "green" })
    );
    const model = buildTrueEdgeValidationModel(analyses);
    const segment = model.segmentMap.get("league-market:portugal liga::over 2.5");

    expect(segment?.verdict).toBe("Trusted");
    expect(segment?.actualHitRate).toBe(100);
    expect(segment?.expectedHitRate).toBe(70);
    expect(model.bestSegment?.key).toBe("league-market:portugal liga::over 2.5");
  });

  it("flags a segment as avoid when real outcomes underperform the model", () => {
    const analyses = Array.from({ length: 6 }, (_, index) =>
      makeAnalysis({ id: index, status: "red", modelProb: 75 })
    );
    const model = buildTrueEdgeValidationModel(analyses);
    const segment = model.segmentMap.get("league-market:portugal liga::over 2.5");

    expect(segment?.verdict).toBe("Avoid");
    expect(segment?.calibrationGap).toBe(-75);
    expect(model.strongestWarning?.key).toBe("league-market:portugal liga::over 2.5");
  });

  it("evaluates a new opportunity from the relevant validated segments", () => {
    const analyses = Array.from({ length: 8 }, (_, index) =>
      makeAnalysis({ id: index, status: "green", modelProb: 72, odds: 1.75 })
    );
    const model = buildTrueEdgeValidationModel(analyses);
    const read = evaluateTrueEdgeOpportunity(
      {
        league: "Portugal Liga",
        market: "Over 2.5",
        modelProb: 74,
        odds: 1.76,
      },
      model
    );

    expect(read.verdict).toBe("Trusted");
    expect(read.confidence).toBeGreaterThan(0);
    expect(read.strongestSegment?.type).toBe("league-market");
  });
});
