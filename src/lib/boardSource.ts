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
  { force = false, signal }: { force?: boolean; signal?: AbortSignal } = {},
): Promise<LoadedBoard> {
  if (!force) {
    const cached = readCachedBoard(days);
    if (cached) {
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
      });
      return stored;
    }
  }

  const fresh = await fetchBoardFromEngine(days, signal);
  writeCachedBoard({
    days,
    matches: fresh.matches,
    unavailable: fresh.unavailable,
    skipped: fresh.skipped,
  });
  return fresh;
}
