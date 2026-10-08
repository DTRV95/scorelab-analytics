import { MIN_DECIDED } from "@/lib/bettingStyle";
import type { PlanBet } from "@/lib/planStore";

export interface Band {
  label: string;
  bets: number;
  won: number;
  lost: number;
  /** The real hit rate. Null only when nothing in the band is decided. */
  winPct: number | null;
  /**
   * Whether there is enough decided for the rate to settle an argument.
   *
   * The rate is shown either way: printing "2 de 2" beside a dash makes a
   * page look like it cannot divide, and the reader does the division anyway.
   * What a thin band gets is a warning, not a silence.
   */
  enough: boolean;
  profit: number;
  staked: number;
  /** Profit per euro staked, as a percentage. */
  roi: number | null;
  /**
   * The hit rate these prices demanded before a cent of profit.
   *
   * The number that turns a hit rate into a verdict. 68% looks healthy until
   * the prices behind it wanted 72%, and nothing on a page showing only the
   * hit rate and the profit can say which of those two it was.
   */
  breakEven: number | null;
}

function round(value: number, places = 2): number {
  return Number(value.toFixed(places));
}

/**
 * The hit rate a set of prices needs to come out level.
 *
 * Stake-weighted, because a tenner at 1.30 and a euro at 3.00 do not ask the
 * same thing of a record: break-even is where the returns equal the outlay,
 * so it is the total staked over the total that would come back.
 */
function breakEven(bets: PlanBet[]): number | null {
  const returns = bets.reduce((sum, bet) => sum + bet.stake * bet.odds, 0);
  if (returns <= 0) return null;

  const staked = bets.reduce((sum, bet) => sum + bet.stake, 0);
  return round((staked / returns) * 100, 0);
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
    winPct: settled > 0 ? round((won / settled) * 100, 0) : null,
    enough: settled >= MIN_DECIDED,
    profit: round(profit),
    staked: round(staked),
    roi: staked > 0 ? round((profit / staked) * 100, 1) : null,
    breakEven: breakEven(decided),
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

const LEG_BANDS: { label: string; from: number; to: number }[] = [
  { label: "até 1.30", from: 0, to: 1.3 },
  { label: "1.30 a 1.50", from: 1.3, to: 1.5 },
  { label: "1.50 a 1.80", from: 1.5, to: 1.8 },
  { label: "1.80 a 2.50", from: 1.8, to: 2.5 },
  { label: "2.50 ou mais", from: 2.5, to: Infinity },
];

/** Below this many games, a band is shown but never called good or bad. */
export const MIN_FOR_VERDICT = 5;

export interface LegBand {
  label: string;
  legs: number;
  won: number;
  lost: number;
  /** The real hit rate. Null only when nothing in the band is decided. */
  winPct: number | null;
  /** What these prices asked for, with every game weighing the same. */
  breakEven: number;
  /** Points above or below that. Null until there are enough games to say. */
  edge: number | null;
  /** Whether there is enough here to call the band good or bad. */
  enough: boolean;
}

/**
 * How the individual games went, grouped by the price each one was taken at.
 *
 * Not the same question as the slip's odd, and the more useful of the two:
 * a multiple at 2.85 says nothing about whether somebody judges a 1.30
 * favourite well. This is the one that answers "at what prices am I right".
 */
export function byLegOdds(bets: PlanBet[]): LegBand[] {
  const legs = bets
    .flatMap((bet) => bet.legs)
    .filter((leg) => leg.status === "green" || leg.status === "red")
    .filter((leg) => leg.odds > 1);

  return LEG_BANDS.map((range) => {
    const inBand = legs.filter(
      (leg) => leg.odds >= range.from && leg.odds < range.to
    );
    const won = inBand.filter((leg) => leg.status === "green").length;
    const lost = inBand.length - won;

    // Equal weight per game: a leg carries no stake of its own, it is one of
    // several prices multiplied into a single slip.
    const demanded =
      inBand.length > 0
        ? (inBand.length / inBand.reduce((sum, leg) => sum + leg.odds, 0)) * 100
        : 0;

    const hit = inBand.length > 0 ? (won / inBand.length) * 100 : null;

    const enough = inBand.length >= MIN_FOR_VERDICT;

    return {
      label: range.label,
      legs: inBand.length,
      won,
      lost,
      winPct: hit === null ? null : round(hit, 0),
      breakEven: round(demanded, 0),
      edge: enough && hit !== null ? round(hit - demanded, 0) : null,
      enough,
    };
  }).filter((row) => row.legs > 0);
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
  /**
   * The hit rate these prices demanded before a cent of profit.
   *
   * Carried up from the band so that the record can be read as a verdict
   * rather than a number: 68% looks healthy until the prices behind it wanted
   * 72%. Null when nothing is decided.
   */
  breakEven: number | null;
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
    breakEven: all.breakEven,
  };
}
