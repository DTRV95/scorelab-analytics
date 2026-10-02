import type { ProbabilityMarket } from "@/components/ProbabilityBreakdown";
import type { LeagueRates } from "@/lib/leagueReport";

/**
 * Where a game differs from the competition it is played in.
 *
 * The board says a game has 62% of going over 2.5. On its own that is a
 * number without a scale: in a league where three goals turn up in half the
 * games it is a reason to look, and in a league where they turn up in two
 * thirds it is below par. The league report had the scale and the board had
 * the forecast, and the two were never on the same screen.
 *
 * Nothing here is a bet. It is one forecast minus one count of games already
 * played, which is why it can be read while browsing without being dressed up
 * as advice.
 */

export interface MatchTip {
  market: string;
  /** What the model gives this game. */
  modelPct: number;
  /** What the competition has given this season. */
  leaguePct: number;
  /** Percentage points between them, always positive on a tip. */
  gap: number;
}

/** Below this the game is an ordinary game of its league, and says nothing. */
export const MIN_GAP = 8;

/**
 * Under this a market is not worth pointing at however unusual it is: a draw
 * at 34% against a league's 26% is still a bet on the least likely outcome.
 */
export const MIN_MODEL = 50;

/** Enough of a season behind the league's rate for it to be a scale at all. */
export const MIN_PLAYED = 20;

export function matchTips(
  markets: ProbabilityMarket[],
  rates: LeagueRates | null | undefined,
  limit = 2,
): MatchTip[] {
  if (!rates || rates.played < MIN_PLAYED) return [];

  const league = new Map(
    rates.markets
      .filter((market) => market.pct !== null)
      .map((market) => [market.mercado, market.pct as number]),
  );

  return markets
    .map((market) => {
      const leaguePct = league.get(market.mercado);
      if (leaguePct === undefined) return null;

      return {
        market: market.mercado,
        modelPct: Math.round(market.probabilidade_pct),
        leaguePct: Math.round(leaguePct),
        gap: Math.round(market.probabilidade_pct - leaguePct),
      };
    })
    .filter(
      (tip): tip is MatchTip =>
        tip !== null && tip.gap >= MIN_GAP && tip.modelPct >= MIN_MODEL,
    )
    .sort((a, b) => b.gap - a.gap)
    .slice(0, limit);
}
