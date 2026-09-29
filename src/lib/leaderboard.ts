import { parseRules } from "@/lib/challengeRules";
import {
  buildStanding,
  type PlanBet,
  type PlanMember,
  type PlanRecord,
} from "@/lib/planStore";

export interface LeaderRow {
  planId: string;
  planName: string;
  userId: string;
  name: string;
  day: number;
  days: number;
  profit: number;
  bankroll: number;
  target: number;
  /** How far up the mountain, as a share of the whole climb. */
  progress: number;
  settled: number;
}

/**
 * Everybody running the same challenge, in order.
 *
 * Ranked on how much of the climb is done rather than on euros, because the
 * same challenge can be started with €10 or with €200: the one who turned €10
 * into €18 is further along than the one who turned €200 into €210, and the
 * euros say the opposite.
 */
export function leaderboard(
  plans: PlanRecord[],
  members: PlanMember[],
  bets: (PlanBet & { planId: string })[]
): LeaderRow[] {
  const rows: LeaderRow[] = [];

  for (const plan of plans) {
    const rules = parseRules(plan.rules, plan.days);
    const planBets = bets.filter((bet) => bet.planId === plan.id);
    const start = Number(plan.starting_bankroll);
    const target = Number(plan.target);
    const climb = target - start;

    for (const member of members.filter((entry) => entry.plan_id === plan.id)) {
      const standing = buildStanding(member, rules, planBets);
      rows.push({
        planId: plan.id,
        planName: plan.name,
        userId: member.user_id,
        name: member.display_name,
        day: standing.day,
        days: rules.days,
        profit: standing.profit,
        bankroll: standing.bankroll,
        target,
        progress:
          climb > 0
            ? Math.max(0, (standing.bankroll - start) / climb)
            : 0,
        settled: standing.settled,
      });
    }
  }

  return rows.sort(
    (a, b) => b.progress - a.progress || b.day - a.day || b.profit - a.profit
  );
}

/**
 * How many people are running each ready-made challenge.
 *
 * Counts people rather than challenges: two brothers on one shared ladder is
 * two people doing it, which is what "o mais feito" means to anybody reading
 * the list.
 */
export function popularity(
  plans: PlanRecord[],
  members: PlanMember[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const plan of plans) {
    const key = plan.template_key;
    if (!key) continue;
    const people = members.filter((entry) => entry.plan_id === plan.id).length;
    counts[key] = (counts[key] ?? 0) + Math.max(people, 1);
  }

  return counts;
}

/** The busiest models first, keeping the written order to break a tie. */
export function byPopularity<T extends { key: string }>(
  templates: T[],
  counts: Record<string, number>
): T[] {
  return templates
    .map((template, index) => ({ template, index }))
    .sort(
      (a, b) =>
        (counts[b.template.key] ?? 0) - (counts[a.template.key] ?? 0) ||
        a.index - b.index
    )
    .map((entry) => entry.template);
}
