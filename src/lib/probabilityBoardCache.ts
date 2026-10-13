import type { ProbabilityResult } from "@/components/ProbabilityBreakdown";

export interface BoardMatch extends ProbabilityResult {
  fixture_id: number;
  league: string;
  home_name: string;
  away_name: string;
  kickoff: string | null;
  headline_market: string;
  headline_pct: number;
  /** What that market does in this competition anyway, when it is known. */
  league_pct?: number | null;
  /** How far above that rate the model is willing to go on this game. */
  edge_pp?: number | null;
}

export interface CachedBoard {
  days: number;
  /** When this browser wrote the copy. Decides when it goes stale. */
  fetchedAt: number;
  /**
   * When the board itself was put together — by the nightly job, or by the
   * engine on the spot. Two different things from `fetchedAt`: a phone can
   * fetch at eight in the morning a board that was computed at half past
   * midnight. It is the stamp that says whether the one in the database is
   * newer than the one on screen, which is the whole point of keeping it.
   */
  computedAt: number;
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
//
// A board that came back with nothing at all gets the same short life. "No
// games worth analysing" is never an answer worth holding on to: every
// competition being quiet at once is rare, a bad fetch is not, and the two
// are indistinguishable from the stored copy.
const INCOMPLETE_TTL_MS = 5 * 60 * 1000;

function isComplete(board: CachedBoard): boolean {
  return (
    (board.matches?.length ?? 0) > 0 && (board.unavailable?.length ?? 0) === 0
  );
}

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

    const ttl = isComplete(parsed) ? CACHE_TTL_MS : INCOMPLETE_TTL_MS;
    if (Date.now() - parsed.fetchedAt > ttl) return null;

    // A copy written before this stamp existed counts as infinitely old, so
    // the first stored board after an update always wins over it.
    return { ...parsed, computedAt: parsed.computedAt ?? 0 };
  } catch {
    return null;
  }
}

export function writeCachedBoard(
  data: Omit<CachedBoard, "fetchedAt" | "computedAt"> & { computedAt?: number }
): void {
  try {
    const now = Date.now();
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...data,
        computedAt: data.computedAt ?? now,
        fetchedAt: now,
      })
    );
  } catch {
    // Storage full or unavailable — the board just recomputes next visit,
    // which is exactly what happened before this cache existed.
  }
}
