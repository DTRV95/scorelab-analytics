import { describe, expect, it } from "vitest";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import { rivalries } from "@/lib/rivals";
import type {
  PlanBet,
  PlanFunds,
  PlanMember,
  PlanRecord,
} from "@/lib/planStore";

const plan = (id: string, name = "Plano Milhão"): PlanRecord => ({
  id,
  name,
  starting_bankroll: 10,
  target: 1_000_000,
  created_by: "david",
  start_date: null,
  days: 38,
  rules: MILLION_PLAN_RULES,
  visible: false,
  template_key: "milhao",
});

const member = (planId: string, userId: string, name: string): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: name,
  starting_bankroll: 10,
});

function bet(
  planId: string,
  userId: string,
  profitLoss: number,
  day: number,
): PlanBet & { planId: string } {
  return {
    planId,
    id: `${planId}-${userId}-${day}`,
    userId,
    legs: [],
    odds: 1.9,
    stake: 5,
    day,
    status: profitLoss >= 0 ? "green" : "red",
    profitLoss,
    placedAt: `2026-09-2${day}T10:00:00.000Z`,
    settledAt: `2026-09-2${day}T20:00:00.000Z`,
  };
}

const roster = (planId: string) => [
  member(planId, "david", "David"),
  member(planId, "irmao", "Vilagreen"),
];

describe("where you stand against the people you are playing", () => {
  it("measures the gap on profit, not on the bankroll", () => {
    // Once somebody puts €50 in, the bankroll says they are winning and the
    // betting says otherwise.
    const funds: (PlanFunds & { planId: string })[] = [
      { planId: "p", id: "f", userId: "irmao", amount: 50, note: null, at: "x" },
    ];

    const [rivalry] = rivalries(
      "david",
      [plan("p")],
      roster("p"),
      [bet("p", "david", 5, 1), bet("p", "irmao", -3, 1)],
      funds,
    );

    expect(rivalry.gap).toBe(8);
    expect(rivalry.closest.name).toBe("Vilagreen");
  });

  it("goes negative while you are behind", () => {
    const [rivalry] = rivalries(
      "david",
      [plan("p")],
      roster("p"),
      [bet("p", "david", -3, 1), bet("p", "irmao", 5, 1)],
    );

    expect(rivalry.gap).toBe(-8);
  });

  it("leaves out a challenge nobody else is in", () => {
    // There is no gap to a person who does not exist.
    const found = rivalries(
      "david",
      [plan("sozinho")],
      [member("sozinho", "david", "David")],
      [],
    );

    expect(found).toEqual([]);
  });

  it("leaves out a challenge this person is not in at all", () => {
    const found = rivalries("david", [plan("deles")], roster("deles").slice(1), []);

    expect(found).toEqual([]);
  });

  it("says when too few days are settled for the gap to mean anything", () => {
    const early = rivalries(
      "david",
      [plan("p")],
      roster("p"),
      [bet("p", "david", 5, 1), bet("p", "irmao", -3, 1)],
    );
    expect(early[0].early).toBe(true);

    const enough = rivalries(
      "david",
      [plan("p")],
      roster("p"),
      [
        bet("p", "david", 5, 1),
        bet("p", "david", 5, 2),
        bet("p", "david", 5, 3),
        bet("p", "irmao", -3, 1),
        bet("p", "irmao", -3, 2),
        bet("p", "irmao", -3, 3),
      ],
    );
    expect(enough[0].early).toBe(false);
  });

  it("puts the one still being lost first, narrowest gap of those", () => {
    // The one still winnable is the one worth putting at the top.
    const found = rivalries(
      "david",
      [plan("a", "A"), plan("b", "B"), plan("c", "C")],
      [...roster("a"), ...roster("b"), ...roster("c")],
      [
        bet("a", "david", 9, 1),
        bet("b", "irmao", 9, 1),
        bet("c", "irmao", 2, 1),
      ],
    );

    expect(found.map((entry) => entry.plan.name)).toEqual(["C", "B", "A"]);
  });
});
