import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { buildApiUrl } from "@/lib/apiConfig";

interface Averages {
  league_home_goals_avg: number;
  league_away_goals_avg: number;
  sample_matches: number;
}

/**
 * Replaces the hand-entered league baseline with averages measured from this
 * season's actual results, for the competitions where live data exists.
 */
export function LeagueCalibration({
  league,
  onCalibrate,
}: {
  league: string;
  onCalibrate: (values: Record<string, string>) => void;
}) {
  const [table, setTable] = useState<Record<string, Averages> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);

    fetch(buildApiUrl("/data/calibration"), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setTable(data?.leagues ?? {});
      })
      .catch(() => {
        if (!cancelled) setTable({});
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  const measured = table?.[league];

  useEffect(() => {
    if (!measured) return;
    onCalibrate({
      league_home_goals_avg: String(measured.league_home_goals_avg),
      league_away_goals_avg: String(measured.league_away_goals_avg),
    });
    // Re-apply only when the measured baseline itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measured?.league_home_goals_avg, measured?.league_away_goals_avg, league]);

  if (!measured) return null;

  return (
    <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[11px] text-primary ring-1 ring-primary/20">
      <CheckCircle2 className="h-3.5 w-3.5 flex-none" strokeWidth={1.8} />
      Base da liga calibrada com a época em curso: {measured.league_home_goals_avg} golos
      em casa e {measured.league_away_goals_avg} fora, em {measured.sample_matches} jogos.
    </p>
  );
}
