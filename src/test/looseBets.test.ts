import { describe, expect, it } from "vitest";
import { looseBetPayload, looseTotals, type LooseBet } from "@/lib/looseBets";

function bet(
  status: LooseBet["status"],
  stake: number,
  profitLoss: number,
  odds = 2,
): LooseBet {
  return {
    id: `${status}-${stake}-${profitLoss}`,
    userId: "david",
    legs: [],
    odds,
    stake,
    day: 0,
    status,
    profitLoss,
    placedAt: "2026-10-02T10:00:00.000Z",
    settledAt: status === "pending" ? null : "2026-10-02T20:00:00.000Z",
  };
}

describe("a bet that belongs to no challenge", () => {
  it("is born pending, with nothing won and no day of anything", () => {
    const payload = looseBetPayload([], 2.85, 10);

    expect(payload).toMatchObject({
      odds: 2.85,
      stake: 10,
      day: 0,
      status: "pending",
      profitLoss: 0,
      settledAt: null,
    });
  });
});

describe("what the loose bets add up to", () => {
  it("counts only what was decided into the staked and the profit", () => {
    // An open bet has not won or lost anything yet, and counting its stake as
    // spent would say the money is gone when it is still on the table.
    const totals = looseTotals([
      bet("green", 10, 10),
      bet("red", 5, -5),
      bet("pending", 8, 0),
    ]);

    expect(totals.staked).toBe(15);
    expect(totals.profit).toBe(5);
    expect(totals.bets).toBe(3);
  });

  it("keeps what is still riding apart, and what it would return", () => {
    const totals = looseTotals([bet("pending", 8, 0, 2.5)]);

    expect(totals.atRisk).toBe(8);
    expect(totals.couldWin).toBe(12);
  });

  it("says nothing about a hit rate before anything is decided", () => {
    expect(looseTotals([bet("pending", 8, 0)]).winPct).toBeNull();
    expect(looseTotals([]).winPct).toBeNull();
  });

  it("works out the hit rate off the decided ones only", () => {
    const totals = looseTotals([
      bet("green", 5, 5),
      bet("green", 5, 5),
      bet("red", 5, -5),
      bet("pending", 5, 0),
    ]);

    expect(totals.winPct).toBe(67);
    expect(totals.won).toBe(2);
    expect(totals.lost).toBe(1);
    expect(totals.open).toBe(1);
  });

  it("has nothing to say about nothing", () => {
    expect(looseTotals([])).toMatchObject({
      bets: 0,
      staked: 0,
      profit: 0,
      atRisk: 0,
    });
  });
});
