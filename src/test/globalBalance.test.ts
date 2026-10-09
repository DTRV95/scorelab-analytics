import { describe, expect, it } from "vitest";
import { globalBalance } from "@/lib/globalBalance";
import type {
  PlanBet,
  PlanFunds,
  PlanMember,
  PlanRecord,
} from "@/lib/planStore";

const RULES = {
  days: 30,
  stakeBands: [{ untilDay: 30, pct: 0.3 }],
  oddsMin: 1.4,
  oddsMax: null,
  onePerDay: false,
  stopAfterLosses: null,
};

function plan(id: string, ended: string | null = null): PlanRecord {
  return {
    id,
    name: id,
    starting_bankroll: 20,
    target: 1000,
    created_by: "david",
    start_date: null,
    days: 30,
    rules: RULES,
    visible: false,
    template_key: "mes",
    ended_at: ended,
    ended_by: ended ? "david" : null,
  };
}

const member = (planId: string, starting = 20, userId = "david"): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: "David",
  starting_bankroll: starting,
});

let counter = 0;
function bet(
  planId: string,
  status: "green" | "red" | "pending",
  profitLoss: number,
  stake = 5,
  userId = "david",
): PlanBet & { planId: string } {
  counter += 1;
  return {
    planId,
    id: `b${counter}`,
    userId,
    legs: [],
    odds: 1.9,
    stake,
    day: counter,
    status,
    profitLoss,
    placedAt: `2026-09-${String(counter).padStart(2, "0")}T10:00:00.000Z`,
    settledAt:
      status === "pending"
        ? null
        : `2026-09-${String(counter).padStart(2, "0")}T20:00:00.000Z`,
  };
}

const money = (planId: string, amount: number): PlanFunds & { planId: string } => ({
  planId,
  id: `f-${planId}-${amount}`,
  userId: "david",
  amount,
  note: null,
  at: "2026-09-01T10:00:00.000Z",
});

describe("everything this account has", () => {
  it("counts a challenge that is over, because the money did not disappear", () => {
    // The bar showed only the challenges still running: a challenge given as
    // finished took its bankroll off the screen with it.
    const found = globalBalance({
      userId: "david",
      plans: [plan("a"), plan("b", "2026-09-30T18:00:00.000Z")],
      members: [member("a"), member("b")],
      bets: [bet("a", "green", 5), bet("b", "green", 30)],
    });

    expect(found.running).toBe(25);
    expect(found.finished).toBe(50);
    expect(found.total).toBe(75);
    expect(found.runningCount).toBe(1);
    expect(found.finishedCount).toBe(1);
  });

  it("counts what a bet outside a challenge returned", () => {
    const loose = bet("none", "green", 12.5);
    const found = globalBalance({
      userId: "david",
      plans: [plan("a")],
      members: [member("a")],
      bets: [],
      looseBets: [loose],
    });

    expect(found.loose).toBe(12.5);
    expect(found.total).toBe(32.5);
  });

  it("keeps money still on the table out of the total, and says how much", () => {
    // A pending bet has not moved anything yet. Quietly deducting it would
    // make the bar disagree with every challenge page.
    const found = globalBalance({
      userId: "david",
      plans: [plan("a")],
      members: [member("a")],
      bets: [bet("a", "pending", 0, 7)],
      looseBets: [bet("none", "pending", 0, 3)],
    });

    expect(found.total).toBe(20);
    expect(found.atRisk).toBe(10);
  });

  it("separates money put in by hand from money the bets made", () => {
    const found = globalBalance({
      userId: "david",
      plans: [plan("a")],
      members: [member("a")],
      bets: [bet("a", "green", 4)],
      funds: [money("a", 50)],
    });

    expect(found.total).toBe(74);
    // Fifty euros deposited is not fifty euros won.
    expect(found.profit).toBe(4);
    expect(found.added).toBe(50);
  });

  it("counts nobody else's money", () => {
    const found = globalBalance({
      userId: "david",
      plans: [plan("a")],
      members: [member("a"), member("a", 20, "vilagreen")],
      bets: [bet("a", "green", 5), bet("a", "green", 99, 5, "vilagreen")],
    });

    expect(found.total).toBe(25);
  });

  it("ignores a challenge this person is not in", () => {
    const found = globalBalance({
      userId: "david",
      plans: [plan("a"), plan("de-outro")],
      members: [member("a")],
      bets: [bet("a", "green", 5)],
    });

    expect(found.total).toBe(25);
    expect(found.runningCount).toBe(1);
  });

  it("is nothing at all before anybody is signed in", () => {
    const found = globalBalance({
      userId: "",
      plans: [plan("a")],
      members: [member("a")],
      bets: [],
    });

    expect(found.total).toBe(0);
  });
});
