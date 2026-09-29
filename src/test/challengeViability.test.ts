import { describe, expect, it } from "vitest";
import {
  ASSUMED_WIN_RATE,
  CHALLENGE_TEMPLATES,
  MILLION_PLAN_RULES,
  chanceOfCompleting,
  expectedGrowth,
  isViable,
  ladderFor,
  maxSensibleStake,
} from "@/lib/challengeRules";

describe("whether a challenge can be finished by betting well", () => {
  it("knows half the bankroll at even money is a losing machine", () => {
    // Winning 55% of the time is a good bettor. It is not nearly enough when
    // a loss takes half of everything.
    expect(expectedGrowth(MILLION_PLAN_RULES, 0.55)).toBeLessThan(0);
    expect(isViable(MILLION_PLAN_RULES)).toBe(false);
  });

  it("stays negative for the Plano Milhão however well it is bet", () => {
    // Not a matter of finding a better week: at 60% it is still a machine for
    // losing money, because the arithmetic does not care how the day went.
    expect(expectedGrowth(MILLION_PLAN_RULES, 0.6)).toBeLessThan(0);
  });

  it("turns positive once the stake comes down", () => {
    const gentler = {
      ...MILLION_PLAN_RULES,
      stakeBands: [{ untilDay: null, pct: 0.05 }],
      oddsPlan: { first: 1.9, cycle: [1.9] },
    };

    expect(expectedGrowth(gentler, 0.55)).toBeGreaterThan(0);
  });

  it("puts the fastest-growing stake where Kelly puts it", () => {
    // 55% at 1.90 makes 5% the best share to stake; double it and the growth
    // is back to nothing.
    expect(maxSensibleStake(1.9, 0.55)).toBeCloseTo(0.05, 3);

    const atKelly = {
      ...MILLION_PLAN_RULES,
      stakeBands: [{ untilDay: null, pct: 0.05 }],
      oddsPlan: { first: 1.9, cycle: [1.9] },
    };
    const atDouble = {
      ...atKelly,
      stakeBands: [{ untilDay: null, pct: 0.1 }],
    };

    expect(expectedGrowth(atKelly, 0.55)).toBeGreaterThan(
      expectedGrowth(atDouble, 0.55)
    );
    expect(expectedGrowth(atDouble, 0.55)).toBeCloseTo(0, 3);
  });

  it("has nothing to say about a challenge with no odds to work from", () => {
    expect(
      Number.isNaN(
        expectedGrowth({
          ...MILLION_PLAN_RULES,
          oddsPlan: { first: 1, cycle: [] },
        })
      )
    ).toBe(true);
  });
});

describe("the ready-made challenges", () => {
  const planned = CHALLENGE_TEMPLATES.filter((template) => !template.longShot);
  const longShots = CHALLENGE_TEMPLATES.filter((template) => template.longShot);

  it.each(planned.map((template) => [template.name, template] as const))(
    "%s grows the bankroll at the assumed win rate",
    (_name, template) => {
      // The guard that keeps "matematicamente viável" a fact. A template whose
      // stake is too big for its odds fails here rather than on somebody's
      // money.
      expect(expectedGrowth(template.rules, ASSUMED_WIN_RATE)).toBeGreaterThan(
        0
      );
    }
  );

  it.each(longShots.map((template) => [template.name, template] as const))(
    "%s is honestly marked as the long shot it is",
    (_name, template) => {
      // A long shot that turned out to be viable would be mislabelled, and so
      // would a planned challenge that quietly stopped growing. Both directions
      // are checked, so the label cannot drift away from the arithmetic.
      expect(isViable(template.rules)).toBe(false);
    }
  );

  it("advertises odds on the long shots that match their own rules", () => {
    for (const template of longShots) {
      const written = /1 em ([\d\s\u00a0]+)/.exec(template.blurb);
      if (!written) continue;

      const claimed = Number(written[1].replace(/[\s\u00a0]/g, ""));
      const ladder = ladderFor(template.rules, template.startingBankroll);
      const real = 1 / chanceOfCompleting(ladder, 1);

      // Within a percent: the blurb is rounded, the arithmetic is not.
      expect(Math.abs(real - claimed) / claimed).toBeLessThan(0.01);
    }
  });

  it("keeps the Plano Milhão exactly as the document writes it", () => {
    const milhao = CHALLENGE_TEMPLATES.find((t) => t.key === "milhao");

    expect(milhao).toBeDefined();
    expect(milhao!.longShot).toBe(true);
    expect(isViable(milhao!.rules)).toBe(false);
  });

  it("gives every planned challenge a reachable target", () => {
    for (const template of planned) {
      expect(template.target).toBeGreaterThan(template.startingBankroll);
      expect(template.target / template.startingBankroll).toBeLessThanOrEqual(10);
    }
  });
});
