import { buildApiUrl } from "@/lib/apiConfig";

export interface LeagueMarket {
  mercado: string;
  grupo: string;
  /** Matches this season in which the market came in. */
  jogos: number;
  /** How often, as a percentage. Null before anything has been played. */
  pct: number | null;
}

export interface FormRow {
  team: string;
  /** Games in the window. Fewer than five early in a season, or for a side
   *  carrying a game in hand. */
  played: number;
  points: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  /** The run itself, oldest first: "VEDVV". */
  run: string;
}

/** A competition's market rates, with nothing else attached. */
export interface LeagueRates {
  league: string;
  /** Matches already played this season, which every percentage is out of. */
  played: number;
  markets: LeagueMarket[];
}

export interface LeagueReport extends LeagueRates {
  goals: {
    home_avg: number | null;
    away_avg: number | null;
    total_avg: number | null;
  };
  form: FormRow[];
  form_window: number;
}

export async function fetchLeagueReport(
  league: string,
): Promise<LeagueReport> {
  const response = await fetch(
    buildApiUrl(`/data/league-report?league=${encodeURIComponent(league)}`),
  );

  if (!response.ok) {
    throw new Error("Não foi possível ler esta competição.");
  }

  const body = (await response.json().catch(() => null)) as LeagueReport | null;

  // A page should not go blank because an answer came back the wrong shape.
  // Casting whatever arrives and reading .markets off it is how a proxy
  // error page, or a server mid-deploy, takes the whole screen down instead
  // of landing in the error state this page already has.
  if (!body || !Array.isArray(body.markets) || !Array.isArray(body.form)) {
    throw new Error("Não foi possível ler esta competição.");
  }

  return body;
}

/**
 * Every covered competition's rates, in one request.
 *
 * The board shows games from a dozen competitions at once; asking for one
 * report each would spend a dozen requests on arithmetic the server has
 * already done and cached.
 */
export async function fetchLeagueRates(): Promise<LeagueRates[]> {
  const response = await fetch(buildApiUrl("/data/league-rates"));

  if (!response.ok) {
    throw new Error("Não foi possível ler as competições.");
  }

  const payload = (await response.json()) as { leagues?: LeagueRates[] };
  return payload.leagues ?? [];
}

/** The order the groups are read in, which is the order a slip is built in. */
export const GROUP_ORDER = ["Resultado", "Golos", "Ambas Marcam", "Combinados"];

/**
 * The markets of a competition, in their groups.
 *
 * Grouped rather than listed flat because fifteen percentages in one column
 * is a wall: under "Golos", four lines about goals are four lines somebody
 * can compare at a glance.
 */
export function groupMarkets(
  markets: LeagueMarket[],
): { title: string; markets: LeagueMarket[] }[] {
  return GROUP_ORDER.map((title) => ({
    title,
    markets: markets.filter((market) => market.grupo === title),
  })).filter((group) => group.markets.length > 0);
}

/**
 * How unusual a market's rate is for this competition.
 *
 * Not a verdict, a flag: a league where 72% of games go under 3.5 is telling
 * you something about itself, and a league at 49% is telling you the opposite.
 * Everything in the middle is just football.
 */
export function standsOut(pct: number | null): "alto" | "baixo" | null {
  if (pct === null) return null;
  if (pct >= 65) return "alto";
  if (pct <= 25) return "baixo";
  return null;
}
