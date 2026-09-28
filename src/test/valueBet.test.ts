import { describe, expect, it } from "vitest";
import {
  describeValue,
  edgePoints,
  expectedReturn,
  impliedPct,
  slipValue,
} from "@/lib/valueBet";

describe("what the price itself says", () => {
  it("reads an odd as the chance the bookmaker is pricing", () => {
    expect(impliedPct(2)).toBe(50);
    expect(impliedPct(1.85)).toBe(54.1);
  });

  it("refuses an odd that cannot mean anything", () => {
    expect(impliedPct(1)).toBeNull();
    expect(impliedPct(0)).toBeNull();
    expect(impliedPct(Number.NaN)).toBeNull();
  });
});

describe("one game against its price", () => {
  it("counts the points between the model and the odd", () => {
    // 1.85 pays for 54.1%; the model says 60%.
    expect(edgePoints(60, 1.85)).toBe(5.9);
  });

  it("says so when the price is better than the game", () => {
    expect(edgePoints(45, 1.85)).toBe(-9.1);
  });

  it("has nothing to say about a game it never forecast", () => {
    expect(edgePoints(0, 1.85)).toBeNull();
    expect(expectedReturn(0, 1.85)).toBeNull();
  });

  it("turns a forecast and a price into what a euro is worth", () => {
    expect(expectedReturn(60, 1.85)).toBe(1.11);
    expect(expectedReturn(50, 1.85)).toBe(0.925);
  });
});

describe("the whole slip", () => {
  it("multiplies the chances and the prices together", () => {
    const value = slipValue([
      { modelProb: 80, odds: 1.25 },
      { modelProb: 80, odds: 1.25 },
    ]);

    expect(value?.modelPct).toBe(64);
    // 1.25 × 1.25 = 1.5625, which pays for 64%. Fair, exactly.
    expect(value?.impliedPct).toBe(64);
    expect(value?.edge).toBe(0);
  });

  it("shows the stake running through every game's shortfall at once", () => {
    const thin = { modelProb: 78, odds: 1.25 };
    const one = slipValue([thin])!;
    const three = slipValue([thin, thin, thin])!;

    // One game is 2.5 cents short on the euro. Put three in the same slip and
    // the one stake now runs through all three shortfalls: 0.975³.
    expect(one.expectedReturn).toBe(0.975);
    expect(three.expectedReturn).toBe(0.927);
  });

  it("does not pretend the gap in points grows with the legs", () => {
    // It shrinks, because the probabilities themselves shrink — which is why
    // the euro is the number to read on a multiple, not the points.
    const thin = { modelProb: 78, odds: 1.25 };

    expect(slipValue([thin])!.edge).toBe(-2);
    expect(slipValue([thin, thin, thin])!.edge).toBe(-3.7);
  });

  it("stays silent when a game has no forecast behind it", () => {
    expect(
      slipValue([
        { modelProb: 60, odds: 1.85 },
        { modelProb: 0, odds: 1.5 },
      ])
    ).toBeNull();
  });

  it("stays silent on a price that means nothing", () => {
    expect(slipValue([{ modelProb: 60, odds: 1 }])).toBeNull();
    expect(slipValue([])).toBeNull();
  });
});

describe("saying it in words", () => {
  it("names the gain when the game beats its price", () => {
    const value = slipValue([{ modelProb: 60, odds: 1.85 }])!;

    expect(describeValue(value)).toMatch(/11 cêntimos a mais/);
  });

  it("names the cost when the price beats the game", () => {
    const value = slipValue([{ modelProb: 50, odds: 1.85 }])!;

    expect(describeValue(value)).toMatch(/perde 7,5 cêntimos/);
  });
});
