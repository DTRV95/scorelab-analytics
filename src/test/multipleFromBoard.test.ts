import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/persistenceSync", () => ({
  persistAnalysisRecord: vi.fn(),
  deleteAnalysisRecord: vi.fn(),
  persistMultipleRecord: vi.fn(),
  deleteMultipleRecord: vi.fn(),
  queueEntitySync: vi.fn(),
}));

import { boardLegId, buildLegFromBoard } from "@/lib/betFromBoard";
import { isGreenMarket } from "@/lib/modelAudit";
import {
  addLegToMultipleDraft,
  clearMultipleDraft,
  getMultipleMetrics,
  saveMultipleFromDraft,
  settleMultiples,
  type MultipleLeg,
} from "@/lib/multipleStorage";
import {
  buildMultipleSettlements,
  fixtureRefs,
  multiplesAwaitingResults,
  type FixtureResult,
} from "@/lib/resultsSync";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

function boardMatch(overrides: Partial<BoardMatch> = {}): BoardMatch {
  return {
    fixture_id: 9001,
    league: "Liga Portugal",
    home_name: "FC Porto",
    away_name: "SL Benfica",
    kickoff: "2026-09-21T19:00:00Z",
    headline_market: "Menos de 3.5 Golos",
    headline_pct: 71.1,
    amostra_pct: 82,
    amostra_label: "Alta",
    lambda_casa: 1.62,
    lambda_fora: 1.18,
    total_golos_esperados: 2.8,
    mercados: [
      { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 60, min_pct: 54, max_pct: 66 },
      { mercado: "Ambas Marcam", grupo: "Ambas", probabilidade_pct: 57, min_pct: 51, max_pct: 63 },
      { mercado: "Menos de 3.5 Golos", grupo: "Golos", probabilidade_pct: 71.1, min_pct: 66, max_pct: 76 },
    ],
    ...overrides,
  };
}

function finished(
  fixtureId: number,
  homeGoals: number,
  awayGoals: number
): FixtureResult {
  return {
    fixture_id: fixtureId,
    status: "FINISHED",
    finished: true,
    home_goals: homeGoals,
    away_goals: awayGoals,
    kickoff: "2026-09-21T19:00:00Z",
    home_name: "A",
    away_name: "B",
  };
}

function placeMultiple(legs: MultipleLeg[], stake = 10) {
  clearMultipleDraft();
  legs.forEach((leg) => addLegToMultipleDraft(leg));
  const saved = saveMultipleFromDraft(stake);
  if (!saved) throw new Error("multiple was not saved");
  return saved;
}

const porto = buildLegFromBoard({
  match: boardMatch(),
  market: "Casa",
  odds: 1.8,
});

const sporting = buildLegFromBoard({
  match: boardMatch({
    fixture_id: 9002,
    home_name: "Sporting CP",
    away_name: "SC Braga",
    league: "Liga Portugal",
  }),
  market: "Ambas Marcam",
  odds: 2.0,
});

describe("buildLegFromBoard", () => {
  it("carries the fixture so the leg can be closed by the API", () => {
    expect(porto.fixture).toEqual({
      id: 9001,
      league: "Liga Portugal",
      kickoff: "2026-09-21T19:00:00Z",
    });
    expect(porto.resultStatus).toBe("pending");
  });

  it("files two markets of one game under the same id, so correlation sees them", () => {
    const sameGame = buildLegFromBoard({
      match: boardMatch(),
      market: "Menos de 3.5 Golos",
      odds: 1.5,
    });

    expect(sameGame.analysisId).toBe(porto.analysisId);
    expect(sameGame.analysisId).toBe(boardLegId(9001));

    const metrics = getMultipleMetrics([porto, sameGame], 1000);
    expect(metrics.correlationLevel).not.toBe("Low");
    // Two selections from one match do not multiply out like two matches do.
    expect(metrics.combinedModelProb).toBeLessThan(60 * 0.711);
  });

  it("grades a board selection by its edge and never calls it elite", () => {
    // 60% model against a 1.8 price (55.6% implied) is a real but modest edge.
    expect(porto.tier).toBe("bet");
    expect(
      buildLegFromBoard({ match: boardMatch(), market: "Casa", odds: 1.5 }).tier
    ).toBe("discard");
  });
});

describe("multiple odds and return", () => {
  it("multiplies the legs into the combined odd", () => {
    const metrics = getMultipleMetrics([porto, sporting], 1000);
    expect(metrics.combinedOdds).toBe(3.6);
    // What the betslip shows as the return on a 10 € stake.
    expect(10 * metrics.combinedOdds).toBeCloseTo(36, 2);
  });
});

describe("settling a multiple from final scores", () => {
  beforeEach(() => {
    localStorage.clear();
    clearMultipleDraft();
  });

  it("looks up every fixture its legs came from", () => {
    const bet = placeMultiple([porto, sporting]);

    expect(multiplesAwaitingResults([bet])).toHaveLength(1);
    expect(fixtureRefs([], [bet])).toEqual([
      { id: 9001, league: "Liga Portugal" },
      { id: 9002, league: "Liga Portugal" },
    ]);
  });

  it("pays out only when every leg lands", () => {
    const bet = placeMultiple([porto, sporting], 10);

    const [preview] = buildMultipleSettlements(
      [bet],
      new Map([
        [9001, finished(9001, 2, 0)], // Casa: green
        [9002, finished(9002, 1, 1)], // Ambas Marcam: green
      ])
    );

    expect(preview.resultStatus).toBe("green");
    expect(preview.legCount).toBe(2);
    expect(preview.profitLoss).toBeCloseTo(10 * (3.6 - 1), 2);

    const [settled] = settleMultiples([
      { multipleId: preview.multipleId, legs: preview.legs },
    ]);
    expect(settled.tracking.resultStatus).toBe("green");
    expect(settled.tracking.profitLoss).toBeCloseTo(26, 2);
  });

  it("loses the whole bet on one failed leg", () => {
    const bet = placeMultiple([porto, sporting], 10);

    const [preview] = buildMultipleSettlements(
      [bet],
      new Map([
        [9001, finished(9001, 2, 0)], // Casa: green
        [9002, finished(9002, 1, 0)], // Ambas Marcam: red
      ])
    );

    expect(preview.resultStatus).toBe("red");
    expect(preview.profitLoss).toBe(-10);

    const [settled] = settleMultiples([
      { multipleId: preview.multipleId, legs: preview.legs },
    ]);
    expect(settled.tracking.resultStatus).toBe("red");
    expect(settled.tracking.profitLoss).toBe(-10);
  });

  it("waits for the last game instead of settling half a bet", () => {
    const bet = placeMultiple([porto, sporting], 10);

    const previews = buildMultipleSettlements(
      [bet],
      new Map([[9001, finished(9001, 2, 0)]])
    );

    expect(previews).toHaveLength(0);
  });

  it("leaves a multiple alone once it has been settled", () => {
    const bet = placeMultiple([porto, sporting], 10);
    const results = new Map([
      [9001, finished(9001, 2, 0)],
      [9002, finished(9002, 1, 1)],
    ]);

    const [preview] = buildMultipleSettlements([bet], results);
    const [settled] = settleMultiples([
      { multipleId: preview.multipleId, legs: preview.legs },
    ]);

    expect(buildMultipleSettlements([settled], results)).toHaveLength(0);
  });
});

describe("Portuguese double chance combos", () => {
  // These settle real money. Read only as goals lines, "1X e Menos de 3.5"
  // paid out on an away win.
  it("needs both halves of a 1X combo to land", () => {
    expect(isGreenMarket("1X e Menos de 3.5 Golos", 0, 1)).toBe(false);
    expect(isGreenMarket("1X e Menos de 3.5 Golos", 1, 1)).toBe(true);
    expect(isGreenMarket("1X e Menos de 3.5 Golos", 3, 2)).toBe(false);
  });

  it("needs both halves of a 2X combo to land", () => {
    expect(isGreenMarket("2X e Menos de 3.5 Golos", 1, 0)).toBe(false);
    expect(isGreenMarket("2X e Menos de 3.5 Golos", 0, 1)).toBe(true);
    expect(isGreenMarket("2X e Menos de 3.5 Golos", 2, 3)).toBe(false);
  });

  it("still settles the plain goals lines it shares wording with", () => {
    expect(isGreenMarket("Menos de 3.5 Golos", 3, 2)).toBe(false);
    expect(isGreenMarket("Menos de 3.5 Golos", 2, 1)).toBe(true);
    expect(isGreenMarket("Mais de 2.5 Golos", 2, 1)).toBe(true);
    expect(isGreenMarket("Mais de 3.5 Golos", 2, 1)).toBe(false);
  });

  it("leaves a handicap unsettled rather than reading it as a goals line", () => {
    // The lines are matched in words, so "+1.5" and "-3.5" cannot be mistaken
    // for over/under and end up paid out against the wrong event.
    expect(isGreenMarket("Handicap Asiático +1.5", 2, 1)).toBeNull();
    expect(isGreenMarket("Handicap -3.5", 2, 1)).toBeNull();
  });
});
