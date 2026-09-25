import { describe, expect, it } from "vitest";
import { nextMove } from "@/lib/challengeGuidance";
import { MILLION_PLAN_RULES, type ChallengeRules } from "@/lib/challengeRules";
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
    standing: standing(overrides),
    schedule,
    target: 1_000_000,
  });
}

describe("telling someone what to do next", () => {
  it("names the stake and the odd, worked out from the money really there", () => {
    const result = move();

    // Day 3 is a 50% day and €21.38 is on the table.
    expect(result.state).toBe("play");
    expect(result.stake).toBe(10.69);
    expect(result.targetOdds).toBe(1.9);
    // The euro formatter uses a non-breaking space before the symbol, so the
    // expectations match on it loosely rather than pretending otherwise.
    expect(result.action).toMatch(/^Aposta 10,69\s€ a uma odd de 1\.90$/);
    expect(result.detail).toMatch(/50% da banca de 21,38\s€/);
    expect(result.blocked).toBe(false);
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
    // And the instruction follows the money down rather than the day count up:
    // half of €10.69 is €5.345, which lands on the cent below.
    expect(result.stake).toBe(5.34);
  });

  it("does not claim movement when the bankroll stayed on the same rung", () => {
    // A win too small to reach the next rung is still a win, and saying
    // "avanças" when nothing advanced would be a lie the ladder contradicts.
    const result = move({
      bankroll: 16,
      day: 2,
      lastSettled: settled({ day: 2, profitLoss: 1 }),
    });

    expect(result.last).toMatch(/Ficas no dia 2/);
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
    expect(result.detail).toMatch(/5,00\s€ a uma odd de 2\.00/);
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
