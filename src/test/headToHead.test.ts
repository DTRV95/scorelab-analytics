import { describe, expect, it } from "vitest";
import { aheadOn, duel, tally, MIN_SETTLED } from "@/lib/headToHead";
import type { PlanBet, PlayerStanding } from "@/lib/planStore";

function bet(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: "b",
    userId: "u1",
    legs: [],
    odds: 1.9,
    stake: 5,
    day: 1,
    status: "green",
    profitLoss: 4.5,
    placedAt: "2026-09-20T10:00:00.000Z",
    settledAt: "2026-09-20T20:00:00.000Z",
    ...overrides,
  };
}

function standing(overrides: Partial<PlayerStanding> = {}): PlayerStanding {
  return {
    userId: "u1",
    name: "David",
    bankroll: 10,
    startingBankroll: 10,
    added: 0,
    profit: 0,
    bets: [],
    settled: 0,
    greens: 0,
    reds: 0,
    lossStreak: 0,
    day: 1,
    openBets: 0,
    openStake: 0,
    lastSettled: null,
    ...overrides,
  };
}

describe("one player's record", () => {
  it("counts only what was staked on days already decided", () => {
    const entry = tally(
      standing({
        bets: [bet({ stake: 5 }), bet({ stake: 7.5, status: "pending" })],
        profit: 4.5,
      })
    );

    expect(entry.staked).toBe(5);
  });

  it("turns profit and stake into profit per euro", () => {
    const entry = tally(
      standing({ bets: [bet({ stake: 10 })], profit: 2.5 })
    );

    expect(entry.roi).toBe(25);
  });

  it("has nothing to divide by before anything is staked", () => {
    expect(tally(standing()).roi).toBeNull();
    expect(tally(standing()).hitRate).toBeNull();
    expect(tally(standing()).bestOdds).toBeNull();
  });

  it("remembers the best run, not just the one still going", () => {
    const entry = tally(
      standing({
        bets: [
          bet({ status: "green" }),
          bet({ status: "green" }),
          bet({ status: "green" }),
          bet({ status: "red" }),
          bet({ status: "green" }),
        ],
      })
    );

    expect(entry.bestStreak).toBe(3);
  });

  it("keeps the best price that actually landed, ignoring the ones that fell", () => {
    const entry = tally(
      standing({
        bets: [bet({ odds: 2.4, status: "red" }), bet({ odds: 1.95 })],
      })
    );

    expect(entry.bestOdds).toBe(1.95);
  });
});

describe("the two of them side by side", () => {
  const david = standing({
    userId: "david",
    name: "David",
    profit: 12,
    settled: 6,
    greens: 4,
    bets: [bet({ stake: 10 })],
  });
  const irmao = standing({
    userId: "irmao",
    name: "Irmão",
    profit: 20,
    settled: 6,
    greens: 3,
    bets: [bet({ stake: 40 })],
  });

  it("puts whoever is up on the money in front", () => {
    const result = duel([david, irmao]);

    expect(result.leader?.name).toBe("Irmão");
    expect(result.margin).toBe(8);
  });

  it("still shows who is judging games better, staking aside", () => {
    // €20 off €40 staked is worse betting than €12 off €10, even though it is
    // more money — which is exactly why profit alone cannot be the whole card.
    const result = duel([david, irmao]);

    expect(aheadOn(result.tallies, (entry) => entry.roi)).toBe("david");
    expect(aheadOn(result.tallies, (entry) => entry.profit)).toBe("irmao");
  });

  it("crowns nobody when they are level", () => {
    const result = duel([david, { ...david, userId: "irmao", name: "Irmão" }]);

    expect(result.leader).toBeNull();
  });

  it("says it is too early while the days are few", () => {
    expect(duel([david, irmao]).early).toBe(false);
    expect(
      duel([
        { ...david, settled: MIN_SETTLED - 1 },
        irmao,
      ]).early
    ).toBe(true);
  });

  it("is always too early with nobody to compare against", () => {
    expect(duel([david]).early).toBe(true);
  });
});

describe("who leads one measure", () => {
  it("returns nobody on a tie", () => {
    const tallies = [
      tally(standing({ userId: "a", bets: [bet({ stake: 10 })], profit: 1 })),
      tally(standing({ userId: "b", bets: [bet({ stake: 10 })], profit: 1 })),
    ];

    expect(aheadOn(tallies, (entry) => entry.roi)).toBeNull();
  });

  it("skips whoever has no number yet", () => {
    const tallies = [
      tally(standing({ userId: "a" })),
      tally(standing({ userId: "b", bets: [bet({ stake: 10 })], profit: 1 })),
    ];

    expect(aheadOn(tallies, (entry) => entry.roi)).toBe("b");
  });
});
