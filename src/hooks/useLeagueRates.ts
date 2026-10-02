import { useEffect, useState } from "react";
import { fetchLeagueRates, type LeagueRates } from "@/lib/leagueReport";

/**
 * What every covered competition usually gives, kept for the session.
 *
 * One request for the lot, because the board holds a dozen competitions at
 * once and a slip is rebuilt several times while somebody makes up their mind.
 * The server counts a whole season per competition and caches it for six
 * hours, so this is arithmetic nobody pays for twice.
 */
let held: Map<string, LeagueRates> | null = null;
let asking: Promise<Map<string, LeagueRates>> | null = null;

function read(): Promise<Map<string, LeagueRates>> {
  if (held) return Promise.resolve(held);
  if (asking) return asking;

  asking = fetchLeagueRates()
    .then((rates) => {
      held = new Map(rates.map((row) => [row.league, row]));
      return held;
    })
    // Unreachable, and the page says what it said before any of this existed:
    // nothing about the competition.
    .catch(() => new Map<string, LeagueRates>())
    .finally(() => {
      asking = null;
    });

  return asking;
}

export function useLeagueRates(): Map<string, LeagueRates> {
  const [rates, setRates] = useState<Map<string, LeagueRates>>(
    () => held ?? new Map(),
  );

  useEffect(() => {
    let live = true;
    void read().then((loaded) => {
      if (live) setRates(loaded);
    });

    return () => {
      live = false;
    };
  }, []);

  return rates;
}

/** Only for tests: the answer outlives a render, and so would one test's. */
export function forgetLeagueRates() {
  held = null;
  asking = null;
}
