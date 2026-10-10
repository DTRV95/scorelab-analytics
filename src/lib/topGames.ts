import { dayKey, dayLabels } from "@/components/TodayMatches";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

/** Three is a shortlist. Four is a page of games, which already exists. */
const TOP = 3;

export interface DayPicks {
  short: string;
  long: string;
  items: BoardMatch[];
}

/**
 * The strongest games of each day, soonest day first.
 *
 * Ranked by what the model is surest of, not by kick-off: a clock is not a
 * finding. Games already under way are out — a 92% on something that kicked
 * off an hour ago is a fact, not a tip.
 */
export function topByDay(board: BoardMatch[], limit = TOP): DayPicks[] {
  const now = Date.now();
  const days = new Map<string, DayPicks>();

  for (const match of board) {
    if (!match.kickoff) continue;
    const date = new Date(match.kickoff);
    if (Number.isNaN(date.getTime()) || date.getTime() <= now) continue;

    const key = dayKey(date);
    if (!days.has(key)) days.set(key, { ...dayLabels(date), items: [] });
    days.get(key)!.items.push(match);
  }

  return [...days.values()]
    .map((day) => ({
      ...day,
      items: [...day.items]
        .sort(
          (a, b) =>
            b.headline_pct - a.headline_pct ||
            (a.kickoff ?? "").localeCompare(b.kickoff ?? ""),
        )
        .slice(0, limit),
    }))
    .sort((a, b) =>
      (a.items[0]?.kickoff ?? "").localeCompare(b.items[0]?.kickoff ?? ""),
    );
}
