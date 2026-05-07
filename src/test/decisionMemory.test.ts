import { describe, expect, it } from "vitest";
import {
  buildDecisionMemorySnapshot,
  buildPostBetTruth,
} from "@/lib/decisionMemory";
import type { AnalysisResult } from "@/types/analysis";

const result: AnalysisResult = {
  market: "Over 2.5",
  odds: 1.8,
  modelProb: 72,
  impliedProb: 55.6,
  valueBet: 16.4,
  kelly: 4,
  stake: 5,
  risk: "Low",
  confidence: 8,
  decision: "Bet",
  tier: "premium",
};

describe("decisionMemory", () => {
  it("captures the decision context at placement time", () => {
    const memory = buildDecisionMemorySnapshot({
      result,
      tracking: {
        oddUsed: 1.75,
        qualityScore: 88,
        qualityLabel: "Premium",
      },
      capturedAt: "2026-05-07T10:00:00.000Z",
    });

    expect(memory).toMatchObject({
      market: "Over 2.5",
      odds: 1.75,
      edge: 16.4,
      qualityScore: 88,
      qualityLabel: "Premium",
    });
  });

  it("separates a good losing decision from a bad decision", () => {
    const goodLoss = buildPostBetTruth({
      status: "red",
      memory: {
        market: "Over 2.5",
        modelProb: 72,
        impliedProb: 55.6,
        edge: 16.4,
        confidence: 8,
        odds: 1.75,
        risk: "Low",
        decision: "Bet",
        tier: "premium",
        qualityScore: 88,
        qualityLabel: "Premium",
        capturedAt: "2026-05-07T10:00:00.000Z",
      },
      profitLoss: -5,
    });

    expect(goodLoss?.verdict).toBe("Good Decision");
    expect(goodLoss?.tone).toBe("positive");
  });

  it("flags a weak green as a bad win", () => {
    const badWin = buildPostBetTruth({
      status: "green",
      memory: {
        market: "Draw",
        modelProb: 31,
        impliedProb: 29,
        edge: 2,
        confidence: 4,
        odds: 3.4,
        risk: "High",
        decision: "Caution",
        tier: "watchlist",
        qualityScore: 42,
        qualityLabel: "Avoid",
        capturedAt: "2026-05-07T10:00:00.000Z",
      },
      profitLoss: 12,
    });

    expect(badWin?.verdict).toBe("Bad Win");
    expect(badWin?.tone).toBe("negative");
  });
});
