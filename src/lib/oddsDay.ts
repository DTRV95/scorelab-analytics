import { supabase } from "@/lib/supabaseClient";
import { buildApiUrl } from "@/lib/apiConfig";
import { askOnce } from "@/lib/askOnce";
import type { MarketPrice } from "@/lib/marketPrice";

/**
 * O preço de uma liga inteira, buscado uma vez por dia e partilhado.
 *
 * A fonte de odds cobra por **listagem de liga**, não por jogo: trinta
 * jogos pedidos na mesma visita custam o mesmo que um, e os mesmos
 * trinta pedidos em trinta visitas custam trinta vezes mais. O motor
 * dorme entre visitas e acorda sem memória nenhuma, por isso era o
 * segundo caso que estava a acontecer — e as quinhentas chamadas do mês
 * acabaram a meio de Outubro, com o cartão a dizer "as casas ainda não
 * abriram" em todos os jogos.
 *
 * A memória tem de viver fora do motor, e vive aqui: uma linha por liga
 * e por dia, no Supabase, que os dois jogadores partilham. Quem abre o
 * primeiro jogo de uma liga paga a chamada; todos os outros jogos dessa
 * liga, nesse dia, para os dois, saem de graça.
 *
 * Um dia é o passo certo para isto. O preço de um jogo mexe aos
 * cêntimos ao longo da tarde e a nossa conta é uma mediana pessimista —
 * trocar precisão de cêntimos por um mês de preços é o negócio que
 * interessa, e sem preço nenhum não há conta nenhuma.
 */

export interface LeagueOdds {
  /** Por fixture_id, o que a liga tinha quando se perguntou. */
  matches: Record<string, MarketPrice>;
  /** Quando é que se perguntou. */
  at: number;
  /** A fonte recusou — saldo esgotado ou chave recusada. */
  blocked: boolean;
}

interface Row {
  league: string;
  day: string;
  payload: LeagueOdds;
}

/** O dia, em Lisboa, que é onde se joga e onde se olha. */
function today(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** O que a resposta do motor traz, traduzido para o que o resto usa. */
function readEngine(data: unknown): LeagueOdds {
  const body = (data ?? {}) as {
    matches?: Record<string, Record<string, unknown>>;
    blocked?: boolean;
  };

  const matches: Record<string, MarketPrice> = {};
  for (const [fixture, found] of Object.entries(body.matches ?? {})) {
    if (!found?.odds) continue;
    matches[fixture] = {
      odds: found.odds as Record<string, number>,
      implied: (found.implied_pct as Record<string, number>) ?? {},
      derived: Array.isArray(found.derived) ? found.derived.map(String) : [],
      homeAwayDisagrees: Boolean(found.home_away_disagrees),
    };
  }

  return { matches, at: Date.now(), blocked: Boolean(body.blocked) };
}

async function fromEngine(league: string): Promise<LeagueOdds> {
  const query = new URLSearchParams({ league, days: "3" });
  const response = await fetch(buildApiUrl(`/data/league-odds?${query}`));
  if (!response.ok) throw new Error(String(response.status));
  return readEngine(await response.json());
}

async function keep(league: string, found: LeagueOdds): Promise<void> {
  // Guardar não pode estragar nada: sem isto os preços continuam a
  // chegar, só voltam a custar saldo amanhã.
  if (!supabase || found.blocked) return;
  await supabase
    .from("odds_day")
    .upsert(
      { league, day: today(), payload: found, fetched_at: new Date().toISOString() },
      { onConflict: "league,day" },
    );
}

async function fromStore(league: string): Promise<LeagueOdds | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("odds_day")
    .select("league, day, payload")
    .eq("league", league)
    .eq("day", today())
    .maybeSingle();

  if (error || !data) return null;
  const row = data as Row;
  return row.payload?.matches ? row.payload : null;
}

/**
 * Os preços desta liga, hoje.
 *
 * Primeiro o que está guardado; só se não houver é que se vai pagar a
 * chamada. E uma só vez por sessão, mesmo que meia dúzia de linhas da
 * mesma liga abram ao mesmo tempo.
 */
export async function fetchLeagueOdds(league: string): Promise<LeagueOdds> {
  return askOnce(`liga-odds|${league}|${today()}`, async () => {
    const guardado = await fromStore(league);
    if (guardado) return guardado;

    const found = await fromEngine(league);
    await keep(league, found).catch(() => undefined);
    return found;
  });
}

/** O preço de um jogo, de dentro do que a liga trouxe. */
export function priceOf(
  found: LeagueOdds | null,
  fixtureId: number,
): MarketPrice | null {
  return found?.matches[String(fixtureId)] ?? null;
}
