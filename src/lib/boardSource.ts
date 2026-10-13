import { buildApiUrl } from "@/lib/apiConfig";
import { supabase } from "@/lib/supabaseClient";
import {
  readCachedBoard,
  writeCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";

/**
 * Where the board of games comes from, in the order worth trying.
 *
 * The engine sleeps when nobody is using it and takes most of a minute to
 * wake, and then another half-minute to work through the competitions — so
 * opening Jogos meant watching a spinner, every single day, for something
 * that is the same for everybody and changes once a day.
 *
 * Now a job writes the finished board into the database every night. The app
 * reads that: one row, from a service that is never asleep. The engine is
 * only asked when there is no stored board at all, or when somebody presses
 * refresh and means it.
 */

export type BoardSource = "cache" | "snapshot" | "engine";

export interface LoadedBoard {
  matches: BoardMatch[];
  unavailable: string[];
  skipped: number;
  /** Where it came from, so the page can say how fresh it is. */
  source: BoardSource;
  /** When it was computed (snapshot) or fetched (engine), in epoch ms. */
  at: number;
}

/** Older than this and last night's board is not worth showing at all. */
const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

interface SnapshotRow {
  payload: {
    matches?: BoardMatch[];
    unavailable?: string[];
    skipped?: number;
  } | null;
  computed_at: string;
}

/** The board the nightly job left in the database, if there is one. */
export async function fetchBoardSnapshot(
  days = 7,
): Promise<LoadedBoard | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("board_snapshots")
      .select("payload, computed_at")
      .eq("key", `days:${days}`)
      .maybeSingle<SnapshotRow>();

    if (error || !data?.payload?.matches?.length) return null;

    const at = new Date(data.computed_at).getTime();
    if (Number.isNaN(at) || Date.now() - at > SNAPSHOT_MAX_AGE_MS) return null;

    return {
      matches: data.payload.matches,
      unavailable: data.payload.unavailable ?? [],
      skipped: data.payload.skipped ?? 0,
      source: "snapshot",
      at,
    };
  } catch {
    // The stored board is a shortcut, never a dependency: anything wrong with
    // it just means asking the engine, the way the app always did.
    return null;
  }
}

/**
 * Just the stamp on the stored board, not the board.
 *
 * A board is a hundred games with a full forecast each — a few hundred
 * kilobytes, and nine times out of ten the answer is "the same one you
 * already have". One short column tells us that for nothing.
 */
export async function fetchSnapshotStamp(days = 7): Promise<number | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from("board_snapshots")
      .select("computed_at")
      .eq("key", `days:${days}`)
      .maybeSingle<{ computed_at: string }>();

    if (error || !data?.computed_at) return null;

    const at = new Date(data.computed_at).getTime();
    return Number.isNaN(at) ? null : at;
  } catch {
    return null;
  }
}

/**
 * The stored board, but only when it is newer than the copy in hand.
 *
 * This is what was missing the day the Championship showed one game of four:
 * the fix landed, the job rewrote the board minutes later, and the phone went
 * on showing its own copy for two hours because nobody ever asked whether
 * there was a newer one. Now somebody asks, on every visit, for the price of
 * one column.
 */
export async function fetchNewerBoard(
  days = 7,
  knownAt = 0,
): Promise<LoadedBoard | null> {
  const stamp = await fetchSnapshotStamp(days);
  if (stamp === null || stamp <= knownAt) return null;

  const stored = await fetchBoardSnapshot(days);
  if (!stored || stored.at <= knownAt) return null;

  writeCachedBoard({
    days,
    matches: stored.matches,
    unavailable: stored.unavailable,
    skipped: stored.skipped,
    computedAt: stored.at,
  });
  return stored;
}

/** Straight from the engine, which computes it on the spot. */
export async function fetchBoardFromEngine(
  days = 7,
  signal?: AbortSignal,
): Promise<LoadedBoard> {
  const response = await fetch(
    buildApiUrl(`/data/probability-board?days=${days}`),
    { signal },
  );
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body?.detail || "Falha ao calcular as probabilidades.");
  }

  return {
    matches: body.matches ?? [],
    unavailable: body.unavailable ?? [],
    skipped: body.skipped ?? 0,
    source: "engine",
    at: Date.now(),
  };
}

export async function loadBoard(
  days = 7,
  {
    force = false,
    signal,
    onNewer,
  }: {
    force?: boolean;
    signal?: AbortSignal;
    /**
     * Called later, if the board in the database turns out to be newer than
     * the copy this returned. The saved copy paints at once — that is what it
     * is for — and the page is free to take the better one when it arrives.
     */
    onNewer?: (board: LoadedBoard) => void;
  } = {},
): Promise<LoadedBoard> {
  const cached = readCachedBoard(days);

  if (!force) {
    if (cached) {
      if (onNewer) {
        void fetchNewerBoard(days, cached.computedAt).then((newer) => {
          if (newer) onNewer(newer);
        });
      }

      return {
        matches: cached.matches,
        unavailable: cached.unavailable,
        skipped: cached.skipped,
        source: "cache",
        at: cached.fetchedAt,
      };
    }

    const stored = await fetchBoardSnapshot(days);
    if (stored) {
      writeCachedBoard({
        days,
        matches: stored.matches,
        unavailable: stored.unavailable,
        skipped: stored.skipped,
        computedAt: stored.at,
      });
      return stored;
    }
  } else {
    // Refresh used to mean "wake the engine", which is a minute of spinner
    // for a board the job in the database had already rewritten. So: if the
    // stored one is newer than what is on screen, that is the refresh. The
    // engine is still there for when it is not — pressing again when the
    // stored board is the one you already have does go and compute a new one.
    const newer = await fetchNewerBoard(days, cached?.computedAt ?? 0);
    if (newer) return newer;
  }

  const fresh = await fetchBoardFromEngine(days, signal);

  // An engine that answers "no games" is not worth a board that has them.
  //
  // It happens: the engine wakes up cold, runs into the provider's ten
  // requests a minute and comes back with nothing. Taking that answer
  // replaced a hundred games with an empty page — and, worse, wrote the
  // empty page over the copy in the browser.
  if (fresh.matches.length === 0) {
    const stored = await fetchBoardSnapshot(days);
    if (stored && stored.matches.length > 0) {
      writeCachedBoard({
        days,
        matches: stored.matches,
        unavailable: stored.unavailable,
        skipped: stored.skipped,
        computedAt: stored.at,
      });
      return stored;
    }

    // Nothing anywhere: say so, but do not save it. "No games" is never an
    // answer worth keeping.
    return fresh;
  }

  writeCachedBoard({
    days,
    matches: fresh.matches,
    unavailable: fresh.unavailable,
    skipped: fresh.skipped,
  });
  return fresh;
}
