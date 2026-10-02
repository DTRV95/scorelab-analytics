import { describe, expect, it } from "vitest";
import { byOddsBand, byWeekday, summarise } from "@/lib/betAnalytics";
import { buildPlayerStyle } from "@/lib/bettingStyle";
import type { PlanBet } from "@/lib/planStore";

function bet(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: Math.random().toString(36),
    userId: "david",
    legs: [],
    odds: 1.9,
    stake: 10,
    day: 1,
    status: "green",
    profitLoss: 9,
    placedAt: "2026-09-21T10:00:00.000Z",
    settledAt: "2026-09-21T20:00:00.000Z",
    ...overrides,
  };
}

describe("the record, grouped by the price taken", () => {
  it("puts each bet in the band its odd falls in", () => {
    const bands = byOddsBand([
      bet({ odds: 1.4 }),
      bet({ odds: 1.7 }),
      bet({ odds: 2.0 }),
      bet({ odds: 3.5 }),
    ]);

    expect(bands.map((band) => band.label)).toEqual([
      "até 1.50",
      "1.50 a 1.90",
      "1.90 a 2.50",
      "2.50 ou mais",
    ]);
  });

  it("leaves out a band nobody bet in", () => {
    expect(byOddsBand([bet({ odds: 1.4 })]).map((b) => b.label)).toEqual([
      "até 1.50",
    ]);
  });

  it("marks a band as thin rather than refusing to divide", () => {
    // One win of one really is 100%, and says nothing at all. Printing "1 de
    // 1" beside a dash made the page look like it could not divide, and the
    // reader did the division anyway — so the rate is shown with a warning.
    const [thin] = byOddsBand([bet({ odds: 1.4 })]);
    expect(thin.winPct).toBe(100);
    expect(thin.enough).toBe(false);

    const [enough] = byOddsBand([
      bet({ odds: 1.4 }),
      bet({ odds: 1.4 }),
      bet({ odds: 1.4, status: "red", profitLoss: -10 }),
    ]);
    expect(enough.winPct).toBe(67);
    expect(enough.enough).toBe(true);
  });

  it("starts the week on Monday", () => {
    // 2026-09-20 is a Sunday, 21 a Monday.
    const days = byWeekday([
      bet({ placedAt: "2026-09-20T10:00:00.000Z" }),
      bet({ placedAt: "2026-09-21T10:00:00.000Z" }),
    ]);

    expect(days.map((day) => day.label)).toEqual(["segunda", "domingo"]);
  });
});

describe("the record in one row", () => {
  it("counts what is decided apart from what is still open", () => {
    const summary = summarise([
      bet(),
      bet({ status: "red", profitLoss: -10 }),
      bet({ status: "pending", profitLoss: 0, settledAt: null }),
    ]);

    expect(summary.bets).toBe(3);
    expect(summary.settled).toBe(2);
    expect(summary.open).toBe(1);
  });

  it("works out what a euro staked returned", () => {
    const summary = summarise([
      bet({ stake: 10, profitLoss: 9 }),
      bet({ stake: 10, status: "red", profitLoss: -10 }),
    ]);

    expect(summary.staked).toBe(20);
    expect(summary.profit).toBe(-1);
    expect(summary.roi).toBe(-5);
  });

  it("remembers the best day and the worst", () => {
    const summary = summarise([
      bet({ profitLoss: 9 }),
      bet({ status: "red", profitLoss: -10 }),
    ]);

    expect(summary.best).toBe(9);
    expect(summary.worst).toBe(-10);
  });
});

describe("whose record it is", () => {
  it("counts nobody else's bets, even from a shared challenge", () => {
    // Both brothers bet in the same challenge, so both come back in one read.
    const style = buildPlayerStyle("david", "David", [
      bet({ userId: "david" }),
      bet({ userId: "irmao" }),
      bet({ userId: "irmao" }),
    ]);

    expect(style.bets).toBe(1);
  });
});
