import { describe, expect, it } from "vitest";
import { byPopularity, leaderboard, popularity } from "@/lib/leaderboard";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

function plan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "p1",
    name: "Dobrar a banca",
    starting_bankroll: 20,
    target: 40,
    created_by: "david",
    start_date: null,
    days: 14,
    rules: MILLION_PLAN_RULES,
    visible: true,
    template_key: "dobrar",
    ...overrides,
  };
}

function member(overrides: Partial<PlanMember> = {}): PlanMember {
  return {
    plan_id: "p1",
    user_id: "david",
    display_name: "David",
    starting_bankroll: 20,
    ...overrides,
  };
}

function bet(planId: string, userId: string, profitLoss: number): PlanBet & { planId: string } {
  return {
    planId,
    id: Math.random().toString(36),
    userId,
    legs: [],
    odds: 1.9,
    stake: 5,
    day: 1,
    status: profitLoss >= 0 ? "green" : "red",
    profitLoss,
    placedAt: "2026-09-20T10:00:00.000Z",
    settledAt: "2026-09-20T20:00:00.000Z",
  };
}

describe("the table of everybody running one challenge", () => {
  it("ranks on how much of the climb is done, not on euros", () => {
    // €10 turned into €18 is most of a climb to €20. €200 turned into €210 is
    // a tenth of a climb to €300 — and twelve times the euros.
    const rows = leaderboard(
      [
        plan({ id: "small", starting_bankroll: 10, target: 20 }),
        plan({ id: "big", starting_bankroll: 200, target: 300 }),
      ],
      [
        member({ plan_id: "small", user_id: "a", display_name: "Ana", starting_bankroll: 10 }),
        member({ plan_id: "big", user_id: "b", display_name: "Bruno", starting_bankroll: 200 }),
      ],
      [bet("small", "a", 8), bet("big", "b", 10)],
    );

    expect(rows.map((row) => row.name)).toEqual(["Ana", "Bruno"]);
    expect(rows[0].progress).toBeCloseTo(0.8, 2);
    expect(rows[1].progress).toBeCloseTo(0.1, 2);
  });

  it("puts everyone in a shared challenge on the same table", () => {
    const rows = leaderboard(
      [plan()],
      [
        member({ user_id: "david", display_name: "David" }),
        member({ user_id: "irmao", display_name: "Irmão" }),
      ],
      [bet("p1", "irmao", 6), bet("p1", "david", 2)],
    );

    expect(rows.map((row) => row.name)).toEqual(["Irmão", "David"]);
  });

  it("gives nobody progress on a challenge with nothing to climb", () => {
    const rows = leaderboard(
      [plan({ starting_bankroll: 20, target: 20 })],
      [member()],
      [],
    );

    expect(rows[0].progress).toBe(0);
  });
});

describe("which challenges are being done most", () => {
  it("counts people, not challenges", () => {
    const counts = popularity(
      [plan({ id: "p1" }), plan({ id: "p2", template_key: "sprint-7" })],
      [
        member({ plan_id: "p1", user_id: "a" }),
        member({ plan_id: "p1", user_id: "b" }),
        member({ plan_id: "p2", user_id: "a" }),
      ],
    );

    expect(counts).toEqual({ dobrar: 2, "sprint-7": 1 });
  });

  it("ignores a challenge that came from no model", () => {
    expect(popularity([plan({ template_key: null })], [member()])).toEqual({});
  });

  it("puts the busiest first and keeps the written order on a tie", () => {
    const templates = [{ key: "a" }, { key: "b" }, { key: "c" }];

    expect(byPopularity(templates, { b: 5, a: 1, c: 1 })).toEqual([
      { key: "b" },
      { key: "a" },
      { key: "c" },
    ]);
  });
});
