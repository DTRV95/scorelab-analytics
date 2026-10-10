import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchResultsSnapshot,
  loadBoardResults,
  playedYesterday,
  type BoardResults,
  type ScoredMatch,
} from "@/lib/boardResults";

export interface BoardResultsState {
  results: BoardResults | null;
  /** Of those, the ones played yesterday by this phone's calendar. */
  yesterday: ScoredMatch[];
  /** Still looking for what the nightly job left in the database. */
  loading: boolean;
  /** The engine is scoring the week right now, because somebody asked. */
  asking: boolean;
  error: string | null;
  ask: () => void;
}

/**
 * How the board did, on the games already played.
 *
 * Reads what the nightly job scored and stored; the engine is only asked
 * when somebody presses for it, because scoring a week means simulating
 * every game in it again and nobody opens a page into that wait.
 */
export function useBoardResults(): BoardResultsState {
  const [results, setResults] = useState<BoardResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchResultsSnapshot(7)
      .then((stored) => {
        if (!cancelled) setResults(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const ask = useCallback(() => {
    setAsking(true);
    setError(null);

    loadBoardResults(7, { force: true })
      .then(setResults)
      .catch((reason: Error) =>
        setError(reason.message || "Não foi possível ver como correram."),
      )
      .finally(() => setAsking(false));
  }, []);

  const yesterday = useMemo(
    () => (results ? playedYesterday(results.matches) : []),
    [results],
  );

  return { results, yesterday, loading, asking, error, ask };
}
