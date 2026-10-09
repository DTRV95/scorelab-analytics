import { parseRules } from "@/lib/challengeRules";
import {
  buildStanding,
  type PlanBet,
  type PlanFunds,
  type PlanMember,
  type PlanRecord,
} from "@/lib/planStore";

/**
 * Everything this account has, added up.
 *
 * The figure in the bar at the top of every page was the bankrolls of the
 * challenges still running, and nothing else — so money sitting in a
 * challenge that had been given as finished vanished from it, and a bet made
 * outside a challenge never counted at all. Neither of those is a reason for
 * money to stop existing.
 *
 * Built from the bets themselves, like every other figure in the app: the
 * starting stake of each challenge, plus what was put in by hand, plus every
 * settled result — the challenges that ended included — plus what the loose
 * bets returned.
 */

export interface GlobalBalance {
  /** The whole lot: what the bar shows. */
  total: number;
  /** Of that, the challenges still being played. */
  running: number;
  /** Of that, the challenges already given as finished. */
  finished: number;
  /** Of that, what bets outside any challenge have returned. */
  loose: number;
  /** What the betting alone did, with money put in by hand left out. */
  profit: number;
  /** Put in or taken out by hand, over every challenge. */
  added: number;
  /** Staked on bets not yet decided, which no total can account for. */
  atRisk: number;
  /** How many challenges are still being played. */
  runningCount: number;
  /** How many have been given as finished. */
  finishedCount: number;
}

const EMPTY: GlobalBalance = {
  total: 0,
  running: 0,
  finished: 0,
  loose: 0,
  profit: 0,
  added: 0,
  atRisk: 0,
  runningCount: 0,
  finishedCount: 0,
};

const round = (value: number) => Number(value.toFixed(2));

export function globalBalance({
  userId,
  plans,
  members,
  bets,
  funds = [],
  looseBets = [],
}: {
  userId: string;
  plans: PlanRecord[];
  members: PlanMember[];
  bets: (PlanBet & { planId: string })[];
  funds?: (PlanFunds & { planId: string })[];
  /** Bets that belong to no challenge. Only their result counts here. */
  looseBets?: PlanBet[];
}): GlobalBalance {
  if (!userId) return EMPTY;

  const found = { ...EMPTY };

  for (const plan of plans) {
    const me = members.find(
      (entry) => entry.plan_id === plan.id && entry.user_id === userId,
    );
    if (!me) continue;

    const standing = buildStanding(
      me,
      parseRules(plan.rules, plan.days),
      bets.filter((bet) => bet.planId === plan.id),
      funds.filter((entry) => entry.planId === plan.id),
    );

    if (plan.ended_at) {
      found.finished += standing.bankroll;
      found.finishedCount += 1;
    } else {
      found.running += standing.bankroll;
      found.runningCount += 1;
    }

    found.profit += standing.profit;
    found.added += standing.added;
    found.atRisk += standing.openStake;
  }

  // A loose bet has no bankroll of its own: what it leaves behind is its
  // result, and the stake of one still open is money already on the table.
  for (const bet of looseBets) {
    if (bet.userId !== userId) continue;
    if (bet.status === "pending") {
      found.atRisk += bet.stake;
      continue;
    }
    found.loose += bet.profitLoss;
    found.profit += bet.profitLoss;
  }

  found.running = round(found.running);
  found.finished = round(found.finished);
  found.loose = round(found.loose);
  found.profit = round(found.profit);
  found.added = round(found.added);
  found.atRisk = round(found.atRisk);
  found.total = round(found.running + found.finished + found.loose);

  return found;
}
