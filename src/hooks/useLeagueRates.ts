import { useEffect, useState } from "react";
import { COVERED_LEAGUES } from "@/lib/boardLeagues";
import { fetchLeagueReport, type LeagueReport } from "@/lib/leagueReport";

/**
 * What the competitions on a slip usually give, kept for the session.
 *
 * A report is a whole season counted on the server, where it already sits in
 * cache for six hours — but it is still a request, and a slip gets rebuilt
 * several times while somebody makes up their mind. Holding the answers for as
 * long as the tab is open means one request per competition, ever.
 */
const cache = new Map<string, LeagueReport>();
/** In flight, so two legs of the same league do not ask twice. */
const asking = new Map<string, Promise<LeagueReport | null>>();

function read(league: string): Promise<LeagueReport | null> {
  const held = cache.get(league);
  if (held) return Promise.resolve(held);

  const already = asking.get(league);
  if (already) return already;

  const request = fetchLeagueReport(league)
    .then((report) => {
      cache.set(league, report);
      return report;
    })
    // A competition that cannot be read leaves the slip saying nothing about
    // it, which is what it said before any of this existed.
    .catch(() => null)
    .finally(() => {
      asking.delete(league);
    });

  asking.set(league, request);
  return request;
}

export function useLeagueRates(leagues: string[]): Map<string, LeagueReport> {
  const [reports, setReports] = useState<Map<string, LeagueReport>>(
    () => new Map(),
  );
  // A list rebuilt on every render would restart the effect forever.
  const key = [...new Set(leagues)].sort().join("|");

  useEffect(() => {
    const wanted = key
      .split("|")
      .filter((league) => (COVERED_LEAGUES as readonly string[]).includes(league));
    if (wanted.length === 0) return;

    let live = true;
    void Promise.all(wanted.map(read)).then(() => {
      if (!live) return;
      setReports(new Map(cache));
    });

    return () => {
      live = false;
    };
  }, [key]);

  return reports;
}

/** Only for tests: the cache outlives a render, and so would one test's answer. */
export function forgetLeagueRates() {
  cache.clear();
  asking.clear();
}
