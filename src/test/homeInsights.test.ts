import { describe, expect, it } from "vitest";
import { currentStreak, homeInsights } from "@/lib/homeInsights";
import type { HomeChallenge } from "@/lib/homeBoard";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

function leg(overrides: Partial<PlanLeg> = {}): PlanLeg {
  return {
    match: "FC Porto vs Rio Ave",
    homeTeam: "FC Porto",
    awayTeam: "Rio Ave",
    league: "Liga Portugal",
    market: "1X",
    odds: 1.4,
    modelProb: 72,
    fixtureId: 1,
    kickoff: null,
    status: "green",
    ...overrides,
  };
}

let counter = 0;
function bet(
  status: PlanBet["status"],
  overrides: Partial<PlanBet> = {},
): PlanBet {
  counter += 1;
  const day = counter;
  return {
    id: `b${counter}`,
    userId: "david",
    legs: [leg({ status: status === "pending" ? "pending" : status })],
    odds: 1.9,
    stake: 5,
    day,
    status,
    profitLoss: status === "green" ? 4.5 : status === "red" ? -5 : 0,
    placedAt: `2026-09-${String(day).padStart(2, "0")}T10:00:00.000Z`,
    settledAt:
      status === "pending"
        ? null
        : `2026-09-${String(day).padStart(2, "0")}T20:00:00.000Z`,
    ...overrides,
  };
}

/** A settled record of greens and reds, in the order they were played. */
function record(pattern: ("green" | "red")[]): PlanBet[] {
  counter = 0;
  return pattern.map((status) => bet(status));
}

const noChallenges: HomeChallenge[] = [];

describe("what the record says on the home page", () => {
  it("says nothing at all off a handful of bets", () => {
    // Two wins are a coin landing twice. A home page that calls that a finding
    // is lying to somebody about their own money.
    const insights = homeInsights({
      bets: record(["green", "green"]),
      challenges: noChallenges,
    });

    expect(insights.map((entry) => entry.id)).not.toContain("rate");
    expect(insights.map((entry) => entry.id)).not.toContain("price");
  });

  it("gives the hit rate with the count behind it", () => {
    const insights = homeInsights({
      bets: record(["green", "green", "red", "green", "green", "red"]),
      challenges: noChallenges,
    });

    const rate = insights.find((entry) => entry.id === "rate");
    expect(rate?.figure).toBe("67% · 4 de 6");
    expect(rate?.tone).toBe("good");
  });

  it("measures the hit rate against what the odds were asking", () => {
    // Every bet at 1.90: break-even is 53%. Four of six is 67%.
    const insights = homeInsights({
      bets: record(["green", "green", "red", "green", "green", "red"]),
      challenges: noChallenges,
    });

    const price = insights.find((entry) => entry.id === "price");
    expect(price?.text).toBe("Acertas mais do que as odds pedem");
    expect(price?.figure).toBe("pedem 53%");
    expect(price?.tone).toBe("good");
  });

  it("says so when the prices are ahead of the acerto", () => {
    const bets = record(["green", "red", "red", "red", "green", "red"]);
    const insights = homeInsights({ bets, challenges: noChallenges });

    const price = insights.find((entry) => entry.id === "price");
    expect(price?.text).toBe("Acertas menos do que as odds pedem");
    expect(price?.tone).toBe("bad");
  });

  it("counts the run going on right now, and which way it goes", () => {
    const insights = homeInsights({
      bets: record(["red", "green", "green", "green"]),
      challenges: noChallenges,
    });

    const streak = insights.find((entry) => entry.id === "streak");
    expect(streak?.figure).toBe("3 seguidos");
    expect(streak?.tone).toBe("good");
  });

  it("names the competition where most games land", () => {
    counter = 0;
    const bets = [
      bet("green", { legs: [leg({ league: "Premier League" })] }),
      bet("green", { legs: [leg({ league: "Premier League" })] }),
      bet("green", { legs: [leg({ league: "Premier League" })] }),
      bet("red", {
        legs: [leg({ league: "Premier League", status: "red" })],
      }),
    ];

    const insights = homeInsights({ bets, challenges: noChallenges });
    const league = insights.find((entry) => entry.id === "league");

    expect(league?.text).toBe("Na Premier League entram-te mais jogos");
    expect(league?.figure).toBe("3 de 4");
  });

  it("leaves a game typed by hand out of the competitions", () => {
    counter = 0;
    const bets = Array.from({ length: 5 }, () =>
      bet("green", { legs: [leg({ league: "Adicionado à mão" })] }),
    );

    const insights = homeInsights({ bets, challenges: noChallenges });
    expect(insights.find((entry) => entry.id === "league")).toBeUndefined();
  });

  it("reads the market names the way the app writes them", () => {
    counter = 0;
    const bets = Array.from({ length: 4 }, () => bet("green"));

    const insights = homeInsights({
      bets,
      challenges: noChallenges,
      label: (market) => (market === "1X" ? "Casa ou Empate (1X)" : market),
    });

    expect(
      insights.find((entry) => entry.id === "sharpest")?.text,
    ).toBe("Acertas mais em Casa ou Empate (1X)");
  });

  it("keeps the list short enough to read at a glance", () => {
    const insights = homeInsights({
      bets: record([
        "green",
        "green",
        "red",
        "green",
        "green",
        "red",
        "green",
        "green",
      ]),
      challenges: noChallenges,
      limit: 3,
    });

    expect(insights).toHaveLength(3);
  });
});

describe("the run of results at the end of the record", () => {
  it("is nothing when nothing has been settled", () => {
    counter = 0;
    expect(currentStreak([bet("pending")])).toBeNull();
  });

  it("counts back from the last one settled, not from the last placed", () => {
    // Settled order is what a streak means: a bet placed later and still open
    // cannot break a run, and one settled later ends it.
    counter = 0;
    const older = bet("green", {
      settledAt: "2026-09-01T20:00:00.000Z",
    });
    const newer = bet("red", { settledAt: "2026-09-09T20:00:00.000Z" });

    expect(currentStreak([newer, older])).toEqual({ kind: "red", length: 1 });
  });
});
