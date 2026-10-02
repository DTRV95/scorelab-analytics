import type { PlayerStyle } from "@/lib/bettingStyle";
import { canonicalMarket } from "@/lib/marketNames";
import type { LeagueReport } from "@/lib/leagueReport";

/**
 * The three things that were never in the same place.
 *
 * The competition knows how often this market comes in. The price knows how
 * often it has to come in to pay for itself. The record knows how often it has
 * come in for the person about to back it. Each of those lived on its own page,
 * and none of them was on screen at the moment somebody typed an odd.
 *
 * Nothing here forecasts a game. Two of the three numbers are counts of games
 * already played and the third is arithmetic on the price — which is exactly
 * why they can be put side by side without pretending to be a tip.
 */

/** Enough decided legs of one's own before the rate is worth quoting. */
export const MIN_OWN = 5;

export interface Source {
  pct: number;
  /** What the percentage is made of: 48 of 94, 9 of 14. */
  hits: number;
  of: number;
}

export interface LegContext {
  /** The market as everything else in the app counts it. */
  market: string;
  /** What the price has to deliver to break even, as a percentage. */
  required: number | null;
  /** How often the competition gives it, this season. */
  league: (Source & { league: string }) | null;
  /** How often this person's own bets on it have come in. */
  own: Source | null;
}

function round(value: number): number {
  return Math.round(value);
}

/**
 * The hit rate a price demands to break even: a 1.25 needs four in five.
 *
 * Quoted without the bookmaker's margin taken out, because that is the number
 * the person is actually being asked to beat.
 */
export function requiredPct(odds: number): number | null {
  if (!Number.isFinite(odds) || odds <= 1) return null;
  return round(100 / odds);
}

/** How often a competition gave this market, out of the games it has played. */
export function leagueRate(
  report: LeagueReport | null | undefined,
  market: string,
): (Source & { league: string }) | null {
  if (!report || report.played === 0) return null;

  const canonical = canonicalMarket(market);
  const row = report.markets.find((entry) => entry.mercado === canonical);
  if (!row || row.pct === null) return null;

  return {
    pct: round(row.pct),
    hits: row.jogos,
    of: report.played,
    league: report.league,
  };
}

/**
 * How this person's own bets on the market have gone.
 *
 * Legs inside a multiple somebody marked lost by hand are left out upstream —
 * they say the day went down, not which game took it — so a thin market stays
 * thin rather than being filled with guesses.
 */
export function ownRate(
  style: PlayerStyle | null | undefined,
  market: string,
): Source | null {
  if (!style) return null;

  const canonical = canonicalMarket(market);
  const row = style.markets.find((entry) => entry.market === canonical);
  if (!row || row.hitPct === null) return null;

  const decided = row.landed + row.failed;
  if (decided < MIN_OWN) return null;

  return { pct: round(row.hitPct), hits: row.landed, of: decided };
}

export function legContext({
  market,
  odds,
  report,
  style,
}: {
  market: string;
  odds: number;
  report?: LeagueReport | null;
  style?: PlayerStyle | null;
}): LegContext {
  return {
    market: canonicalMarket(market),
    required: requiredPct(odds),
    league: leagueRate(report, market),
    own: ownRate(style, market),
  };
}

/** Whether a rate covers what the price is asking for. */
export function clears(
  pct: number | null | undefined,
  required: number | null,
): "acima" | "abaixo" | null {
  if (pct === null || pct === undefined || required === null) return null;
  return pct >= required ? "acima" : "abaixo";
}

/**
 * Whether the evidence clears the price, in a word.
 *
 * The competition answers first and the record only when there is no
 * competition to answer: a season of a league is hundreds of games, a person's
 * own record of one market is a handful, and the bigger count is the one worth
 * believing. Without either, there is no verdict — an odd on its own says
 * nothing about whether it is a good odd.
 */
export function clearsThePrice(
  context: LegContext,
): "acima" | "abaixo" | null {
  return clears((context.league ?? context.own)?.pct ?? null, context.required);
}

/** The competitions on a slip whose rates are worth fetching. */
export function leaguesOnSlip(legs: { league: string }[]): string[] {
  return [...new Set(legs.map((leg) => leg.league))];
}
