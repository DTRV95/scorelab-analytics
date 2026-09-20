import { describe, expect, it } from "vitest";
import { buildBetFromBoard, edgeFor, suggestStake } from "@/lib/betFromBoard";
import { isGreenMarket } from "@/lib/modelAudit";
import { analysesAwaitingResults } from "@/lib/resultsSync";
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
      { mercado: "Empate", grupo: "Resultado", probabilidade_pct: 24, min_pct: 20, max_pct: 28 },
      { mercado: "Menos de 3.5 Golos", grupo: "Golos", probabilidade_pct: 71.1, min_pct: 66, max_pct: 76 },
    ],
    ...overrides,
  };
}

describe("buildBetFromBoard", () => {
  it("carries the fixture reference so results sync can settle it unattended", () => {
    const bet = buildBetFromBoard({
      match: boardMatch(),
      market: "Casa",
      odds: 2.0,
      stake: 25,
      bankroll: 1000,
    });

    expect(bet.fixture).toEqual({
      id: 9001,
      league: "Liga Portugal",
      kickoff: "2026-09-21T19:00:00Z",
    });
    // A placed, unsettled bet on a known fixture is exactly what the sync
    // looks for — without this the bet would stay pending forever.
    expect(analysesAwaitingResults([bet])).toHaveLength(1);
  });

  it("prices the bet against the forecast instead of storing zeros", () => {
    const bet = buildBetFromBoard({
      match: boardMatch(),
      market: "Casa",
      odds: 2.0,
      stake: 25,
      bankroll: 1000,
    });
    const [result] = bet.results;

    // 60% model vs 50% implied by an evens price.
    expect(result.modelProb).toBe(60);
    expect(result.impliedProb).toBe(50);
    expect(result.valueBet).toBe(10);
    expect(result.kelly).toBeGreaterThan(0);
    expect(result.decision).toBe("Bet");
  });

  it("calls a priced-out market no bet rather than inventing an edge", () => {
    const bet = buildBetFromBoard({
      match: boardMatch(),
      market: "Empate",
      odds: 3.0,
      stake: 10,
      bankroll: 1000,
    });
    const [result] = bet.results;

    // 24% model against 33.3% implied: the book is asking too little.
    expect(result.valueBet).toBeLessThan(0);
    expect(result.decision).toBe("No Bet");
    expect(result.kelly).toBe(0);
  });

  it("starts pending, with the stake and odd the user typed", () => {
    const bet = buildBetFromBoard({
      match: boardMatch(),
      market: "Menos de 3.5 Golos",
      odds: 1.55,
      stake: 12.5,
      bankroll: 940,
    });

    expect(bet.tracking.betPlaced).toBe(true);
    expect(bet.tracking.resultStatus).toBe("pending");
    expect(bet.tracking.selectedMarket).toBe("Menos de 3.5 Golos");
    expect(bet.tracking.oddUsed).toBe(1.55);
    expect(bet.tracking.stakeUsed).toBe(12.5);
    expect(bet.tracking.bankrollBefore).toBe(940);
  });

  it("only offers markets a final score can actually settle", () => {
    const markets = boardMatch().mercados.map((m) => m.mercado);

    markets.forEach((market) => {
      // 2-1: every board market must resolve to a definite green or red.
      expect(isGreenMarket(market, 2, 1)).not.toBeNull();
    });
  });
});

describe("staking helpers", () => {
  it("scales the suggestion with the bankroll", () => {
    expect(suggestStake(60, 2.0, 1000)).toBeGreaterThan(suggestStake(60, 2.0, 500));
  });

  it("suggests nothing when there is no edge or no bankroll", () => {
    expect(suggestStake(40, 2.0, 1000)).toBe(0);
    expect(suggestStake(60, 2.0, null)).toBe(0);
  });

  it("reads edge straight off the price", () => {
    expect(edgeFor(55, 2.0)).toBe(5);
    expect(edgeFor(50, 2.5)).toBe(10);
  });
});
