import { buildApiUrl } from "@/lib/apiConfig";
import type { AnalysisFixture } from "@/types/analysis";

/** The team-stat fields every /data/prefill response fills in. */
export const PREFILL_STAT_FIELDS = [
  "jogos_casa",
  "golos_marcados_casa",
  "golos_sofridos_casa",
  "jogos_casa_rec",
  "golos_marcados_casa_rec",
  "golos_sofridos_casa_rec",
  "jogos_fora",
  "golos_marcados_fora",
  "golos_sofridos_fora",
  "jogos_fora_rec",
  "golos_marcados_fora_rec",
  "golos_sofridos_fora_rec",
] as const;

/**
 * Fetches a fixture's real stats and turns them into the plain string form
 * values the analysis forms use — the one place this shape is built, so
 * every entry point (Jogos do Dia, the Probability board, ...) fills a form
 * the same way.
 */
export async function fetchMatchPrefill(
  league: string,
  fixtureId: number
): Promise<{ values: Record<string, string>; fixture: AnalysisFixture }> {
  const response = await fetch(
    buildApiUrl(
      `/data/prefill?league=${encodeURIComponent(league)}&fixture_id=${fixtureId}`
    )
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.detail || "Falha ao preencher os dados do jogo.");
  }

  const values: Record<string, string> = {
    equipa_casa: String(data.equipa_casa ?? ""),
    equipa_fora: String(data.equipa_fora ?? ""),
  };
  PREFILL_STAT_FIELDS.forEach((field) => {
    values[field] = String(data[field] ?? "");
  });
  if (data.league_averages) {
    values.league_home_goals_avg = String(
      data.league_averages.league_home_goals_avg
    );
    values.league_away_goals_avg = String(
      data.league_averages.league_away_goals_avg
    );
  }

  return {
    values,
    fixture: { id: fixtureId, league, kickoff: data.kickoff ?? null },
  };
}
