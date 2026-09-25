import { describe, expect, it } from "vitest";
import {
  CHALLENGE_TEMPLATES,
  MILLION_PLAN_RULES,
  buildLadder,
  checkBet,
  describeRules,
  parseRules,
  plannedStake,
  stakePctForDay,
  type ChallengeRules,
} from "@/lib/challengeRules";

const flat = (overrides: Partial<ChallengeRules> = {}): ChallengeRules => ({
  days: 10,
  stakeBands: [{ untilDay: null, pct: 0.25 }],
  oddsMin: null,
  oddsMax: null,
  onePerDay: false,
  lossStreakPause: null,
  oddsPlan: { first: 1.9, cycle: [1.9] },
  ...overrides,
});

describe("a challenge's own rules", () => {
  it("steps the stake down through the bands, in order", () => {
    expect(stakePctForDay(MILLION_PLAN_RULES, 1)).toBe(0.5);
    expect(stakePctForDay(MILLION_PLAN_RULES, 15)).toBe(0.5);
    expect(stakePctForDay(MILLION_PLAN_RULES, 16)).toBe(0.4);
    expect(stakePctForDay(MILLION_PLAN_RULES, 30)).toBe(0.3);
    // Past the last day the final band still applies rather than falling to zero.
    expect(stakePctForDay(MILLION_PLAN_RULES, 99)).toBe(0.3);
  });

  it("stakes a share of what is really in the bankroll", () => {
    expect(plannedStake(flat(), 80, 1)).toBe(20);
    expect(plannedStake(flat(), 0, 1)).toBe(0);
  });

  it("builds a ladder from whatever rules it is given", () => {
    const ladder = buildLadder(flat({ days: 3 }), 100);

    expect(ladder).toHaveLength(3);
    // €100, staking 25% at 1.90: €25 risked, €22.50 of profit.
    expect(ladder[0].bankrollEnd).toBe(122.5);
    expect(ladder[2].day).toBe(3);
  });
});

describe("what a challenge objects to", () => {
  const base = { odds: 2, stake: 25, bankroll: 100, day: 1, betsPlacedToday: 0, lossStreak: 0 };

  it("says nothing about odds when the challenge set no limits", () => {
    expect(checkBet(flat(), { ...base, odds: 12 })).toEqual([]);
  });

  it("tells a short odd apart from a long one", () => {
    const rules = flat({ oddsMin: 1.5, oddsMax: 2.5 });

    expect(checkBet(rules, { ...base, odds: 1.2 })[0].code).toBe("odds-low");
    expect(checkBet(rules, { ...base, odds: 3.4 })[0].code).toBe("odds-high");
  });

  it("explains why combining games pushes the odd up", () => {
    // The whole point of the warning: it is the multiplication, not a mistake.
    const [violation] = checkBet(flat({ oddsMax: 2.1 }), { ...base, odds: 3.42 });

    expect(violation.message).toMatch(/Juntar jogos multiplica/);
  });

  it("only counts a second bet when the challenge is one a day", () => {
    expect(checkBet(flat(), { ...base, betsPlacedToday: 2 })).toEqual([]);
    expect(
      checkBet(flat({ onePerDay: true }), { ...base, betsPlacedToday: 1 })[0].code
    ).toBe("daily-limit");
  });

  it("only calls a pause when the challenge asked for one", () => {
    expect(checkBet(flat(), { ...base, lossStreak: 9 })).toEqual([]);
    expect(
      checkBet(flat({ lossStreakPause: 2 }), { ...base, lossStreak: 2 })[0].code
    ).toBe("loss-streak");
  });
});

describe("rules as they come back from the database", () => {
  it("fills in a challenge saved before rules existed", () => {
    const rules = parseRules({}, 20);

    expect(rules.days).toBe(20);
    expect(rules.stakeBands).toHaveLength(1);
    expect(rules.oddsMin).toBeNull();
  });

  it("survives junk instead of rendering NaN on the page", () => {
    const rules = parseRules({
      days: "muitos",
      stakeBands: [{ untilDay: "cinco", pct: "metade" }],
      oddsMin: "",
      oddsMax: 0,
      lossStreakPause: undefined,
      oddsPlan: { first: null, cycle: ["x"] },
    });

    expect(Number.isFinite(rules.days)).toBe(true);
    expect(rules.stakeBands[0].pct).toBeGreaterThan(0);
    expect(rules.oddsMin).toBeNull();
    expect(rules.oddsMax).toBeNull();
    expect(rules.oddsPlan.cycle.every((odd) => odd > 1)).toBe(true);
  });

  it("keeps a challenge with no bands from dividing by nothing", () => {
    expect(parseRules({ stakeBands: [] }).stakeBands).toHaveLength(1);
  });

  it("reads back what was written", () => {
    const rules = parseRules(MILLION_PLAN_RULES);

    expect(rules.days).toBe(38);
    expect(rules.oddsMax).toBe(2.1);
    expect(rules.stakeBands.map((band) => band.pct)).toEqual([0.5, 0.4, 0.3]);
  });
});

describe("saying what a challenge is in one line", () => {
  it("describes a stepped challenge and a flat one differently", () => {
    expect(describeRules(MILLION_PLAN_RULES)).toBe(
      "38 dias · 50% a descer até 30% · odds 1.75–2.10 · uma aposta por dia"
    );
    expect(describeRules(flat())).toBe(
      "10 dias · 25% da banca · sem limite de odd · apostas sem limite diário"
    );
  });

  it("covers every ready-made model without throwing", () => {
    CHALLENGE_TEMPLATES.forEach((template) => {
      expect(describeRules(template.rules).length).toBeGreaterThan(0);
      expect(buildLadder(template.rules, template.startingBankroll)).toHaveLength(
        template.rules.days
      );
    });
  });
});
