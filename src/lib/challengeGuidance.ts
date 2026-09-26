/**
 * What to do next, said in one place.
 *
 * The table is the instruction: it says which day you are on, how much to put
 * down and at what price. What it cannot say is how the bet went, so the real
 * bankroll is tracked beside it and the two are shown together rather than one
 * being quietly recalculated into the other.
 */

import type { ChallengeRules, Rung } from "@/lib/challengeRules";
import { isShort, stakeForDay } from "@/lib/challengeRules";
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
  /** The day of the table this player is on. */
  day: number;
  /** What to stake today: the table's figure, or everything left if less. */
  stake: number;
  /** The odd the table pencils in for this day. */
  targetOdds: number;
  /** What the table says the bankroll should be at the start of this day. */
  tableBankroll: number;
  /** Real money minus the table's figure: the cushion, or the hole. */
  versusTable: number;
  /** True when the bankroll cannot cover what the table asks for. */
  short: boolean;
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
 * What the last decided day did to this player's place in the table.
 *
 * A day won is a step up, a day lost is a step back. Saying which day they
 * were on and which they are on now is the difference between a number
 * changing and a person understanding why it changed.
 */
function lastLine(standing: PlayerStanding, day: number): string | null {
  const bet = standing.lastSettled;
  if (!bet) return null;

  if (bet.status === "green") {
    return `Ganhaste o dia ${bet.day}, +${eur.format(
      bet.profitLoss,
    )}. Avanças para o dia ${day}.`;
  }

  if (bet.status === "red") {
    return `Perdeste o dia ${bet.day}, ${eur.format(bet.profitLoss)}.${
      day < bet.day
        ? ` Recuas para o dia ${day}.`
        : " Já estavas no primeiro dia."
    }`;
  }

  return null;
}

export function nextMove({
  rules,
  ladder,
  standing,
  schedule,
  target,
}: {
  rules: ChallengeRules;
  ladder: Rung[];
  standing: PlayerStanding;
  schedule: PlanSchedule;
  target: number;
}): NextMove {
  const day = Math.min(Math.max(standing.day, 1), ladder.length);
  const row = ladder[day - 1];
  const stake = stakeForDay(ladder, day, standing.bankroll);
  const targetOdds = row?.odds ?? 0;
  const tableBankroll = row?.bankrollStart ?? 0;
  const last = lastLine(standing, standing.day);
  const short = isShort(ladder, day, standing.bankroll);

  const base = {
    day,
    stake,
    targetOdds,
    tableBankroll,
    versusTable: Number((standing.bankroll - tableBankroll).toFixed(2)),
    short,
    last,
  };

  if (standing.bankroll <= 0) {
    return {
      ...base,
      state: "broke",
      blocked: true,
      action: "A banca acabou",
      detail: "Não há nada para apostar: o quadro tem de recomeçar.",
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
          ? "A banca só mexe quando esta fechar."
          : `${standing.openBets} apostas por decidir. A banca só mexe quando fecharem.`,
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
      detail: `No dia 1 são ${eur.format(stake)} a ${targetOdds.toFixed(2)}.`,
    };
  }

  if (schedule.state === "finished") {
    return {
      ...base,
      state: "finished",
      blocked: true,
      action: "O desafio chegou ao fim",
      detail: `Dia ${day} de ${rules.days}, com ${eur.format(standing.bankroll)}.`,
    };
  }

  if (
    rules.lossStreakPause !== null &&
    standing.lossStreak >= rules.lossStreakPause
  ) {
    return {
      ...base,
      state: "paused",
      blocked: true,
      action: "Hoje não se aposta",
      detail: `${standing.lossStreak} perdas seguidas. Amanhã são ${eur.format(
        stake,
      )} a ${targetOdds.toFixed(2)}.`,
    };
  }

  // Short on purpose: the numbers are already on the card, and a paragraph
  // under them is what makes a phone screen look like a form.
  const band =
    rules.oddsMin !== null && rules.oddsMax !== null
      ? ` · odd entre ${rules.oddsMin.toFixed(2)} e ${rules.oddsMax.toFixed(2)}`
      : "";

  const detail = short
    ? `O quadro pede ${eur.format(row?.stake ?? 0)}, só tens ${eur.format(
        standing.bankroll,
      )}: vai tudo${band}`
    : `Dia ${day} de ${rules.days}${band}`;

  return {
    ...base,
    state: "play",
    blocked: false,
    action: `Aposta ${eur.format(stake)} a uma odd de ${targetOdds.toFixed(2)}`,
    detail,
  };
}
