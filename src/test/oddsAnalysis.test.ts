import { describe, expect, it } from "vitest";
import { byLegOdds, byOddsBand } from "@/lib/betAnalytics";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

function leg(odds: number, status: PlanLeg["status"]): PlanLeg {
  return {
    match: `Jogo a ${odds}`,
    homeTeam: "Casa",
    awayTeam: "Fora",
    league: "Adicionado à mão",
    market: "Casa",
    odds,
    modelProb: 0,
    fixtureId: null,
    kickoff: null,
    status,
  };
}

function bet(
  odds: number,
  stake: number,
  status: PlanBet["status"],
  legs: PlanLeg[] = [],
): PlanBet {
  return {
    id: `${odds}-${stake}-${status}-${Math.random()}`,
    userId: "david",
    legs,
    odds,
    stake,
    day: 1,
    status,
    profitLoss:
      status === "green" ? stake * (odds - 1) : status === "red" ? -stake : 0,
    placedAt: "2026-10-02T10:00:00.000Z",
    settledAt: status === "pending" ? null : "2026-10-02T20:00:00.000Z",
  };
}

describe("what a price had to deliver", () => {
  it("works out the hit rate the prices demanded", () => {
    // Ten euros at 2.00 comes back level at one win in two.
    const [band] = byOddsBand([
      bet(2, 10, "green"),
      bet(2, 10, "red"),
      bet(2, 10, "green"),
    ]);

    expect(band.breakEven).toBe(50);
  });

  it("weighs the stakes, because a tenner and a euro do not ask the same", () => {
    // Both inside "até 1.50": 10 € at 1.25 and 1 € at 1.45 would bring back
    // 12.50 + 1.45 on 11 staked, so level is 11 / 13.95.
    const [band] = byOddsBand([bet(1.25, 10, "green"), bet(1.45, 1, "red")]);

    expect(band.breakEven).toBe(79);
  });

  it("says nothing about a band with nothing decided in it", () => {
    expect(byOddsBand([bet(2, 10, "pending")])[0].breakEven).toBeNull();
  });
});

describe("the prices of the individual games", () => {
  const legs = [
    // Eight at 1.20, seven of them in: 88% against the 83% the price wanted.
    ...Array.from({ length: 7 }, () => leg(1.2, "green" as const)),
    leg(1.2, "red"),
    // Twenty-two around 1.38, fifteen in: 68% against the 72% it wanted.
    ...Array.from({ length: 15 }, () => leg(1.38, "green" as const)),
    ...Array.from({ length: 7 }, () => leg(1.38, "red" as const)),
  ];

  it("groups the games by the price each one was taken at", () => {
    // Not the same question as the slip's odd: a multiple at 2.85 says nothing
    // about whether somebody judges a 1.30 favourite well.
    const rows = byLegOdds([bet(2.85, 10, "green", legs)]);

    expect(rows.map((row) => row.label)).toEqual(["até 1.30", "1.30 a 1.50"]);
    expect(rows[0]).toMatchObject({ legs: 8, won: 7, winPct: 88, breakEven: 83 });
    expect(rows[1]).toMatchObject({ legs: 22, won: 15, winPct: 68, breakEven: 72 });
  });

  it("says by how much each price is being beaten, or missed", () => {
    const rows = byLegOdds([bet(2.85, 10, "green", legs)]);

    // Worked out from the real figures and not from the rounded ones: 87.5
    // against 83.3, and 68.2 against 72.5.
    expect(rows[0].edge).toBe(4);
    // The band they bet most is the one that does not pay for itself.
    expect(rows[1].edge).toBe(-4);
  });

  it("leaves a game still open out of it", () => {
    const rows = byLegOdds([
      bet(1.5, 10, "pending", [leg(1.5, "pending"), leg(1.5, "green")]),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].legs).toBe(1);
  });

  it("holds its tongue on a band too small to mean anything", () => {
    const rows = byLegOdds([bet(2, 10, "green", [leg(2, "green")])]);

    expect(rows[0].legs).toBe(1);
    expect(rows[0].winPct).toBeNull();
    expect(rows[0].edge).toBeNull();
    // The price itself is known whatever the sample: it is arithmetic, not a
    // measurement.
    expect(rows[0].breakEven).toBe(50);
  });

  it("has nothing to show for a record with no decided games", () => {
    expect(byLegOdds([])).toEqual([]);
  });
});
