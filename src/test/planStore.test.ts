import { describe, expect, it } from "vitest";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import {
  buildStanding,
  combineOdds,
  combinedModelProb,
  isManualLeg,
  openFixtureRefs,
  setLegStatus,
  settleFromScores,
  settleManually,
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
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({ id: "b2", stake: 7.5, odds: 1.85, profitLoss: 6.38, placedAt: "2026-09-22T10:00:00.000Z" }),
    ]);

    expect(standing.bankroll).toBe(21.38);
    expect(standing.greens).toBe(2);
    expect(standing.day).toBe(3);
  });

  it("leaves a pending bet out of the bankroll but shows what is at risk", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
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

    const broken = buildStanding(member, MILLION_PLAN_RULES, [
      red("b1", "2026-09-21T10:00:00.000Z"),
      bet({ id: "b2", placedAt: "2026-09-22T10:00:00.000Z" }),
      red("b3", "2026-09-23T10:00:00.000Z"),
      red("b4", "2026-09-24T10:00:00.000Z"),
    ]);

    expect(broken.reds).toBe(3);
    expect(broken.lossStreak).toBe(2);
  });

  it("only counts the bets belonging to that player", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1" }),
      bet({ id: "b2", userId: "u2", profitLoss: 999 }),
    ]);

    expect(standing.bets).toHaveLength(1);
    expect(standing.bankroll).toBe(15);
  });

  it("climbs a step for a day won and goes back one for a day lost", () => {
    // Two wins put the player on day 3 of the table. Losing day 3 sends them
    // back to day 2 — one step, not back to the start and not forward.
    const climbing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({ id: "b2", stake: 7.5, odds: 1.85, profitLoss: 6.38, placedAt: "2026-09-22T10:00:00.000Z" }),
    ]);
    expect(climbing.day).toBe(3);

    const fell = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({ id: "b2", stake: 7.5, odds: 1.85, profitLoss: 6.38, placedAt: "2026-09-22T10:00:00.000Z" }),
      bet({
        id: "b3",
        status: "red",
        stake: 10.69,
        profitLoss: -10.69,
        placedAt: "2026-09-23T10:00:00.000Z",
      }),
    ]);

    expect(fell.bankroll).toBe(10.69);
    expect(fell.day).toBe(2);
  });

  it("counts the days left open and remembers the last one decided", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({
        id: "b2",
        status: "pending",
        profitLoss: 0,
        settledAt: null,
        placedAt: "2026-09-22T10:00:00.000Z",
      }),
    ]);

    expect(standing.openBets).toBe(1);
    expect(standing.lastSettled?.id).toBe("b1");
    // The open day has not moved the money, so it has not moved the day either.
    expect(standing.day).toBe(2);
  });

  it("starts a player who has not bet yet at the plan's opening stake", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, []);

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

describe("a game the site never heard of", () => {
  const manual = () =>
    bet({
      status: "pending",
      profitLoss: 0,
      stake: 10,
      odds: 1.9,
      settledAt: null,
      legs: [leg({ fixtureId: null, status: "pending", market: "Casa" })],
    });

  it("is recognised by having no fixture behind it", () => {
    expect(isManualLeg(leg({ fixtureId: null }))).toBe(true);
    expect(isManualLeg(leg({ fixtureId: 1 }))).toBe(false);
  });

  it("is never asked for from the results feed", () => {
    expect(
      openFixtureRefs([
        bet({
          status: "pending",
          legs: [leg({ fixtureId: null, status: "pending" }), leg({ fixtureId: 7, status: "pending" })],
        }),
      ])
    ).toEqual([{ id: 7, league: "Liga Portugal" }]);
  });

  it("keeps the day open, because no score can decide it", () => {
    expect(settleFromScores(manual(), scores([[1, [2, 0]]]))).toBeNull();
  });

  it("pays out when its owner says it landed", () => {
    const settled = settleManually(manual(), true);

    expect(settled.status).toBe("green");
    expect(settled.profitLoss).toBe(9);
    expect(settled.legs[0].status).toBe("green");
    expect(settled.settledAt).not.toBeNull();
  });

  it("takes the stake when its owner says it did not", () => {
    const settled = settleManually(manual(), false);

    expect(settled.status).toBe("red");
    expect(settled.profitLoss).toBe(-10);
  });

  it("does not blame a particular game for a lost day of several", () => {
    // Nobody said which one failed, and guessing would put a false result in
    // the history the model is judged against.
    const settled = settleManually(
      bet({
        status: "pending",
        stake: 10,
        odds: 3,
        legs: [leg({ fixtureId: null, status: "pending" }), leg({ fixtureId: 2, status: "pending" })],
      }),
      false
    );

    expect(settled.status).toBe("red");
    expect(settled.legs.map((entry) => entry.status)).toEqual(["pending", "pending"]);
  });
});

describe("a day that is already lost", () => {
  it("closes as soon as one game fails, without waiting for the rest", () => {
    // A multiple is dead the moment a leg goes down, and calling it "open"
    // would keep money on the books that cannot come back.
    const settled = settleFromScores(
      bet({
        status: "pending",
        profitLoss: 0,
        stake: 10,
        odds: 4,
        settledAt: null,
        legs: [
          leg({ fixtureId: 1, status: "pending", market: "Fora" }),
          leg({ fixtureId: 9, status: "pending" }),
        ],
      }),
      scores([[1, [2, 0]]])
    );

    expect(settled?.status).toBe("red");
    expect(settled?.profitLoss).toBe(-10);
    expect(settled?.legs.map((entry) => entry.status)).toEqual(["red", "pending"]);
  });
});

describe("saying how one game inside a bet went", () => {
  const open = () =>
    bet({
      status: "pending",
      profitLoss: 0,
      settledAt: null,
      stake: 10,
      odds: 2.5,
      legs: [
        leg({ fixtureId: null, status: "pending", market: "-4,5 Golos" }),
        leg({ fixtureId: null, status: "pending", market: "-3,5 Golos" }),
      ],
    });

  it("records the game without touching the rest", () => {
    const marked = setLegStatus(open(), 0, "green");

    expect(marked.legs.map((entry) => entry.status)).toEqual(["green", "pending"]);
    expect(marked.status).toBe("pending");
  });

  it("closes an open day as soon as one game is marked down", () => {
    const marked = setLegStatus(open(), 1, "red");

    expect(marked.status).toBe("red");
    expect(marked.profitLoss).toBe(-10);
    expect(marked.settledAt).not.toBeNull();
  });

  it("pays an open day out once every game is in", () => {
    const first = setLegStatus(open(), 0, "green");
    const marked = setLegStatus({ ...first, id: "b1", userId: "u1" }, 1, "green");

    expect(marked.status).toBe("green");
    expect(marked.profitLoss).toBe(15);
  });

  it("leaves the money alone on a day its owner already settled", () => {
    // Filling in which game failed afterwards must not re-pay a closed day.
    const settled = bet({
      status: "red",
      profitLoss: -10,
      stake: 10,
      odds: 2.5,
      legs: [
        leg({ fixtureId: null, status: "pending" }),
        leg({ fixtureId: null, status: "pending" }),
      ],
    });

    const marked = setLegStatus(settled, 0, "red");

    expect(marked.status).toBe("red");
    expect(marked.profitLoss).toBe(-10);
    expect(marked.legs[0].status).toBe("red");
  });
});
