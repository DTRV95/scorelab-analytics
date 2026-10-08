import { nextMove, type NextMove } from "@/lib/challengeGuidance";
import { ladderFor, parseRules } from "@/lib/challengeRules";
import { planSchedule } from "@/lib/challengeSchedule";
import {
  buildStanding,
  type PlanBet,
  type PlanFunds,
  type PlanMember,
  type PlanRecord,
  type PlayerStanding,
} from "@/lib/planStore";

export interface HomeChallenge {
  plan: PlanRecord;
  standing: PlayerStanding;
  move: NextMove;
}

export interface HomeBoard {
  challenges: HomeChallenge[];
  /** Challenges asking for today's bet, which is the reason to open the app. */
  toPlay: HomeChallenge[];
  /** Days already bet and still undecided, which is what blocks everything. */
  toClose: HomeChallenge[];
  /** Every bankroll added up. */
  bankroll: number;
  /** What the betting alone did, with money put in kept out of it. */
  profit: number;
}

/**
 * What the person came to the app to find out, across every challenge at once.
 *
 * The home page was built around saved analyses and showed nothing about the
 * challenges — which are the only thing anybody has actually used it for. The
 * order here is the order of urgency: a day waiting to be closed blocks the
 * ladder, and a day waiting to be bet is the reason to have opened the app.
 */
export function homeBoard(
  userId: string,
  plans: PlanRecord[],
  members: PlanMember[],
  bets: (PlanBet & { planId: string })[],
  funds: (PlanFunds & { planId: string })[] = []
): HomeBoard {
  const challenges: HomeChallenge[] = [];

  for (const plan of plans) {
    // A challenge that is over belongs to the shelf of finished ones, not to
    // the page that says what is going on. Its money is not in play, its
    // ladder is not moving, and nothing about it is for today.
    if (plan.ended_at) continue;

    const me = members.find(
      (entry) => entry.plan_id === plan.id && entry.user_id === userId
    );
    if (!me) continue;

    const rules = parseRules(plan.rules, plan.days);
    const mine = bets.filter((bet) => bet.planId === plan.id);
    const standing = buildStanding(
      me,
      rules,
      mine,
      funds.filter((entry) => entry.planId === plan.id)
    );

    challenges.push({
      plan,
      standing,
      move: nextMove({
        rules,
        ladder: ladderFor(rules, Number(plan.starting_bankroll)),
        standing,
        schedule: planSchedule(plan.start_date, standing.bets.length, rules.days),
        target: Number(plan.target),
      }),
    });
  }

  // A day to close comes before a day to play: the ladder cannot move until
  // the last one is settled, so telling somebody to bet first would be telling
  // them to do the thing that is not yet possible.
  const toClose = challenges.filter((entry) => entry.standing.openBets > 0);
  const toPlay = challenges.filter(
    (entry) => entry.move.state === "play" && entry.standing.openBets === 0
  );

  return {
    challenges,
    toPlay,
    toClose,
    bankroll: Number(
      challenges.reduce((sum, entry) => sum + entry.standing.bankroll, 0).toFixed(2)
    ),
    profit: Number(
      challenges.reduce((sum, entry) => sum + entry.standing.profit, 0).toFixed(2)
    ),
  };
}
