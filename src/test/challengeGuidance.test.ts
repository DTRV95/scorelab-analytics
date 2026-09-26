import { describe, expect, it } from "vitest";
import { nextMove, sinceStart } from "@/lib/challengeGuidance";
import {
  MILLION_PLAN_RULES,
  ladderFor,
  type ChallengeRules,
} from "@/lib/challengeRules";
import { planSchedule } from "@/lib/challengeSchedule";
import type { PlanBet, PlayerStanding } from "@/lib/planStore";

const running = planSchedule("2026-09-21", 2, 38, new Date("2026-09-25T12:00:00Z"));

function settled(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: "b1",
    userId: "david",
    legs: [],
    odds: 1.85,
    stake: 7.5,
    day: 2,
    status: "green",
    profitLoss: 6.38,
    placedAt: "2026-09-22T10:00:00.000Z",
    settledAt: "2026-09-22T20:00:00.000Z",
    ...overrides,
  };
}

function standing(overrides: Partial<PlayerStanding> = {}): PlayerStanding {
  return {
    userId: "david",
    name: "David",
    bankroll: 21.38,
    startingBankroll: 10,
    bets: [],
    settled: 2,
    greens: 2,
    reds: 0,
    lossStreak: 0,
    day: 3,
    openBets: 0,
    openStake: 0,
    lastSettled: settled(),
    ...overrides,
  };
}

function move(
  overrides: Partial<PlayerStanding> = {},
  rules: ChallengeRules = MILLION_PLAN_RULES,
  schedule = running
) {
  return nextMove({
    rules,
    ladder: ladderFor(rules, 10),
    standing: standing(overrides),
    schedule,
    target: 1_000_000,
  });
}

describe("telling someone what to do next", () => {
  it("names the stake and the odd, worked out from the money really there", () => {
    const result = move();

    // Row 3 of the document: banca 21,38 €, aposta 10,69 €, odd 1,90.
    expect(result.state).toBe("play");
    expect(result.stake).toBe(10.69);
    expect(result.targetOdds).toBe(1.9);
    // The euro formatter uses a non-breaking space before the symbol, so the
    // expectations match on it loosely rather than pretending otherwise.
    expect(result.action).toMatch(/^Aposta 10,69\s€ a uma odd de 1\.90$/);
    expect(result.detail).toMatch(/^Dia 3 de 38 · odd entre 1\.75 e 2\.10$/);
    expect(result.blocked).toBe(false);
    expect(result.short).toBe(false);
  });

  it("says a win moved the player up a day", () => {
    expect(move().last).toMatch(/^Ganhaste o dia 2, \+6,38\s€\. Avanças para o dia 3\.$/);
  });

  it("says a loss moved the player back down", () => {
    const result = move({
      bankroll: 10.69,
      day: 1,
      greens: 0,
      reds: 1,
      lossStreak: 1,
      lastSettled: settled({ status: "red", day: 3, stake: 10.69, profitLoss: -10.69 }),
    });

    expect(result.last).toMatch(/^Perdeste o dia 3, -10,69\s€\. Recuas para o dia 1\.$/);
    // Back on row 1, which asks for €5 — not half of whatever is left.
    expect(result.stake).toBe(5);
    expect(result.targetOdds).toBe(2);
  });

  it("asks for the table's figure even when there is more money than that", () => {
    // Winning at a better price than the table pencilled in leaves a cushion.
    // The cushion is not a bigger bet: row 3 says €10.69 and means it.
    const result = move({ bankroll: 40, day: 3 });

    expect(result.stake).toBe(10.69);
    expect(result.tableBankroll).toBe(21.38);
    expect(result.versusTable).toBe(18.62);
    expect(result.short).toBe(false);
  });

  it("stakes everything left when the table asks for more than there is", () => {
    const result = move({ bankroll: 6.4, day: 3 });

    expect(result.stake).toBe(6.4);
    expect(result.short).toBe(true);
    expect(result.versusTable).toBe(-14.98);
    expect(result.detail).toMatch(/O quadro pede 10,69\s€, só tens 6,40\s€: vai tudo/);
  });

  it("follows the document's own rows rather than recomputing them", () => {
    // Row 38 of the PDF. Recomputing from the percentages lands €432 higher,
    // which is the whole reason the table is transcribed instead of generated.
    const result = move({ bankroll: 793353.63, day: 38, greens: 37, reds: 0 });

    expect(result.stake).toBe(238006.09);
    expect(result.targetOdds).toBe(1.9);
    expect(result.tableBankroll).toBe(793353.63);
  });

  it("holds the next day back until the open one is decided", () => {
    const result = move({ openBets: 1, openStake: 10.69 });

    expect(result.state).toBe("close-first");
    expect(result.blocked).toBe(true);
    expect(result.action).toMatch(/Fecha o dia/);
  });

  it("calls the pause the challenge asked for, and says what comes after it", () => {
    const result = move({ lossStreak: 3 });

    expect(result.state).toBe("paused");
    expect(result.blocked).toBe(true);
    expect(result.detail).toMatch(/3 perdas seguidas/);
    expect(result.detail).toMatch(/10,69\s€/);
  });

  it("counts down to a challenge that has not started", () => {
    const result = move(
      { bankroll: 10, day: 1, greens: 0, settled: 0, lastSettled: null },
      MILLION_PLAN_RULES,
      planSchedule("2026-10-01", 0, 38, new Date("2026-09-25T12:00:00Z"))
    );

    expect(result.state).toBe("waiting-start");
    expect(result.action).toBe("Começa daqui a 6 dias");
    expect(result.detail).toMatch(/5,00\s€ a 2\.00/);
    expect(result.last).toBeNull();
  });

  it("stops asking for bets once the challenge is over", () => {
    const result = move(
      {},
      MILLION_PLAN_RULES,
      planSchedule("2026-01-01", 38, 38, new Date("2026-09-25T12:00:00Z"))
    );

    expect(result.state).toBe("finished");
    expect(result.blocked).toBe(true);
  });

  it("stops at the target rather than asking for one more day", () => {
    const result = move({ bankroll: 1_200_000, day: 38 });

    expect(result.state).toBe("target-hit");
    expect(result.action).toBe("Objetivo alcançado");
  });

  it("says plainly when there is nothing left to bet", () => {
    const result = move({ bankroll: 0, day: 1 });

    expect(result.state).toBe("broke");
    expect(result.stake).toBe(0);
  });

  it("leaves out the odds band when the challenge did not set one", () => {
    const free: ChallengeRules = {
      ...MILLION_PLAN_RULES,
      oddsMin: null,
      oddsMax: null,
      lossStreakPause: null,
    };

    expect(move({}, free).detail).not.toMatch(/entre/);
  });
});

describe("how far the money has come", () => {
  it("counts from where the challenge started, not from the target", () => {
    // €21.75 against a million is "menos de 0,1%" for thirty-odd days, which
    // reads as nothing having happened on a day somebody actually won.
    expect(sinceStart(21.75, 20)).toMatch(/^\+1,75\s€ desde o início$/);
    expect(sinceStart(16.8, 20)).toMatch(/^−3,20\s€ desde o início$/);
  });

  it("says so plainly before anything has moved", () => {
    expect(sinceStart(20, 20)).toBe("na banca inicial");
    expect(sinceStart(20.001, 20)).toBe("na banca inicial");
  });
});
