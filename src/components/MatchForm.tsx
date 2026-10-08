import { buildApiUrl } from "@/lib/apiConfig";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

/** What the engine read to build the forecast for one fixture. */
export interface PrefillForm {
  jogos_casa: number;
  golos_marcados_casa: number;
  golos_sofridos_casa: number;
  jogos_casa_rec: number;
  golos_marcados_casa_rec: number;
  golos_sofridos_casa_rec: number;
  jogos_fora: number;
  golos_marcados_fora: number;
  golos_sofridos_fora: number;
  jogos_fora_rec: number;
  golos_marcados_fora_rec: number;
  golos_sofridos_fora_rec: number;
  league_averages?: {
    league_home_goals_avg: number;
    league_away_goals_avg: number;
    sample_matches: number;
  };
}

/**
 * The form behind one fixture's number, fetched once per fixture.
 *
 * Held for the session because the games list expands and collapses rows all
 * the time, and the same fixture should not cost a request every time
 * somebody opens it again. The answer is itself built from the season the
 * engine already has cached, so it is cheap at the other end too.
 */
const held = new Map<number, Promise<PrefillForm | null>>();

export function fetchPrefill(
  league: string,
  fixtureId: number,
): Promise<PrefillForm | null> {
  const seen = held.get(fixtureId);
  if (seen) return seen;

  const asked = fetch(
    buildApiUrl(
      `/data/prefill?league=${encodeURIComponent(league)}&fixture_id=${fixtureId}`,
    ),
  )
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => (data as PrefillForm) ?? null)
    .catch(() => {
      // A failure is not worth remembering: opening the row again should try
      // again, not repeat the blank.
      held.delete(fixtureId);
      return null;
    });

  held.set(fixtureId, asked);
  return asked;
}

/** For tests, which need each one to start from cold. */
export function forgetPrefill() {
  held.clear();
}

function rate(goals: number, games: number) {
  if (!games) return "—";
  return (goals / games).toFixed(2);
}

/**
 * The numbers the forecast was built from.
 *
 * A probability nobody can look behind is just a number to be believed. This
 * is the whole input: goals for and against, per side, season and recent,
 * plus the league baseline they are measured against.
 */
export function MatchForm({
  prefill,
  match,
}: {
  prefill: PrefillForm;
  match: BoardMatch;
}) {
  const sides = [
    {
      team: match.home_name,
      where: "em casa",
      games: prefill.jogos_casa,
      scored: prefill.golos_marcados_casa,
      conceded: prefill.golos_sofridos_casa,
      recentGames: prefill.jogos_casa_rec,
      recentScored: prefill.golos_marcados_casa_rec,
      recentConceded: prefill.golos_sofridos_casa_rec,
      lambda: match.lambda_casa,
      baseline: prefill.league_averages?.league_home_goals_avg,
    },
    {
      team: match.away_name,
      where: "fora",
      games: prefill.jogos_fora,
      scored: prefill.golos_marcados_fora,
      conceded: prefill.golos_sofridos_fora,
      recentGames: prefill.jogos_fora_rec,
      recentScored: prefill.golos_marcados_fora_rec,
      recentConceded: prefill.golos_sofridos_fora_rec,
      lambda: match.lambda_fora,
      baseline: prefill.league_averages?.league_away_goals_avg,
    },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-2">
      {sides.map((side) => (
        <div
          key={side.where}
          className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-3.5"
        >
          <p className="text-[13px] font-semibold text-foreground">
            {side.team}{" "}
            <span className="font-normal text-muted-foreground">
              {side.where}
            </span>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <p className="sl-meta text-[10px] uppercase tracking-[0.12em]">
                Época · {side.games} jogos
              </p>
              <p className="mt-1 font-mono-data text-sm text-foreground">
                {rate(side.scored, side.games)} marcados
              </p>
              <p className="font-mono-data text-sm text-muted-foreground">
                {rate(side.conceded, side.games)} sofridos
              </p>
            </div>
            <div>
              <p className="sl-meta text-[10px] uppercase tracking-[0.12em]">
                Últimos {side.recentGames}
              </p>
              <p className="mt-1 font-mono-data text-sm text-foreground">
                {rate(side.recentScored, side.recentGames)} marcados
              </p>
              <p className="font-mono-data text-sm text-muted-foreground">
                {rate(side.recentConceded, side.recentGames)} sofridos
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
            <span className="sl-meta text-[11px]">
              O modelo espera
              {side.baseline ? ` (liga: ${side.baseline.toFixed(2)})` : ""}
            </span>
            <span className="font-mono-data text-base font-bold text-foreground">
              {side.lambda.toFixed(2)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
