/**
 * What to do next, said in one place.
 *
 * The rules are all on the page somewhere — the ladder, the percentage, the
 * odds band, the pause after three losses — but reading a table is not the
 * same as being told "today you stake €12.50 at 1.95". This works that out
 * from what actually happened, so the answer and the money can never disagree.
 */

import {
  plannedOddsForDay,
  plannedStake,
  stakePctForDay,
  type ChallengeRules,
} from "@/lib/challengeRules";
import type { PlanSchedule } from "@/lib/challengeSchedule";
import type { PlayerStanding } from "@/lib/planStore";

export type MoveState =
  | "play"
  | "close-first"
  | "paused"
  | "waiting-start"
  | "finished"
  | "target-hit"
  | "broke";

export interface NextMove {
  state: MoveState;
  /** The day the ladder says is in front of this player. */
  day: number;
  /** What to stake today, from the rules and the money that is really there. */
  stake: number;
  /** The odd the ladder pencils in for this day. */
  targetOdds: number;
  /** What just happened, or null before anything has been decided. */
  last: string | null;
  /** The instruction itself, short enough to be read at a glance. */
  action: string;
  /** Why, in one sentence. */
  detail: string;
  /** True when the challenge is not asking for a bet right now. */
  blocked: boolean;
}

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/**
 * What the last decided day did to this player's position.
 *
 * The day comes off the ladder, so a win can move someone two rungs and a loss
 * can drop them several. Saying which day they were on and which they are on
 * now is the difference between a number changing and a person understanding
 * why it changed.
 */
function lastLine(standing: PlayerStanding, day: number): string | null {
  const bet = standing.lastSettled;
  if (!bet) return null;

  if (bet.status === "green") {
    const moved =
      day > bet.day
        ? ` Avanças para o dia ${day}.`
        : ` Ficas no dia ${day}: a banca ainda não chegou ao degrau seguinte.`;
    return `Ganhaste o dia ${bet.day}, +${eur.format(bet.profitLoss)}.${moved}`;
  }

  if (bet.status === "red") {
    const moved =
      day < bet.day
        ? ` Recuas para o dia ${day}.`
        : ` Continuas no dia ${day}.`;
    return `Perdeste o dia ${bet.day}, ${eur.format(bet.profitLoss)}.${moved}`;
  }

  return null;
}

export function nextMove({
  rules,
  standing,
  schedule,
  target,
}: {
  rules: ChallengeRules;
  standing: PlayerStanding;
  schedule: PlanSchedule;
  target: number;
}): NextMove {
  const day = Math.min(standing.day, rules.days);
  const stake = plannedStake(rules, standing.bankroll, day);
  const targetOdds = plannedOddsForDay(rules, day);
  const last = lastLine(standing, standing.day);
  const pct = (stakePctForDay(rules, day) * 100).toFixed(0);

  const base = { day, stake, targetOdds, last };

  if (standing.bankroll <= 0) {
    return {
      ...base,
      state: "broke",
      blocked: true,
      action: "A banca acabou",
      detail:
        "Não há nada para apostar. Para continuar, o desafio tem de recomeçar com uma banca nova.",
    };
  }

  if (standing.bankroll >= target) {
    return {
      ...base,
      state: "target-hit",
      blocked: true,
      action: "Objetivo alcançado",
      detail: `Chegaste aos ${eur.format(target)}. Acabou.`,
    };
  }

  if (standing.openBets > 0) {
    return {
      ...base,
      state: "close-first",
      blocked: true,
      action: "Fecha o dia que está aberto",
      detail:
        standing.openBets === 1
          ? "Enquanto uma aposta não estiver decidida, a banca não mexe e o dia seguinte não existe ainda."
          : `Tens ${standing.openBets} apostas por decidir. Enquanto não fecharem, o dia seguinte não existe ainda.`,
    };
  }

  if (schedule.state === "before") {
    return {
      ...base,
      state: "waiting-start",
      blocked: true,
      action: `Começa daqui a ${schedule.daysUntilStart} ${
        schedule.daysUntilStart === 1 ? "dia" : "dias"
      }`,
      detail: `No primeiro dia serão ${eur.format(stake)} a uma odd de ${targetOdds.toFixed(
        2
      )}.`,
    };
  }

  if (schedule.state === "finished") {
    return {
      ...base,
      state: "finished",
      blocked: true,
      action: "O desafio chegou ao fim",
      detail: `Ficaste no dia ${standing.day} de ${rules.days}, com ${eur.format(
        standing.bankroll
      )}.`,
    };
  }

  if (rules.lossStreakPause !== null && standing.lossStreak >= rules.lossStreakPause) {
    return {
      ...base,
      state: "paused",
      blocked: true,
      action: "Hoje não se aposta",
      detail: `${standing.lossStreak} perdas seguidas: o desafio manda parar um dia. Quando voltares são ${eur.format(
        stake
      )} a uma odd de ${targetOdds.toFixed(2)}.`,
    };
  }

  const band =
    rules.oddsMin !== null && rules.oddsMax !== null
      ? ` A odd combinada tem de ficar entre ${rules.oddsMin.toFixed(
          2
        )} e ${rules.oddsMax.toFixed(2)}.`
      : "";

  return {
    ...base,
    state: "play",
    blocked: false,
    action: `Aposta ${eur.format(stake)} a uma odd de ${targetOdds.toFixed(2)}`,
    detail: `Dia ${day}: ${pct}% da banca de ${eur.format(standing.bankroll)}.${band}`,
  };
}
