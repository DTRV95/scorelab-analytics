import type { PlayerStanding } from "@/lib/planStore";

/**
 * Below this, a head-to-head is noise dressed as a result.
 *
 * Two settled days can put somebody "ahead" on every measure at once and mean
 * nothing at all. The card still shows the numbers — they are the person's own
 * record and worth seeing — but it says out loud that they do not settle
 * anything yet.
 */
export const MIN_SETTLED = 5;

export interface PlayerTally {
  userId: string;
  name: string;
  /** What the betting did. Money put into the bankroll is not in here. */
  profit: number;
  staked: number;
  /**
   * Profit per euro staked, as a percentage.
   *
   * The fair comparison, and the reason profit alone is not: staking €7.50 a
   * day against somebody staking €5 wins more euros on the same judgement.
   */
  roi: number | null;
  settled: number;
  greens: number;
  reds: number;
  hitRate: number | null;
  /** The longest run of days won, not only the run still going. */
  bestStreak: number;
  /** The best price that actually landed. */
  bestOdds: number | null;
  day: number;
}

export function tally(standing: PlayerStanding): PlayerTally {
  const decided = standing.bets.filter((bet) => bet.status !== "pending");
  const staked = decided.reduce((total, bet) => total + bet.stake, 0);

  let streak = 0;
  let bestStreak = 0;
  let bestOdds: number | null = null;

  for (const bet of standing.bets) {
    if (bet.status === "green") {
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
      if (bestOdds === null || bet.odds > bestOdds) bestOdds = bet.odds;
    } else if (bet.status === "red") {
      streak = 0;
    }
  }

  return {
    userId: standing.userId,
    name: standing.name,
    profit: standing.profit,
    staked: Number(staked.toFixed(2)),
    roi: staked > 0 ? Number(((standing.profit / staked) * 100).toFixed(1)) : null,
    settled: standing.settled,
    greens: standing.greens,
    reds: standing.reds,
    hitRate:
      standing.settled > 0
        ? Number(((standing.greens / standing.settled) * 100).toFixed(0))
        : null,
    bestStreak,
    bestOdds,
    day: standing.day,
  };
}

export interface Duel {
  tallies: PlayerTally[];
  /** Whoever is up on the money, which is what anybody actually argues about. */
  leader: PlayerTally | null;
  /** How far ahead of the next one, in euros. */
  margin: number;
  /** Too few settled days for any of this to mean much yet. */
  early: boolean;
}

/**
 * The two of them side by side.
 *
 * Leading is decided on profit, because that is the thing people argue about,
 * with profit per euro breaking a tie — the one that says who is actually
 * judging games better rather than who is staking more.
 */
export function duel(standings: PlayerStanding[]): Duel {
  const tallies = standings.map(tally);

  const ranked = [...tallies].sort(
    (a, b) => b.profit - a.profit || (b.roi ?? 0) - (a.roi ?? 0)
  );

  const leader = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;
  const tied =
    leader !== null &&
    runnerUp !== null &&
    leader.profit === runnerUp.profit &&
    (leader.roi ?? 0) === (runnerUp.roi ?? 0);

  return {
    tallies,
    leader: tied ? null : leader,
    margin:
      leader && runnerUp ? Number((leader.profit - runnerUp.profit).toFixed(2)) : 0,
    early:
      tallies.length < 2 ||
      tallies.some((entry) => entry.settled < MIN_SETTLED),
  };
}

/** Who is ahead on one measure, or null when nobody is. */
export function aheadOn(
  tallies: PlayerTally[],
  read: (entry: PlayerTally) => number | null
): string | null {
  let best: PlayerTally | null = null;
  let tie = false;

  for (const entry of tallies) {
    const value = read(entry);
    if (value === null) continue;
    const current = best === null ? null : read(best);
    if (current === null || value > current) {
      best = entry;
      tie = false;
    } else if (value === current) {
      tie = true;
    }
  }

  return tie || best === null ? null : best.userId;
}
