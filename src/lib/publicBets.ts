import type {
  PlanBet,
  PlanMember,
  PlanRecord,
} from "@/lib/planStore";

/**
 * The bets other people are making, from the challenges they opened up.
 *
 * Until now the only bets anybody could see were the ones inside a challenge
 * they were in themselves — so the switch that opens a challenge to everybody
 * made its standings public and its bets, which is what somebody actually
 * wants to look at, reachable from nowhere.
 *
 * Only challenges somebody chose to make public are in here: the server
 * refuses to hand over anybody else's, and this never asks it to.
 */

export interface PublicBet {
  bet: PlanBet;
  planId: string;
  planName: string;
  userId: string;
  /** The name that player goes by in that challenge. */
  name: string;
}

export function publicBets(
  /** Whoever is looking, so their own bets stay out of it. */
  userId: string,
  plans: PlanRecord[],
  members: PlanMember[],
  bets: (PlanBet & { planId: string })[],
  limit = 40
): PublicBet[] {
  const named = new Map<string, { planName: string; byUser: Map<string, string> }>();

  for (const plan of plans) {
    if (!plan.visible) continue;
    named.set(plan.id, {
      planName: plan.name,
      byUser: new Map(
        members
          .filter((entry) => entry.plan_id === plan.id)
          .map((entry) => [entry.user_id, entry.display_name])
      ),
    });
  }

  return bets
    .filter((bet) => bet.userId !== userId && named.has(bet.planId))
    .map((bet) => {
      const plan = named.get(bet.planId)!;
      return {
        bet,
        planId: bet.planId,
        planName: plan.planName,
        userId: bet.userId,
        // A member row that went missing is not a reason to hide the bet, and
        // not a reason to invent a name either.
        name: plan.byUser.get(bet.userId) ?? "Alguém",
      };
    })
    .sort((a, b) => (b.bet.placedAt ?? "").localeCompare(a.bet.placedAt ?? ""))
    .slice(0, limit);
}

/** How long ago, in the words somebody would use out loud. */
export function placedAgo(at: string, now = Date.now()): string {
  const when = new Date(at).getTime();
  if (Number.isNaN(when)) return "";

  const minutes = Math.round((now - when) / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "há 1 hora" : `há ${hours} horas`;

  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;

  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(at));
}
