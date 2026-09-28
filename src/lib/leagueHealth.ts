import { buildApiUrl } from "@/lib/apiConfig";

export interface LeagueHealth {
  league: string;
  code: string;
  ok: boolean;
  error: string | null;
  matches: number;
  finished: number;
  upcoming: number;
  /** Games kicking off inside the board's window. */
  within_days: number;
  next_kickoff: string | null;
  season: string | null;
}

export interface LeagueHealthReport {
  configured: boolean;
  days: number;
  leagues: LeagueHealth[];
  /** Competitions the provider refused or failed to answer. */
  failing: string[];
  /** Competitions that answered fine but have nothing in the window. */
  empty: string[];
}

/**
 * Why a competition is missing from the board.
 *
 * The board hides a competition's failure so one outage cannot take the others
 * with it, which is right — and leaves nobody able to tell "the provider
 * refused this competition" from "there are no Dutch games this week". This
 * asks the question directly.
 */
export async function fetchLeagueHealth(days = 7): Promise<LeagueHealthReport> {
  const response = await fetch(buildApiUrl(`/data/leagues?days=${days}`));
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

/**
 * Worst first.
 *
 * This panel is opened because something is missing, so the competition that
 * failed goes at the top, then the ones with nothing this week, then the rest.
 */
export function byUrgency(rows: LeagueHealth[]): LeagueHealth[] {
  const rank = (row: LeagueHealth) =>
    !row.ok ? 0 : row.within_days === 0 ? 1 : 2;
  return [...rows].sort(
    (a, b) => rank(a) - rank(b) || a.league.localeCompare(b.league),
  );
}

/** One line per competition, for a panel with no room for a table. */
export function describeHealth(row: LeagueHealth): string {
  if (!row.ok) return row.error ?? "Não respondeu.";
  if (row.within_days === 0) {
    return row.upcoming > 0
      ? `Responde, mas sem jogos nesta janela. ${row.upcoming} por disputar mais à frente.`
      : "Responde, mas não tem jogos por disputar.";
  }
  return `${row.within_days} ${row.within_days === 1 ? "jogo" : "jogos"} nesta janela · ${
    row.finished
  } já disputados esta época`;
}

export interface ProviderCompetition {
  code: string | null;
  name: string | null;
  area: string | null;
  type: string | null;
  season_end: string | null;
  /** Already on the board. The rest are offered and simply never wired in. */
  wired: boolean;
}

export interface ProviderCatalogue {
  count: number;
  wired: string[];
  competitions: ProviderCompetition[];
}

/**
 * What the API key actually covers, asked of the provider itself.
 *
 * A competition that was never wired into the board looks exactly like one the
 * provider refuses, and both look like "there are no games this week". Every
 * bet placed in this app so far was on a national side or a small league —
 * none of which were on the board — and nothing on screen said so.
 */
export async function fetchProviderCompetitions(): Promise<ProviderCatalogue> {
  const response = await fetch(buildApiUrl("/data/competitions"));
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}
