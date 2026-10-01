import type { PlanBet, PlanFunds, PlanMember } from "@/lib/planStore";

export interface NewsItem {
  planId: string;
  /** Registered a day, closed one, or moved money. */
  kind: "placed" | "settled" | "funds";
  at: string;
  userId: string;
  name: string;
  day: number;
  /** For a day closed: whether it landed. */
  won?: boolean;
  /** For money moved: how much, negative when taken out. */
  amount?: number;
}

function nameOf(members: PlanMember[], planId: string, userId: string): string {
  return (
    members.find(
      (entry) => entry.plan_id === planId && entry.user_id === userId
    )?.display_name ?? "Alguém"
  );
}

/**
 * What the other players did since this person last looked.
 *
 * Only other people: a list that opens with your own bets is a list nobody
 * reads. And only what somebody did — a day registered, a day closed, money
 * moved — never a state, because "está a ganhar" was already true yesterday
 * and is not news.
 *
 * With no mark yet, everything counts as new. The alternative is for somebody
 * opening the app for the first time to be told nothing has happened, which is
 * false and is also the worst moment to say it.
 */
export function planNews({
  userId,
  members,
  bets,
  funds = [],
  since,
}: {
  userId: string;
  members: PlanMember[];
  bets: (PlanBet & { planId: string })[];
  funds?: (PlanFunds & { planId: string })[];
  /** When this person last had the challenge open, per challenge. */
  since: Record<string, string | null>;
}): NewsItem[] {
  const items: NewsItem[] = [];

  const after = (planId: string, at: string | null): boolean => {
    if (!at) return false;
    const mark = since[planId];
    return !mark || at > mark;
  };

  for (const bet of bets) {
    if (bet.userId === userId) continue;
    const name = nameOf(members, bet.planId, bet.userId);

    // A day both registered and closed since the last look shows up twice, on
    // purpose: they are two different things to have missed.
    if (after(bet.planId, bet.placedAt)) {
      items.push({
        planId: bet.planId,
        kind: "placed",
        at: bet.placedAt,
        userId: bet.userId,
        name,
        day: bet.day,
      });
    }

    if (bet.status !== "pending" && after(bet.planId, bet.settledAt)) {
      items.push({
        planId: bet.planId,
        kind: "settled",
        at: bet.settledAt as string,
        userId: bet.userId,
        name,
        day: bet.day,
        won: bet.status === "green",
      });
    }
  }

  for (const entry of funds) {
    if (entry.userId === userId) continue;
    if (!after(entry.planId, entry.at)) continue;

    items.push({
      planId: entry.planId,
      kind: "funds",
      at: entry.at,
      userId: entry.userId,
      name: nameOf(members, entry.planId, entry.userId),
      day: 0,
      amount: entry.amount,
    });
  }

  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** How many pieces of news each challenge is holding. */
export function newsByPlan(items: NewsItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.planId] = (counts[item.planId] ?? 0) + 1;
  }
  return counts;
}

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** One piece of news, in the words somebody would use. */
export function describeNews(item: NewsItem): string {
  if (item.kind === "placed") return `${item.name} registou o dia ${item.day}`;
  if (item.kind === "settled") {
    return `${item.name} ${item.won ? "ganhou" : "perdeu"} o dia ${item.day}`;
  }

  const amount = item.amount ?? 0;
  return amount < 0
    ? `${item.name} tirou ${eur.format(Math.abs(amount))} da banca`
    : `${item.name} juntou ${eur.format(amount)} à banca`;
}
