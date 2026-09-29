import { describe, expect, it } from "vitest";
import { homeBoard } from "@/lib/homeBoard";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

function plan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "p1",
    name: "Plano Milhão",
    starting_bankroll: 10,
    target: 1_000_000,
    created_by: "david",
    start_date: null,
    days: 38,
    rules: MILLION_PLAN_RULES,
    visible: false,
    template_key: "milhao",
    ...overrides,
  };
}

const member = (planId = "p1", userId = "david"): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: "David",
  starting_bankroll: 10,
});

function bet(
  planId: string,
  status: PlanBet["status"],
  profitLoss = 0
): PlanBet & { planId: string } {
  return {
    planId,
    id: Math.random().toString(36),
    userId: "david",
    legs: [],
    odds: 1.9,
    stake: 5,
    day: 1,
    status,
    profitLoss,
    placedAt: "2026-09-20T10:00:00.000Z",
    settledAt: status === "pending" ? null : "2026-09-20T20:00:00.000Z",
  };
}

describe("what the home page has to say", () => {
  it("adds up every bankroll, and keeps the betting apart from it", () => {
    const board = homeBoard(
      "david",
      [plan({ id: "a" }), plan({ id: "b" })],
      [member("a"), member("b")],
      [bet("a", "green", 5), bet("b", "red", -3)]
    );

    expect(board.bankroll).toBe(22);
    expect(board.profit).toBe(2);
  });

  it("puts a day waiting to be closed ahead of a day waiting to be bet", () => {
    // The ladder cannot move until the last day is settled, so telling
    // somebody to bet would be telling them to do the impossible thing.
    const board = homeBoard(
      "david",
      [plan({ id: "aberto" }), plan({ id: "livre" })],
      [member("aberto"), member("livre")],
      [bet("aberto", "pending")]
    );

    expect(board.toClose.map((entry) => entry.plan.id)).toEqual(["aberto"]);
    expect(board.toPlay.map((entry) => entry.plan.id)).toEqual(["livre"]);
  });

  it("never asks for a bet on a challenge that has one open", () => {
    const board = homeBoard(
      "david",
      [plan()],
      [member()],
      [bet("p1", "pending")]
    );

    expect(board.toPlay).toHaveLength(0);
  });

  it("leaves out a challenge somebody else is in but this person is not", () => {
    const board = homeBoard(
      "david",
      [plan({ id: "dos-outros" })],
      [member("dos-outros", "outro")],
      []
    );

    expect(board.challenges).toHaveLength(0);
    expect(board.bankroll).toBe(0);
  });

  it("has nothing to say with no challenges at all", () => {
    const board = homeBoard("david", [], [], []);

    expect(board.challenges).toEqual([]);
    expect(board.toPlay).toEqual([]);
    expect(board.toClose).toEqual([]);
  });
});
