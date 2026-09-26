import type { BoardMatch } from "@/lib/probabilityBoardCache";

/**
 * The competitions the data provider covers on the free tier.
 *
 * Mirrors SUPPORTED_LEAGUES in backend/football_data.py. A test over there
 * reads this file and fails if the two lists drift, because a league missing
 * from here would quietly stop being counted — which is the exact failure this
 * list exists to make visible.
 */
export const COVERED_LEAGUES = [
  "Liga Portugal",
  "Premier League",
  "Championship",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Eredivisie",
] as const;

export interface LeagueCount {
  league: string;
  count: number;
}

/**
 * How many games each covered competition is putting on the board.
 *
 * The picker used to rank every game by probability and show the best twelve,
 * which meant a competition could be on the board and never once appear on
 * screen — indistinguishable, from the outside, from the provider not sending
 * it at all. Counting every covered competition, zeroes included, turns that
 * into something the page can just say.
 */
export function leagueCounts(matches: BoardMatch[]): LeagueCount[] {
  const counts = new Map<string, number>(
    COVERED_LEAGUES.map((league) => [league, 0])
  );

  for (const match of matches) {
    counts.set(match.league, (counts.get(match.league) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([league, count]) => ({ league, count }))
    .sort(
      (a, b) => b.count - a.count || a.league.localeCompare(b.league, "pt")
    );
}
