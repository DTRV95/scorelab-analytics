import { describe, expect, it } from "vitest";
import { bankrollTrend, trendRange } from "@/lib/bankrollTrend";
import type { PlanBet } from "@/lib/planStore";

function bet(
  settledAt: string | null,
  profitLoss: number,
  status: PlanBet["status"] = "green"
): PlanBet {
  return {
    id: Math.random().toString(36),
    userId: "me",
    legs: [],
    odds: 1.9,
    stake: 5,
    day: 1,
    status,
    profitLoss,
    placedAt: "2026-09-20T10:00:00.000Z",
    settledAt,
  };
}

describe("the line the betting drew", () => {
  it("adds each decided day onto the one before", () => {
    const points = bankrollTrend(10, [
      bet("2026-09-21T20:00:00.000Z", 5),
      bet("2026-09-22T20:00:00.000Z", -3),
    ]);

    expect(points.map((point) => point.bankroll)).toEqual([15, 12]);
  });

  it("draws them in the order they were decided, not the order they arrived", () => {
    const points = bankrollTrend(10, [
      bet("2026-09-23T20:00:00.000Z", 1),
      bet("2026-09-21T20:00:00.000Z", 5),
    ]);

    expect(points.map((point) => point.change)).toEqual([5, 1]);
  });

  it("leaves an open day off it", () => {
    // A bet not yet decided has changed nothing; drawing it would put the
    // money somewhere it has not been.
    const points = bankrollTrend(10, [
      bet("2026-09-21T20:00:00.000Z", 5),
      bet(null, 0, "pending"),
    ]);

    expect(points).toHaveLength(1);
  });

  it("has no line to draw before anything is decided", () => {
    expect(bankrollTrend(10, [])).toEqual([]);
  });

  it("pads a flat run so a quiet week does not read as a cliff", () => {
    const points = bankrollTrend(10, [bet("2026-09-21T20:00:00.000Z", 0, "red")]);
    const { low, high } = trendRange(points, 10);

    expect(low).toBeLessThan(10);
    expect(high).toBeGreaterThan(10);
  });

  it("never drops the floor below zero", () => {
    expect(trendRange([], 1).low).toBe(0);
  });
});
