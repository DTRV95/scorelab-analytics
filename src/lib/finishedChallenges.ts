import { parseRules } from "@/lib/challengeRules";
import { tally, type PlayerTally } from "@/lib/headToHead";
import {
  buildStanding,
  type PlanBet,
  type PlanFunds,
  type PlanMember,
  type PlanRecord,
} from "@/lib/planStore";

/**
 * What is left of a challenge once it is over.
 *
 * Nothing here is stored: it is read back off the bets, the same way the
 * standings are while the challenge is running. That is the point — a figure
 * written down at the moment of ending would drift away from the bets behind
 * it the first time somebody corrected one, and then the record would be
 * saying something the challenge itself denies.
 */

export interface FinishedPlayer extends PlayerTally {
  bankroll: number;
  startingBankroll: number;
  /** Money put in or taken out, which is not winnings. */
  added: number;
}

export interface FinishedChallenge {
  plan: PlanRecord;
  endedAt: string;
  /** The first bet, which is when it really started. */
  startedAt: string | null;
  /** Days between the first bet and the end. Null before anything was bet. */
  lasted: number | null;
  players: FinishedPlayer[];
  /** This person's own row, when they were in it. */
  me: FinishedPlayer | null;
  /** Whoever ended up with most made from betting, in a challenge of two. */
  winner: FinishedPlayer | null;
  /** Everybody's money, added up, as it finished. */
  bankroll: number;
  /** What the betting did, deposits left out. */
  profit: number;
  bets: number;
  /** The level reached, out of the level the ladder was meant to end on. */
  day: number;
  days: number;
  /** Whether the money actually got to where it was going. */
  hitTarget: boolean;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: string | null, to: string): number | null {
  if (!from) return null;
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(1, Math.round((end - start) / DAY));
}

/**
 * Every challenge this person was in that has been given as over, newest
 * first.
 *
 * Sorted by when they ended rather than when they started: what somebody
 * looking at a shelf of finished challenges wants first is the one they just
 * closed.
 */
export function finishedChallenges(
  userId: string,
  plans: PlanRecord[],
  members: PlanMember[],
  bets: (PlanBet & { planId: string })[],
  funds: (PlanFunds & { planId: string })[] = []
): FinishedChallenge[] {
  const finished: FinishedChallenge[] = [];

  for (const plan of plans) {
    if (!plan.ended_at) continue;

    const its = members.filter((entry) => entry.plan_id === plan.id);
    if (!its.some((entry) => entry.user_id === userId)) continue;

    const rules = parseRules(plan.rules, plan.days);
    const planBets = bets.filter((bet) => bet.planId === plan.id);
    const planFunds = funds.filter((entry) => entry.planId === plan.id);

    const players: FinishedPlayer[] = its.map((member) => {
      const standing = buildStanding(
        member,
        rules,
        planBets.filter((bet) => bet.userId === member.user_id),
        planFunds.filter((entry) => entry.userId === member.user_id)
      );

      return {
        ...tally(standing),
        bankroll: standing.bankroll,
        startingBankroll: standing.startingBankroll,
        added: standing.added,
      };
    });

    const placed = planBets
      .map((bet) => bet.placedAt)
      .filter((at): at is string => Boolean(at))
      .sort();

    const me = players.find((player) => player.userId === userId) ?? null;
    const ranked = [...players].sort((a, b) => b.profit - a.profit);
    // Nobody won a challenge of one, and nobody won a dead heat.
    const winner =
      ranked.length > 1 && ranked[0].profit !== ranked[1].profit
        ? ranked[0]
        : null;

    finished.push({
      plan,
      endedAt: plan.ended_at,
      startedAt: placed[0] ?? plan.start_date,
      lasted: daysBetween(placed[0] ?? plan.start_date, plan.ended_at),
      players,
      me,
      winner,
      bankroll: round(
        players.reduce((total, player) => total + player.bankroll, 0)
      ),
      profit: round(
        players.reduce((total, player) => total + player.profit, 0)
      ),
      bets: planBets.length,
      day: me?.day ?? Math.max(...players.map((player) => player.day), 1),
      days: rules.days,
      hitTarget: players.some(
        (player) => player.bankroll >= Number(plan.target)
      ),
    });
  }

  return finished.sort((a, b) => b.endedAt.localeCompare(a.endedAt));
}
