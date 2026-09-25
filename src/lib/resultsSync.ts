import { buildApiUrl } from "@/lib/apiConfig";

export interface FixtureResult {
  fixture_id: number;
  status: string;
  finished: boolean;
  home_goals: number | null;
  away_goals: number | null;
  kickoff: string | null;
  home_name: string | null;
  away_name: string | null;
}

/** A fixture to look up: the competition is what the lookup is keyed by. */
export interface FixtureRef {
  id: number;
  league: string;
}

/**
 * Final scores for a set of fixtures, one request per competition.
 *
 * All of it is answered from the backend's cached season, so a whole history
 * costs at most one lookup per league. A competition that fails is named
 * rather than silently dropped: a missing league changes what the caller can
 * conclude from what came back.
 */
export async function fetchFixtureResults(
  refs: FixtureRef[]
): Promise<{ results: Map<number, FixtureResult>; unavailable: string[] }> {
  const byLeague = new Map<string, Set<number>>();

  refs.forEach((fixture) => {
    if (!fixture?.id || !fixture.league) return;
    if (!byLeague.has(fixture.league)) byLeague.set(fixture.league, new Set());
    byLeague.get(fixture.league)!.add(fixture.id);
  });

  const results = new Map<number, FixtureResult>();
  const unavailable: string[] = [];

  await Promise.all(
    [...byLeague.entries()].map(async ([league, ids]) => {
      try {
        const response = await fetch(
          buildApiUrl(
            `/data/results?league=${encodeURIComponent(league)}&fixture_ids=${[
              ...ids,
            ].join(",")}`
          )
        );
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        (data?.results ?? []).forEach((result: FixtureResult) => {
          results.set(result.fixture_id, result);
        });
      } catch {
        unavailable.push(league);
      }
    })
  );

  return { results, unavailable };
}

/** The final score of a fixture, or null while it is unplayed or unknown. */
export function finalScore(
  results: Map<number, FixtureResult>,
  fixtureId?: number | null
): { homeGoals: number; awayGoals: number } | null {
  if (!fixtureId) return null;
  const result = results.get(fixtureId);
  if (!result?.finished) return null;
  if (result.home_goals === null || result.away_goals === null) return null;
  return { homeGoals: result.home_goals, awayGoals: result.away_goals };
}
