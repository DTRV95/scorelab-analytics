import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/persistenceSync", () => ({
  persistAnalysisRecord: vi.fn(),
  deleteAnalysisRecord: vi.fn(),
  queueEntitySync: vi.fn(),
}));

import {
  applyFixtureResults,
  createEmptyTracking,
  getAnalyses,
  overwriteAnalyses,
} from "@/lib/analysisStorage";
import {
  analysesAwaitingResults,
  buildResultsPlan,
  type FixtureResult,
} from "@/lib/resultsSync";
import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";

function marketResult(market: string): AnalysisResult {
  return {
    market,
    odds: 2,
    modelProb: 55,
    impliedProb: 50,
    valueBet: 5,
    kelly: 2,
    stake: 20,
    risk: "Medium",
    confidence: 60,
    decision: "Bet",
  };
}

function analysis(overrides: Partial<SavedAnalysis> = {}): SavedAnalysis {
  return {
    id: "a1",
    createdAt: "2026-09-01T10:00:00.000Z",
    homeTeam: "Porto",
    awayTeam: "Benfica",
    league: "Liga Portugal",
    fixture: { id: 501, league: "Liga Portugal", kickoff: "2026-09-02T19:00:00Z" },
    summary: { homeXg: 1.6, awayXg: 1.2, totalXg: 2.8, confidence: 60 },
    results: [marketResult("Over 2.5"), marketResult("BTTS Yes")],
    tracking: {
      ...createEmptyTracking(),
      betPlaced: true,
      selectedMarket: "Over 2.5",
      stakeUsed: 20,
      oddUsed: 2,
      bankrollBefore: 1000,
      bankrollAfter: 1000,
    },
    ...overrides,
  };
}

function result(overrides: Partial<FixtureResult> = {}): FixtureResult {
  return {
    fixture_id: 501,
    status: "FINISHED",
    finished: true,
    home_goals: 2,
    away_goals: 1,
    kickoff: "2026-09-02T19:00:00Z",
    home_name: "Porto",
    away_name: "Benfica",
    ...overrides,
  };
}

describe("results sync", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("only chases fixtures that are still waiting on something", () => {
    const pending = analysis();
    const done = analysis({
      id: "a2",
      modelAudit: {
        homeGoals: 2,
        awayGoals: 1,
        auditedAt: "2026-09-03T08:00:00.000Z",
        outcomes: [],
      },
      tracking: { ...createEmptyTracking(), betPlaced: false },
    });
    const manual = analysis({ id: "a3", fixture: null });

    const awaiting = analysesAwaitingResults([pending, done, manual]);

    expect(awaiting.map((item) => item.id)).toEqual(["a1"]);
  });

  it("settles a winning bet and leaves the score on the analysis", () => {
    overwriteAnalyses([analysis()]);

    const results = new Map([[501, result()]]);
    const plan = buildResultsPlan(getAnalyses(), results);

    expect(plan.finished).toBe(1);
    expect(plan.scores).toEqual([
      { analysisId: "a1", homeGoals: 2, awayGoals: 1 },
    ]);
    expect(plan.settlements).toHaveLength(1);
    expect(plan.settlements[0]).toMatchObject({
      market: "Over 2.5",
      resultStatus: "green",
      profitLoss: 20,
    });

    applyFixtureResults({
      scores: plan.scores,
      settlements: plan.settlements.map((item) => ({
        analysisId: item.analysisId,
        betId: item.betId,
        resultStatus: item.resultStatus,
      })),
    });

    const [stored] = getAnalyses();
    expect(stored.modelAudit?.homeGoals).toBe(2);
    expect(stored.tracking.resultStatus).toBe("green");
    expect(stored.tracking.profitLoss).toBe(20);
    expect(stored.tracking.bankrollAfter).toBe(1020);
    expect(stored.tracking.settledAt).toBeTruthy();
  });

  it("marks a losing bet red and takes the stake off the bankroll", () => {
    overwriteAnalyses([analysis()]);

    const plan = buildResultsPlan(
      getAnalyses(),
      new Map([[501, result({ home_goals: 1, away_goals: 0 })]])
    );

    expect(plan.settlements[0]).toMatchObject({
      resultStatus: "red",
      profitLoss: -20,
    });

    applyFixtureResults({
      scores: plan.scores,
      settlements: plan.settlements.map((item) => ({
        analysisId: item.analysisId,
        betId: item.betId,
        resultStatus: item.resultStatus,
      })),
    });

    const [stored] = getAnalyses();
    expect(stored.tracking.resultStatus).toBe("red");
    expect(stored.tracking.bankrollAfter).toBe(980);
  });

  it("never settles a fixture that has not been played", () => {
    overwriteAnalyses([analysis()]);

    const plan = buildResultsPlan(
      getAnalyses(),
      new Map([
        [
          501,
          result({
            status: "TIMED",
            finished: false,
            home_goals: null,
            away_goals: null,
          }),
        ],
      ])
    );

    expect(plan.pending).toBe(1);
    expect(plan.scores).toHaveLength(0);
    expect(plan.settlements).toHaveLength(0);
  });

  it("leaves markets a score cannot decide to the user", () => {
    overwriteAnalyses([
      analysis({
        tracking: {
          ...createEmptyTracking(),
          betPlaced: true,
          selectedMarket: "Cantos +9.5",
          stakeUsed: 20,
          oddUsed: 2,
          bankrollBefore: 1000,
          bankrollAfter: 1000,
        },
      }),
    ]);

    const plan = buildResultsPlan(getAnalyses(), new Map([[501, result()]]));

    expect(plan.settlements).toHaveLength(0);
    expect(plan.manual).toEqual([
      { match: "Porto vs Benfica", market: "Cantos +9.5" },
    ]);
  });

  it("does not touch a bet that was already settled by hand", () => {
    overwriteAnalyses([
      analysis({
        tracking: {
          ...createEmptyTracking(),
          betPlaced: true,
          selectedMarket: "Over 2.5",
          stakeUsed: 20,
          oddUsed: 2,
          resultStatus: "void",
          bankrollBefore: 1000,
          bankrollAfter: 1000,
        },
      }),
    ]);

    const plan = buildResultsPlan(getAnalyses(), new Map([[501, result()]]));

    expect(plan.settlements).toHaveLength(0);
    // The score is still worth recording: it feeds the model audit.
    expect(plan.scores).toHaveLength(1);
  });
});
