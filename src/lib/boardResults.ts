import { buildApiUrl } from "@/lib/apiConfig";
import { supabase } from "@/lib/supabaseClient";

/**
 * The board of games, after the games were played.
 *
 * The probabilities said what was about to happen and were gone by the next
 * morning, so there was nowhere to see whether any of it came true. This is
 * the same board, scored: each played game forecast again from the league as
 * it stood before its own kickoff — never from a season that already holds
 * the result — and the market the board led with marked against the score.
 */

export interface ScoredMatch {
  fixture_id: number;
  league: string;
  home_name: string;
  away_name: string;
  kickoff: string | null;
  home_goals: number;
  away_goals: number;
  headline_market: string;
  headline_pct: number;
  landed: boolean;
}

export interface BoardResults {
  matches: ScoredMatch[];
  played: number;
  hits: number;
  hit_pct: number;
  /** What the model said, on average, about the markets it led with. */
  predicted_pct: number;
  unavailable: string[];
  skipped: number;
  /** When this was computed, in epoch ms. */
  at: number;
  source: "cache" | "snapshot" | "engine";
}

const CACHE_KEY = "scorelab_board_results_cache";
const CACHE_TTL_MS = 3 * 60 * 60 * 1000;
/** Older than this and last night's scoring is not worth showing at all. */
const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

interface Cached extends BoardResults {
  days: number;
  /**
   * When this browser put it away — not when it was computed. Those are
   * hours apart for anything the nightly job scored, and measuring the life
   * of the copy against the age of the scoring would throw away last
   * night's work the moment it was read.
   */
  storedAt: number;
}

function readCache(days: number): BoardResults | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Cached;
    if (parsed.days !== days) return null;
    if (Date.now() - (parsed.storedAt ?? 0) > CACHE_TTL_MS) return null;

    return { ...parsed, source: "cache" };
  } catch {
    return null;
  }
}

function writeCache(days: number, results: BoardResults): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...results, days, storedAt: Date.now() }),
    );
  } catch {
    // Storage full or blocked: it simply asks again next time.
  }
}

interface SnapshotRow {
  payload: Omit<BoardResults, "at" | "source"> | null;
  computed_at: string;
}

/** What the nightly job scored and left in the database, if anything. */
export async function fetchResultsSnapshot(
  days = 7,
): Promise<BoardResults | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("board_snapshots")
      .select("payload, computed_at")
      .eq("key", `results:${days}`)
      .maybeSingle<SnapshotRow>();

    if (error || !data?.payload?.matches?.length) return null;

    const at = new Date(data.computed_at).getTime();
    if (Number.isNaN(at) || Date.now() - at > SNAPSHOT_MAX_AGE_MS) return null;

    return { ...data.payload, at, source: "snapshot" };
  } catch {
    // The stored scoring is a shortcut, never a dependency.
    return null;
  }
}

export async function fetchResultsFromEngine(
  days = 7,
  signal?: AbortSignal,
): Promise<BoardResults> {
  const response = await fetch(
    buildApiUrl(`/data/board-results?days=${days}`),
    { signal },
  );
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.detail || "Não foi possível ver como correram.");
  }

  return {
    matches: body.matches ?? [],
    played: body.played ?? 0,
    hits: body.hits ?? 0,
    hit_pct: body.hit_pct ?? 0,
    predicted_pct: body.predicted_pct ?? 0,
    unavailable: body.unavailable ?? [],
    skipped: body.skipped ?? 0,
    at: Date.now(),
    source: "engine",
  };
}

/**
 * The scored board, from wherever it can be had fastest.
 *
 * Same order as the board itself: this session's copy, then the one the
 * nightly job left in the database, and only then the engine — which has to
 * wake up and simulate every game again.
 */
export async function loadBoardResults(
  days = 7,
  { force = false, signal }: { force?: boolean; signal?: AbortSignal } = {},
): Promise<BoardResults> {
  if (!force) {
    const cached = readCache(days);
    if (cached) return cached;

    const stored = await fetchResultsSnapshot(days);
    if (stored) {
      writeCache(days, stored);
      return stored;
    }
  }

  const fresh = await fetchResultsFromEngine(days, signal);
  writeCache(days, fresh);
  return fresh;
}

/** Local-day key, so "ontem" means yesterday here and not in UTC. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** The games played yesterday, by this phone's calendar. */
export function playedYesterday(matches: ScoredMatch[]): ScoredMatch[] {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const key = dayKey(yesterday);

  return matches.filter((match) => {
    if (!match.kickoff) return false;
    const when = new Date(match.kickoff);
    if (Number.isNaN(when.getTime())) return false;
    return dayKey(when) === key;
  });
}

export interface HitRate {
  played: number;
  hits: number;
  /** Null with nothing played: a percentage of nothing says nothing. */
  pct: number | null;
  /** What the model claimed, on average, about those same markets. */
  said: number | null;
}

export function hitRate(matches: ScoredMatch[]): HitRate {
  if (matches.length === 0) {
    return { played: 0, hits: 0, pct: null, said: null };
  }

  const hits = matches.filter((match) => match.landed).length;
  const said =
    matches.reduce((sum, match) => sum + match.headline_pct, 0) /
    matches.length;

  return {
    played: matches.length,
    hits,
    pct: Number(((hits / matches.length) * 100).toFixed(0)),
    said: Number(said.toFixed(0)),
  };
}
