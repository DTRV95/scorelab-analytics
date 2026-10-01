import { describe, expect, it } from "vitest";
import { describeNews, newsByPlan, planNews } from "@/lib/planNews";
import type { PlanBet, PlanFunds, PlanMember } from "@/lib/planStore";

const members: PlanMember[] = [
  { plan_id: "p", user_id: "david", display_name: "David", starting_bankroll: 10 },
  { plan_id: "p", user_id: "irmao", display_name: "Vilagreen", starting_bankroll: 10 },
];

function bet(
  userId: string,
  day: number,
  placedAt: string,
  status: PlanBet["status"] = "pending",
  settledAt: string | null = null,
): PlanBet & { planId: string } {
  return {
    planId: "p",
    id: `${userId}-${day}`,
    userId,
    legs: [],
    odds: 1.9,
    stake: 5,
    day,
    status,
    profitLoss: status === "green" ? 4.5 : status === "red" ? -5 : 0,
    placedAt,
    settledAt,
  };
}

const funds = (
  userId: string,
  amount: number,
  at: string,
): PlanFunds & { planId: string } => ({
  planId: "p",
  id: `f-${userId}-${amount}`,
  userId,
  amount,
  note: null,
  at,
});

describe("what the other players did since you last looked", () => {
  it("reports their day, and keeps your own out of it", () => {
    // A list that opens with your own bets is a list nobody reads.
    const items = planNews({
      userId: "david",
      members,
      bets: [
        bet("irmao", 4, "2026-10-01T10:00:00.000Z"),
        bet("david", 4, "2026-10-01T11:00:00.000Z"),
      ],
      since: { p: "2026-10-01T08:00:00.000Z" },
    });

    expect(items).toHaveLength(1);
    expect(items[0].userId).toBe("irmao");
    expect(describeNews(items[0])).toBe("Vilagreen registou o dia 4");
  });

  it("says nothing about what happened before the last look", () => {
    const items = planNews({
      userId: "david",
      members,
      bets: [bet("irmao", 4, "2026-10-01T07:00:00.000Z")],
      since: { p: "2026-10-01T08:00:00.000Z" },
    });

    expect(items).toEqual([]);
  });

  it("counts a day registered and closed since the last look as two things", () => {
    // They are two different things to have missed.
    const items = planNews({
      userId: "david",
      members,
      bets: [
        bet(
          "irmao",
          4,
          "2026-10-01T10:00:00.000Z",
          "green",
          "2026-10-01T22:00:00.000Z",
        ),
      ],
      since: { p: "2026-10-01T08:00:00.000Z" },
    });

    expect(items.map((item) => item.kind)).toEqual(["settled", "placed"]);
    expect(describeNews(items[0])).toBe("Vilagreen ganhou o dia 4");
  });

  it("treats everything as new when there is no mark yet", () => {
    // Telling somebody opening the app for the first time that nothing has
    // happened is false, and it is the worst moment to say it.
    const items = planNews({
      userId: "david",
      members,
      bets: [bet("irmao", 1, "2026-09-25T10:00:00.000Z")],
      since: {},
    });

    expect(items).toHaveLength(1);
  });

  it("reports money moved, in the direction it moved", () => {
    const items = planNews({
      userId: "david",
      members,
      bets: [],
      funds: [
        funds("irmao", 50, "2026-10-01T10:00:00.000Z"),
        funds("irmao", -20, "2026-10-01T11:00:00.000Z"),
      ],
      since: { p: "2026-10-01T08:00:00.000Z" },
    });

    // The euro formatter puts a non-breaking space before the sign, so the
    // shape is matched rather than the exact bytes.
    expect(describeNews(items[1])).toMatch(/^Vilagreen juntou 50,00\s€ à banca$/);
    expect(describeNews(items[0])).toMatch(/^Vilagreen tirou 20,00\s€ da banca$/);
  });

  it("puts the newest first and counts them by challenge", () => {
    const items = planNews({
      userId: "david",
      members,
      bets: [
        bet("irmao", 4, "2026-10-01T09:00:00.000Z"),
        bet("irmao", 5, "2026-10-01T18:00:00.000Z"),
      ],
      since: { p: "2026-10-01T08:00:00.000Z" },
    });

    expect(items.map((item) => item.day)).toEqual([5, 4]);
    expect(newsByPlan(items)).toEqual({ p: 2 });
  });

  it("falls back to a name rather than showing a blank", () => {
    const items = planNews({
      userId: "david",
      members: [],
      bets: [bet("fantasma", 1, "2026-10-01T10:00:00.000Z")],
      since: {},
    });

    expect(describeNews(items[0])).toBe("Alguém registou o dia 1");
  });
});
