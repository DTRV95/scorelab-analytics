import type { AccuracyReport } from "@/lib/modelAccuracy";

interface CachedAccuracy {
  /** The competitions the report covers, so a different set is a cache miss. */
  leagues: string[];
  season: number | null;
  fetchedAt: number;
  report: AccuracyReport;
}

const CACHE_KEY = "scorelab_model_accuracy_cache";

// Scoring a season replays every match with only what was known before its
// kickoff, thousands of simulations per fixture, once per competition. That is
// a wait measured in tens of seconds, and the answer only moves when new
// matches are played — so a visit should read the last one instead of paying
// for it again. Six hours matches how long the backend keeps the season data
// the score is built from, so nothing here is ever staler than a fresh request
// would return anyway.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function sameLeagues(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

/** The last report for these competitions, if it is still fresh. */
export function readCachedAccuracy(
  leagues: string[],
  season: number | null = null
): CachedAccuracy | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedAccuracy;
    if (!parsed?.report || !Array.isArray(parsed.leagues)) return null;
    if (!sameLeagues(parsed.leagues, leagues)) return null;
    if ((parsed.season ?? null) !== season) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedAccuracy(
  leagues: string[],
  report: AccuracyReport,
  season: number | null = null
): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ leagues, season, report, fetchedAt: Date.now() })
    );
  } catch {
    // Storage full or unavailable — the page just measures again next visit,
    // which is exactly what it did before this cache existed.
  }
}

/** How long ago the cached report was measured, in plain words. */
export function measuredAgo(fetchedAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - fetchedAt) / 60000));
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "há 1 hora" : `há ${hours} horas`;
}
