import { canonicalMarket } from "@/lib/marketNames";
import type { PlanBet } from "@/lib/planStore";

export interface TypingMemory {
  /** Markets already written on these slips, most used first. */
  markets: string[];
  /** Team names already written, most used first. */
  teams: string[];
}

/** Accents and case are not signal: "Suiça" and "Suíça" are one team. */
function key(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Counts the spellings of one thing and keeps the most used of them.
 *
 * Not the first seen: the spelling somebody writes most is the one they will
 * recognise in a list, and the odd one out is usually the typo.
 */
function rank(values: string[]): string[] {
  const groups = new Map<string, Map<string, number>>();

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const id = key(trimmed);
    if (!id) continue;
    const spellings = groups.get(id) ?? new Map<string, number>();
    spellings.set(trimmed, (spellings.get(trimmed) ?? 0) + 1);
    groups.set(id, spellings);
  }

  return [...groups.values()]
    .map((spellings) => {
      const total = [...spellings.values()].reduce((sum, n) => sum + n, 0);
      const [best] = [...spellings.entries()].sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      return { label: best[0], total };
    })
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
}

/**
 * What has already been typed on this challenge's slips.
 *
 * Every game these two have ever bet was typed by hand, and it shows: the same
 * side went in as "Gales" and "País de Gales", "Chequia" and "Chéquia". Each
 * spelling is a team of its own to anything that counts them. Offering back
 * what was typed before is how the next one lands on a name that already
 * exists instead of inventing a third.
 */
export function typingMemory(bets: PlanBet[]): TypingMemory {
  const legs = bets.flatMap((bet) => bet.legs);

  return {
    markets: rank(legs.map((leg) => canonicalMarket(leg.market))),
    teams: rank(legs.flatMap((leg) => [leg.homeTeam, leg.awayTeam])),
  };
}
