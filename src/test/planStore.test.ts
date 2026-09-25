import { describe, expect, it } from "vitest";
import {
  buildStanding,
  settleFromScore,
  type PlanBet,
  type PlanMember,
} from "@/lib/planStore";

const member: PlanMember = {
  plan_id: "plan",
  user_id: "u1",
  display_name: "David",
  starting_bankroll: 10,
};

function bet(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: "b1",
    userId: "u1",
    match: "FC Porto vs SL Benfica",
    homeTeam: "FC Porto",
    awayTeam: "SL Benfica",
    league: "Liga Portugal",
    market: "Casa",
    odds: 2,
    stake: 5,
    modelProb: 60,
    day: 1,
    status: "green",
    profitLoss: 5,
    placedAt: "2026-09-21T10:00:00.000Z",
    settledAt: "2026-09-21T20:00:00.000Z",
    fixture: { id: 1, league: "Liga Portugal", kickoff: null },
    ...overrides,
  };
}

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

describe("settling a plan bet", () => {
  it("pays out a winning market", () => {
    const settled = settleFromScore(bet({ status: "pending", profitLoss: 0 }), 2, 0);

    expect(settled?.status).toBe("green");
    expect(settled?.profitLoss).toBe(5);
    expect(settled?.settledAt).not.toBeNull();
  });

  it("takes the stake on a losing one", () => {
    const settled = settleFromScore(bet({ status: "pending", profitLoss: 0 }), 0, 1);

    expect(settled?.status).toBe("red");
    expect(settled?.profitLoss).toBe(-5);
  });

  it("leaves a market a score cannot decide alone", () => {
    const settled = settleFromScore(
      bet({ status: "pending", market: "Handicap Asiático +1.5" }),
      2,
      0
    );

    expect(settled).toBeNull();
  });
});
