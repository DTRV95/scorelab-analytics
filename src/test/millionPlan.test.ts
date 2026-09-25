import { describe, expect, it } from "vitest";
import {
  PLAN_TARGET,
  buildLadder,
  chanceOfCompleting,
  checkBet,
  costOfOneLoss,
  plannedOddsForDay,
  plannedStake,
  rungForBankroll,
  stakePctForDay,
} from "@/lib/millionPlan";

describe("the ladder from the document", () => {
  const ladder = buildLadder();

  it("starts where the plan starts and ends past the million", () => {
    expect(ladder[0].bankrollStart).toBe(10);
    expect(ladder[0].stake).toBe(5);
    expect(ladder[0].bankrollEnd).toBe(15);
    expect(ladder).toHaveLength(38);
    expect(ladder[37].bankrollEnd).toBeGreaterThan(PLAN_TARGET);
  });

  it("matches the rungs written in the document", () => {
    // Spot checks against the brothers' own table, one per stake band.
    const byDay = new Map(ladder.map((rung) => [rung.day, rung]));
    expect(byDay.get(2)!.bankrollEnd).toBeCloseTo(21.38, 2);
    expect(byDay.get(5)!.bankrollEnd).toBeCloseTo(62.86, 2);
    // Rounding carried day by day drifts a few euros over 38 compoundings;
    // the shape and the finish line are what matter.
    expect(byDay.get(16)!.bankrollEnd).toBeCloseTo(2855.8, 0);
    expect(byDay.get(30)!.bankrollEnd).toBeCloseTo(163857, -1);
  });

  it("steps the stake down as the numbers get big", () => {
    expect(stakePctForDay(1)).toBe(0.5);
    expect(stakePctForDay(15)).toBe(0.5);
    expect(stakePctForDay(16)).toBe(0.4);
    expect(stakePctForDay(29)).toBe(0.4);
    expect(stakePctForDay(30)).toBe(0.3);
  });

  it("cycles the odds the plan pencils in", () => {
    expect(plannedOddsForDay(1)).toBe(2);
    expect(plannedOddsForDay(2)).toBe(1.85);
    expect(plannedOddsForDay(6)).toBe(1.8);
    expect(plannedOddsForDay(7)).toBe(1.85);
  });

  it("stakes a share of what is really there, not of the plan's figure", () => {
    // Behind the ladder on day 5: the stake follows the real bankroll.
    expect(plannedStake(40, 5)).toBe(20);
    expect(plannedStake(40, 16)).toBe(16);
    expect(plannedStake(0, 3)).toBe(0);
  });
});

describe("where the bankroll actually is", () => {
  it("reads the rung off the money, not off the day count", () => {
    // The rung is the day this bankroll is ready to play: €15 is day 1 banked
    // and day 2 to go.
    expect(rungForBankroll(10)).toBe(1);
    expect(rungForBankroll(15)).toBe(2);
    expect(rungForBankroll(62.86)).toBe(6);
    expect(rungForBankroll(5)).toBe(0);
  });

  it("puts a number on what one lost day costs", () => {
    // Standing on day 6 with the ladder's own bankroll.
    const cost = costOfOneLoss(62.86, 6);

    expect(cost.stake).toBe(31.43);
    expect(cost.bankrollAfter).toBe(31.43);
    expect(cost.rungBefore).toBe(6);
    // Half the bankroll is two rungs back down the ladder.
    expect(cost.rungAfter).toBe(4);
  });
});

describe("what the plan objects to", () => {
  const base = {
    odds: 1.85,
    stake: 5,
    bankroll: 10,
    day: 1,
    betsPlacedToday: 0,
    lossStreak: 0,
  };

  it("passes a bet that follows the plan", () => {
    expect(checkBet(base)).toEqual([]);
  });

  it("refuses to let the stake creep above the day's share", () => {
    const [breach] = checkBet({ ...base, stake: 8 });

    expect(breach.code).toBe("stake-over");
    expect(breach.severity).toBe("breach");
    expect(breach.message).toContain("5.00 €");
  });

  it("treats a smaller stake as a choice, not a breach", () => {
    const [note] = checkBet({ ...base, stake: 3 });

    expect(note.code).toBe("stake-under");
    expect(note.severity).toBe("note");
  });

  it("holds the odds inside the range the plan set", () => {
    expect(checkBet({ ...base, odds: 2.6 })[0].code).toBe("odds-range");
    expect(checkBet({ ...base, odds: 1.5 })[0].code).toBe("odds-range");
    expect(checkBet({ ...base, odds: 2.05 })).toEqual([]);
  });

  it("keeps it to one bet a day", () => {
    const codes = checkBet({ ...base, betsPlacedToday: 1 }).map((v) => v.code);

    expect(codes).toContain("daily-limit");
  });

  it("calls the pause after three losses in a row", () => {
    const codes = checkBet({ ...base, lossStreak: 3 }).map((v) => v.code);

    expect(codes).toContain("loss-streak");
    expect(checkBet({ ...base, lossStreak: 2 })).toEqual([]);
  });
});

describe("the arithmetic of the whole run", () => {
  it("prices the ladder for what it is: one long run of wins", () => {
    // Every rung has to land, so the chances multiply.
    const whole = chanceOfCompleting(1);
    expect(whole).toBeLessThan(0.000001);

    // A short stretch is a different proposition from the full climb.
    expect(chanceOfCompleting(36)).toBeGreaterThan(whole);
    expect(chanceOfCompleting(38)).toBeCloseTo(1 / 1.9, 4);
  });
});
