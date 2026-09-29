import { MIN_DECIDED } from "@/lib/bettingStyle";
import type { PlanBet } from "@/lib/planStore";

export interface Band {
  label: string;
  bets: number;
  won: number;
  lost: number;
  /** Null until enough days are decided for a percentage to mean anything. */
  winPct: number | null;
  profit: number;
  staked: number;
  /** Profit per euro staked, as a percentage. */
  roi: number | null;
}

function round(value: number, places = 2): number {
  return Number(value.toFixed(places));
}

function band(label: string, bets: PlanBet[]): Band {
  const won = bets.filter((bet) => bet.status === "green").length;
  const lost = bets.filter((bet) => bet.status === "red").length;
  const settled = won + lost;
  const decided = bets.filter((bet) => bet.status !== "pending");
  const staked = decided.reduce((sum, bet) => sum + bet.stake, 0);
  const profit = decided.reduce((sum, bet) => sum + bet.profitLoss, 0);

  return {
    label,
    bets: bets.length,
    won,
    lost,
    winPct: settled >= MIN_DECIDED ? round((won / settled) * 100, 0) : null,
    profit: round(profit),
    staked: round(staked),
    roi: staked > 0 ? round((profit / staked) * 100, 1) : null,
  };
}

const ODDS_BANDS: { label: string; from: number; to: number }[] = [
  { label: "até 1.50", from: 0, to: 1.5 },
  { label: "1.50 a 1.90", from: 1.5, to: 1.9 },
  { label: "1.90 a 2.50", from: 1.9, to: 2.5 },
  { label: "2.50 ou mais", from: 2.5, to: Infinity },
];

/**
 * How the bets went, grouped by the price they were taken at.
 *
 * The question nobody can answer from a list of bets: are the short prices
 * carrying this, or the long ones? Two people betting the same games at
 * different prices end up in different places, and this is where that shows.
 */
export function byOddsBand(bets: PlanBet[]): Band[] {
  return ODDS_BANDS.map((range) =>
    band(
      range.label,
      bets.filter((bet) => bet.odds >= range.from && bet.odds < range.to)
    )
  ).filter((row) => row.bets > 0);
}

const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

/** How the bets went by the day of the week they were placed. */
export function byWeekday(bets: PlanBet[]): Band[] {
  const rows = WEEKDAYS.map((label, index) =>
    band(
      label,
      bets.filter((bet) => {
        const date = new Date(bet.placedAt);
        return !Number.isNaN(date.getTime()) && date.getDay() === index;
      })
    )
  ).filter((row) => row.bets > 0);

  // Monday first: a week that starts on Sunday reads as a mistake here.
  return [...rows.slice(1), ...rows.filter((row) => row.label === "domingo")];
}

export interface Summary {
  bets: number;
  settled: number;
  won: number;
  lost: number;
  open: number;
  winPct: number | null;
  staked: number;
  profit: number;
  roi: number | null;
  /** The biggest single day, up and down. */
  best: number;
  worst: number;
}

/** The whole record in one row of figures. */
export function summarise(bets: PlanBet[]): Summary {
  const all = band("tudo", bets);
  const decided = bets.filter((bet) => bet.status !== "pending");

  return {
    bets: bets.length,
    settled: all.won + all.lost,
    won: all.won,
    lost: all.lost,
    open: bets.length - (all.won + all.lost),
    winPct: all.winPct,
    staked: all.staked,
    profit: all.profit,
    roi: all.roi,
    best: decided.length
      ? round(Math.max(...decided.map((bet) => bet.profitLoss)))
      : 0,
    worst: decided.length
      ? round(Math.min(...decided.map((bet) => bet.profitLoss)))
      : 0,
  };
}
