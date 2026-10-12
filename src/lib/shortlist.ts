import type { BoardMatch } from "@/lib/probabilityBoardCache";

/**
 * The games worth looking at, and the price each one has to pay.
 *
 * Measured on 91 games already played and scored, the board's own record
 * splits cleanly in two:
 *
 *     dupla hipótese com 70%+   25 jogos   88% certos
 *     só 70%+                   29 jogos   83%
 *     só dupla hipótese         57 jogos   70%
 *     tudo o que destaca        91 jogos   63%
 *     golos / ambas marcam      32 jogos   47%
 *
 * A third of what the board leads with is a coin flip, and it is all in the
 * goals and both-teams-to-score markets: a score is the one thing the model
 * is asked to invent, while "this side does not lose" is the one thing a
 * season of results actually measures. The confidence only starts meaning
 * something at seventy — between 65% and 69% the board hit 47%, below 65% it
 * hit 56%, and above 70% it hit 83%.
 *
 * None of which is a bet. A pick that lands 88% of the time is worth money
 * only above the price that 88% is worth, and the bookmaker knows the Benfica
 * does not lose at home too — so the minimum odd travels with every pick.
 */

/** What a season of results can measure: a side not losing. */
export const SHORTLIST_MARKETS = ["1X", "2X"];

/** Under this the forecast carries no information worth acting on. */
export const SHORTLIST_MIN_PCT = 70;

export interface Pick {
  headline_market: string;
  headline_pct: number;
}

export function onShortlist(match: Pick): boolean {
  return (
    SHORTLIST_MARKETS.includes(match.headline_market) &&
    match.headline_pct >= SHORTLIST_MIN_PCT
  );
}

/**
 * The odd a pick has to beat to be worth taking.
 *
 * Break-even, and rounded up: at 88% the fair price is 1.136, and quoting
 * 1.13 would be telling somebody a losing bet is an even one.
 */
export function minimumOdd(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  if (pct >= 100) return 1;
  return Math.ceil((100 / pct) * 100) / 100;
}

/** Of several picks taken together, what the whole slip has to pay. */
export function minimumOddOfSlip(pcts: number[]): number {
  if (pcts.length === 0) return 0;
  const together = pcts.reduce((chance, pct) => chance * (pct / 100), 1);
  return minimumOdd(together * 100);
}

export function shortlistOf(matches: BoardMatch[]): BoardMatch[] {
  return matches.filter((match) => onShortlist(match));
}
