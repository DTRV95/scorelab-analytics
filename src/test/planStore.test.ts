import { describe, expect, it } from "vitest";
import {
  buildStanding,
  combineOdds,
  combinedModelProb,
  openFixtureRefs,
  settleFromScores,
  type PlanBet,
  type PlanMember,
} from "@/lib/planStore";

const member: PlanMember = {
  plan_id: "plan",
  user_id: "u1",
  display_name: "David",
  starting_bankroll: 10,
};

function leg(overrides: Partial<PlanBet["legs"][number]> = {}) {
  return {
    match: "FC Porto vs SL Benfica",
    homeTeam: "FC Porto",
    awayTeam: "SL Benfica",
    league: "Liga Portugal",
    market: "Casa",
    odds: 2,
    modelProb: 60,
    fixtureId: 1,
    kickoff: null,
    status: "pending" as const,
    ...overrides,
  };
}

function bet(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: "b1",
    userId: "u1",
    legs: [leg()],
    odds: 2,
    stake: 5,
    day: 1,
    status: "green",
    profitLoss: 5,
    placedAt: "2026-09-21T10:00:00.000Z",
    settledAt: "2026-09-21T20:00:00.000Z",
    ...overrides,
  };
}

const scores = (entries: [number, [number, number]][]) =>
  new Map(entries.map(([id, [h, a]]) => [id, { homeGoals: h, awayGoals: a }]));

describe("a player's standing", () => {
  it("builds the bankroll from the results, so it cannot drift", () => {
    const standing = buildStanding(member, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({ id: "b2", stake: 7.5, odds: 1.85, profitLoss: 6.38, placedAt: "2026-09-22T10:00:00.000Z" }),
    ]);

    expect(standing.bankroll).toBe(21.38);
    expect(standing.greens).toBe(2);
    expect(standing.day).toBe(3);
  });

  it("leaves a pending bet out of the bankroll but shows what is at risk", () => {
    const standing = buildStanding(member, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({
        id: "b2",
        status: "pending",
        stake: 7.5,
        profitLoss: 0,
        settledAt: null,
        placedAt: "2026-09-22T10:00:00.000Z",
      }),
    ]);

    expect(standing.bankroll).toBe(15);
    expect(standing.openStake).toBe(7.5);
    expect(standing.settled).toBe(1);
  });

  it("counts losses since the last win, not losses in total", () => {
    const red = (id: string, placedAt: string) =>
      bet({ id, status: "red", profitLoss: -5, placedAt });

    const broken = buildStanding(member, [
      red("b1", "2026-09-21T10:00:00.000Z"),
      bet({ id: "b2", placedAt: "2026-09-22T10:00:00.000Z" }),
      red("b3", "2026-09-23T10:00:00.000Z"),
      red("b4", "2026-09-24T10:00:00.000Z"),
    ]);

    expect(broken.reds).toBe(3);
    expect(broken.lossStreak).toBe(2);
  });

  it("only counts the bets belonging to that player", () => {
    const standing = buildStanding(member, [
      bet({ id: "b1" }),
      bet({ id: "b2", userId: "u2", profitLoss: 999 }),
    ]);

    expect(standing.bets).toHaveLength(1);
    expect(standing.bankroll).toBe(15);
  });

  it("starts a player who has not bet yet at the plan's opening stake", () => {
    const standing = buildStanding(member, []);

    expect(standing.bankroll).toBe(10);
    expect(standing.day).toBe(1);
    expect(standing.lossStreak).toBe(0);
  });
});

describe("a day made of several games", () => {
  it("multiplies the prices, so short odds add up to the plan's line", () => {
    // Three games at 1.25 is the 1.95 the plan asks for, reached another way.
    expect(combineOdds([{ odds: 1.25 }, { odds: 1.25 }, { odds: 1.25 }])).toBe(1.95);
    expect(combineOdds([{ odds: 1.85 }])).toBe(1.85);
    expect(combineOdds([])).toBe(0);
  });

  it("multiplies the model's own chances the same way", () => {
    expect(combinedModelProb([{ modelProb: 50 }, { modelProb: 50 }])).toBe(25);
  });

  it("lists every fixture the open days are waiting on, once each", () => {
    const open = bet({
      id: "open",
      status: "pending",
      legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 2, league: "Liga Portugal" })],
    });
    const done = bet({ id: "done", legs: [leg({ fixtureId: 3 })] });

    expect(openFixtureRefs([open, done])).toEqual([
      { id: 1, league: "Liga Portugal" },
      { id: 2, league: "Liga Portugal" },
    ]);
  });
});

describe("settling a day", () => {
  it("pays out when every game lands", () => {
    const settled = settleFromScores(
      bet({
        status: "pending",
        profitLoss: 0,
        odds: 4,
        legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 2, market: "Fora" })],
      }),
      scores([
        [1, [2, 0]],
        [2, [0, 1]],
      ])
    );

    expect(settled?.status).toBe("green");
    expect(settled?.profitLoss).toBe(15);
    expect(settled?.legs.every((entry) => entry.status === "green")).toBe(true);
  });

  it("loses the day on one failed game", () => {
    const settled = settleFromScores(
      bet({
        status: "pending",
        profitLoss: 0,
        legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 2 })],
      }),
      scores([
        [1, [2, 0]],
        [2, [0, 1]],
      ])
    );

    expect(settled?.status).toBe("red");
    expect(settled?.profitLoss).toBe(-5);
    expect(settled?.legs.map((entry) => entry.status)).toEqual(["green", "red"]);
  });

  it("waits for a game that has not been played", () => {
    const settled = settleFromScores(
      bet({ status: "pending", legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 9 })] }),
      scores([[1, [2, 0]]])
    );

    expect(settled).toBeNull();
  });

  it("leaves a market a score cannot decide alone", () => {
    const settled = settleFromScores(
      bet({ status: "pending", legs: [leg({ market: "Handicap Asiático +1.5" })] }),
      scores([[1, [2, 0]]])
    );

    expect(settled).toBeNull();
  });
});
