import { parseRules } from "@/lib/challengeRules";
import { tally, type PlayerTally } from "@/lib/headToHead";
import {
  buildStanding,
  type PlanBet,
  type PlanFunds,
  type PlanMember,
  type PlanRecord,
} from "@/lib/planStore";

/** Below this many settled days, a gap is noise wearing a number. */
export const MIN_SETTLED = 3;

export interface Rivalry {
  plan: PlanRecord;
  me: PlayerTally;
  /** Everybody else in the challenge, best first. */
  others: PlayerTally[];
  /** The one to beat, or to stay ahead of. */
  closest: PlayerTally;
  /** Mine minus theirs: positive while ahead, negative while behind. */
  gap: number;
  /** Nobody has played enough for the gap to settle an argument. */
  early: boolean;
}

/**
 * Where this person stands against the people they are playing against.
 *
 * On profit, not on the bankroll: once somebody puts €50 in, the bankroll says
 * they are winning and the betting says otherwise. Profit is the number that
 * still means something afterwards, and it is the one the challenge page's own
 * head-to-head already leads on.
 *
 * A challenge with nobody else in it is not here. There is no gap to a person
 * who does not exist, and inventing a card about it is how a page starts
 * talking to fill the silence.
 */
export function rivalries(
  userId: string,
  plans: PlanRecord[],
  members: PlanMember[],
  bets: (PlanBet & { planId: string })[],
  funds: (PlanFunds & { planId: string })[] = []
): Rivalry[] {
  const out: Rivalry[] = [];

  for (const plan of plans) {
    const roster = members.filter((entry) => entry.plan_id === plan.id);
    const mine = roster.find((entry) => entry.user_id === userId);
    if (!mine || roster.length < 2) continue;

    const rules = parseRules(plan.rules, plan.days);
    const planBets = bets.filter((bet) => bet.planId === plan.id);
    const planFunds = funds.filter((entry) => entry.planId === plan.id);

    const tallies = roster.map((member) =>
      tally(buildStanding(member, rules, planBets, planFunds))
    );

    const me = tallies.find((entry) => entry.userId === userId);
    if (!me) continue;

    const others = tallies
      .filter((entry) => entry.userId !== userId)
      .sort((a, b) => b.profit - a.profit || (b.roi ?? 0) - (a.roi ?? 0));

    if (others.length === 0) continue;

    const closest = others[0];

    out.push({
      plan,
      me,
      others,
      closest,
      gap: Number((me.profit - closest.profit).toFixed(2)),
      early: [me, ...others].some((entry) => entry.settled < MIN_SETTLED),
    });
  }

  // Behind first, and the narrowest gap of those: the one still winnable is
  // the one worth putting at the top.
  return out.sort((a, b) => {
    if (a.gap < 0 !== b.gap < 0) return a.gap < 0 ? -1 : 1;
    return a.gap < 0 ? b.gap - a.gap : a.gap - b.gap;
  });
}
