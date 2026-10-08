import { describe, expect, it } from "vitest";
import { placedAgo, publicBets } from "@/lib/publicBets";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

function plan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "p1",
    name: "Plano Milhão",
    starting_bankroll: 10,
    target: 1000,
    created_by: "irmao",
    start_date: null,
    days: 38,
    rules: {},
    visible: true,
    template_key: "milhao",
    ended_at: null,
    ended_by: null,
    ...overrides,
  };
}

const member = (planId: string, userId: string, name: string): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: name,
  starting_bankroll: 10,
});

function bet(
  planId: string,
  userId: string,
  placedAt: string,
  overrides: Partial<PlanBet> = {},
): PlanBet & { planId: string } {
  return {
    planId,
    id: `${planId}-${userId}-${placedAt}`,
    userId,
    legs: [
      {
        match: "Casa vs Fora",
        homeTeam: "FC Porto",
        awayTeam: "Rio Ave",
        league: "Liga Portugal",
        market: "1X",
        odds: 1.35,
        modelProb: 78,
        fixtureId: 1,
        kickoff: null,
        status: "green",
      },
    ],
    odds: 1.35,
    stake: 5,
    day: 3,
    status: "green",
    profitLoss: 1.75,
    placedAt,
    settledAt: placedAt,
    ...overrides,
  };
}

describe("the bets of everybody else", () => {
  it("shows the bets of a challenge somebody opened up", () => {
    const feed = publicBets(
      "david",
      [plan()],
      [member("p1", "irmao", "Vilagreen")],
      [bet("p1", "irmao", "2026-10-08T10:00:00.000Z")],
    );

    expect(feed).toHaveLength(1);
    expect(feed[0].name).toBe("Vilagreen");
    expect(feed[0].planName).toBe("Plano Milhão");
  });

  it("never shows a challenge nobody opened up", () => {
    // The server refuses to hand these over; this must not ask for them
    // either, in case one ever arrives by another road.
    const feed = publicBets(
      "david",
      [plan({ visible: false })],
      [member("p1", "irmao", "Vilagreen")],
      [bet("p1", "irmao", "2026-10-08T10:00:00.000Z")],
    );

    expect(feed).toEqual([]);
  });

  it("leaves this person's own bets out of it", () => {
    // They are on every other page already; this one is for the others.
    const feed = publicBets(
      "david",
      [plan()],
      [member("p1", "david", "David"), member("p1", "irmao", "Vilagreen")],
      [
        bet("p1", "david", "2026-10-08T11:00:00.000Z"),
        bet("p1", "irmao", "2026-10-08T10:00:00.000Z"),
      ],
    );

    expect(feed.map((entry) => entry.name)).toEqual(["Vilagreen"]);
  });

  it("puts the most recent first, and keeps the list bounded", () => {
    const feed = publicBets(
      "david",
      [plan()],
      [member("p1", "irmao", "Vilagreen")],
      [
        bet("p1", "irmao", "2026-10-01T10:00:00.000Z"),
        bet("p1", "irmao", "2026-10-08T10:00:00.000Z"),
        bet("p1", "irmao", "2026-10-05T10:00:00.000Z"),
      ],
      2,
    );

    expect(feed.map((entry) => entry.bet.placedAt)).toEqual([
      "2026-10-08T10:00:00.000Z",
      "2026-10-05T10:00:00.000Z",
    ]);
  });

  it("keeps a bet whose member row went missing, without inventing a name", () => {
    const feed = publicBets(
      "david",
      [plan()],
      [],
      [bet("p1", "fantasma", "2026-10-08T10:00:00.000Z")],
    );

    expect(feed).toHaveLength(1);
    expect(feed[0].name).toBe("Alguém");
  });
});

describe("saying when it was placed", () => {
  const now = new Date("2026-10-08T12:00:00.000Z").getTime();

  it("uses the words somebody would use out loud", () => {
    expect(placedAgo("2026-10-08T11:58:00.000Z", now)).toBe("há 2 min");
    expect(placedAgo("2026-10-08T09:00:00.000Z", now)).toBe("há 3 horas");
    expect(placedAgo("2026-10-07T12:00:00.000Z", now)).toBe("ontem");
    expect(placedAgo("2026-10-02T12:00:00.000Z", now)).toBe("há 6 dias");
  });

  it("falls back to the date once it is old news", () => {
    expect(placedAgo("2026-07-02T12:00:00.000Z", now)).toBe("02/07");
  });
});
