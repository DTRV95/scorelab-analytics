/**
 * How somebody bets, read off the bets themselves.
 *
 * The one thing this has to be careful about: a day made of several games that
 * was marked lost by hand says only that the day went down, not which game took
 * it. Those legs are counted as backed and left out of every hit rate, because
 * blaming all of them — or none — would invent a result nobody reported.
 */

import { canonicalMarket } from "@/lib/marketNames";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

export type LegOutcome = "landed" | "failed" | "unknown";

export interface MarketStyle {
  market: string;
  /** Times this market was backed, decided or not. */
  backed: number;
  landed: number;
  failed: number;
  unknown: number;
  /** Of the legs whose own result is known. Null when none are. */
  hitPct: number | null;
  avgOdds: number;
  /** The model's average call on it, over the legs that carried one. */
  avgModelProb: number | null;
}

export interface SizeStyle {
  /** Games in the bet. The last bucket holds everything at or above it. */
  legs: number;
  label: string;
  bets: number;
  won: number;
  lost: number;
  open: number;
  winPct: number | null;
  profit: number;
}

export interface PlayerStyle {
  userId: string;
  name: string;
  bets: number;
  won: number;
  lost: number;
  open: number;
  staked: number;
  profit: number;
  winPct: number | null;
  avgLegs: number;
  avgOdds: number;
  markets: MarketStyle[];
  sizes: SizeStyle[];
  /** Legs inside a hand-marked losing multiple: backed, never resolved. */
  undecided: number;
  /** Backed most often. */
  favourite: MarketStyle | null;
  /** Best hit rate among markets with enough decided legs to mean anything. */
  sharpest: MarketStyle | null;
  /** Most decided legs lost. */
  weakest: MarketStyle | null;
}

/** Below this, a hit rate is a coin landing twice, not a finding. */
export const MIN_DECIDED = 3;

const SIZE_BUCKETS = [1, 2, 3, 4] as const;

/**
 * Did this leg land?
 *
 * A won bet carries every leg with it — a multiple pays only when all of them
 * land, so each one is known even if nothing wrote it down. Everything else
 * comes from the leg's own status.
 */
export function legOutcome(bet: PlanBet, leg: PlanLeg): LegOutcome {
  if (bet.status === "green") return "landed";
  if (leg.status === "green") return "landed";
  if (leg.status === "red") return "failed";
  return "unknown";
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function marketRows(bets: PlanBet[]): MarketStyle[] {
  const rows = new Map<
    string,
    {
      backed: number;
      landed: number;
      failed: number;
      unknown: number;
      odds: number;
      probSum: number;
      probCount: number;
    }
  >();

  bets.forEach((bet) =>
    bet.legs.forEach((leg) => {
      // Typed by hand, the same bet arrives written five ways. Grouping on
      // the raw text splits "-3.5" from "-3,5 Golos" and the analysis says
      // nothing about either.
      const market = canonicalMarket(leg.market);
      const row = rows.get(market) ?? {
        backed: 0,
        landed: 0,
        failed: 0,
        unknown: 0,
        odds: 0,
        probSum: 0,
        probCount: 0,
      };

      row.backed += 1;
      row.odds += leg.odds;
      if (leg.modelProb > 0) {
        row.probSum += leg.modelProb;
        row.probCount += 1;
      }

      const outcome = legOutcome(bet, leg);
      if (outcome === "landed") row.landed += 1;
      else if (outcome === "failed") row.failed += 1;
      else row.unknown += 1;

      rows.set(market, row);
    })
  );

  return [...rows.entries()]
    .map(([market, row]) => {
      const decided = row.landed + row.failed;
      return {
        market,
        backed: row.backed,
        landed: row.landed,
        failed: row.failed,
        unknown: row.unknown,
        hitPct: decided > 0 ? round((row.landed / decided) * 100, 1) : null,
        avgOdds: round(row.odds / row.backed),
        avgModelProb:
          row.probCount > 0 ? round(row.probSum / row.probCount, 1) : null,
      };
    })
    .sort((a, b) => b.backed - a.backed || a.market.localeCompare(b.market));
}

function sizeRows(bets: PlanBet[]): SizeStyle[] {
  return SIZE_BUCKETS.map((legs) => {
    const last = legs === SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
    const inBucket = bets.filter((bet) =>
      last ? bet.legs.length >= legs : bet.legs.length === legs
    );
    const won = inBucket.filter((bet) => bet.status === "green").length;
    const lost = inBucket.filter((bet) => bet.status === "red").length;
    const settled = won + lost;

    return {
      legs,
      label: last ? `${legs}+ jogos` : legs === 1 ? "1 jogo" : `${legs} jogos`,
      bets: inBucket.length,
      won,
      lost,
      open: inBucket.length - settled,
      winPct: settled > 0 ? round((won / settled) * 100, 1) : null,
      profit: round(inBucket.reduce((sum, bet) => sum + bet.profitLoss, 0)),
    };
  }).filter((row) => row.bets > 0);
}

export function buildPlayerStyle(
  userId: string,
  name: string,
  allBets: PlanBet[]
): PlayerStyle {
  const bets = allBets.filter((bet) => bet.userId === userId);
  const won = bets.filter((bet) => bet.status === "green").length;
  const lost = bets.filter((bet) => bet.status === "red").length;
  const settled = won + lost;
  const markets = marketRows(bets);
  const legs = bets.reduce((sum, bet) => sum + bet.legs.length, 0);

  const decidedEnough = markets.filter(
    (row) => row.landed + row.failed >= MIN_DECIDED
  );

  return {
    userId,
    name,
    bets: bets.length,
    won,
    lost,
    open: bets.length - settled,
    staked: round(bets.reduce((sum, bet) => sum + bet.stake, 0)),
    profit: round(bets.reduce((sum, bet) => sum + bet.profitLoss, 0)),
    winPct: settled > 0 ? round((won / settled) * 100, 1) : null,
    avgLegs: bets.length > 0 ? round(legs / bets.length, 1) : 0,
    avgOdds:
      bets.length > 0
        ? round(bets.reduce((sum, bet) => sum + bet.odds, 0) / bets.length)
        : 0,
    markets,
    sizes: sizeRows(bets),
    undecided: markets.reduce((sum, row) => sum + row.unknown, 0),
    favourite: markets[0] ?? null,
    sharpest:
      [...decidedEnough].sort((a, b) => (b.hitPct ?? 0) - (a.hitPct ?? 0))[0] ??
      null,
    weakest:
      [...decidedEnough].sort((a, b) => (a.hitPct ?? 0) - (b.hitPct ?? 0))[0] ??
      null,
  };
}

/** Everyone's bets read as one. */
export function buildCombinedStyle(bets: PlanBet[], name = "Todos"): PlayerStyle {
  return buildPlayerStyle(
    "__all__",
    name,
    bets.map((bet) => ({ ...bet, userId: "__all__" }))
  );
}
