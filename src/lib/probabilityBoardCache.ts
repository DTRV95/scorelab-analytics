import type { ProbabilityResult } from "@/components/ProbabilityBreakdown";

export interface BoardMatch extends ProbabilityResult {
  fixture_id: number;
  league: string;
  home_name: string;
  away_name: string;
  kickoff: string | null;
  headline_market: string;
  headline_pct: number;
}

interface CachedBoard {
  days: number;
  fetchedAt: number;
  matches: BoardMatch[];
  unavailable: string[];
  skipped: number;
}

const CACHE_KEY = "scorelab_probability_board_cache";

// Long enough that switching tabs and coming back never re-triggers the wait
// for a whole browsing session; short enough that the board still picks up
// new fixtures and results well within the same day. The underlying season
// data the board is built from is itself cached server-side for 6h, so
// nothing here is ever staler than what the backend would return anyway.
const CACHE_TTL_MS = 2 * 60 * 60 * 1000;

// A board that came back with a competition missing is not worth two hours.
// The usual reason is the provider's per-minute limit, which clears on its
// own — and keeping the incomplete board that long is what turned a passing
// rate limit into a league that "does not have games" for the afternoon.
const INCOMPLETE_TTL_MS = 5 * 60 * 1000;

/**
 * The last board fetched for this many days, if it's still fresh — lets the
 * page render instantly instead of recomputing 10,000 simulations per
 * fixture every single time someone opens the tab.
 */
export function readCachedBoard(days: number): CachedBoard | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedBoard;
    if (parsed.days !== days) return null;

    const ttl =
      parsed.unavailable && parsed.unavailable.length > 0
        ? INCOMPLETE_TTL_MS
        : CACHE_TTL_MS;
    if (Date.now() - parsed.fetchedAt > ttl) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedBoard(data: Omit<CachedBoard, "fetchedAt">): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...data, fetchedAt: Date.now() })
    );
  } catch {
    // Storage full or unavailable — the board just recomputes next visit,
    // which is exactly what happened before this cache existed.
  }
}
