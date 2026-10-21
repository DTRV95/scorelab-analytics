import type { BoardMatch } from "@/lib/probabilityBoardCache";

/**
 * The competitions the data provider covers on the free tier.
 *
 * Mirrors SUPPORTED_LEAGUES in backend/football_data.py. A test over there
 * reads this file and fails if the two lists drift, because a league missing
 * from here would quietly stop being counted — which is the exact failure this
 * list exists to make visible.
 */
export const COVERED_LEAGUES = [
  "Liga Portugal",
  "Premier League",
  "Championship",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "Eredivisie",
  "Liga dos Campeões",
  "Campeonato da Europa",
  // Sem o Mundial: a edição de 2026 já acabou e a competição ficava no quadro
  // e nas ligas a dizer zero jogos o ano inteiro.
  "Brasileirão",
] as const;

export interface LeagueCount {
  league: string;
  count: number;
}

/**
 * How many games each covered competition is putting on the board.
 *
 * The picker used to rank every game by probability and show the best twelve,
 * which meant a competition could be on the board and never once appear on
 * screen — indistinguishable, from the outside, from the provider not sending
 * it at all. Counting every covered competition, zeroes included, turns that
 * into something the page can just say.
 */
/**
 * As competições cobertas que não puseram um único jogo no quadro.
 *
 * As que o motor diz que falharam já têm nome no ecrã. Estas são as outras:
 * respondeu-se por elas, ninguém deu erro, e mesmo assim não vem nada. Na
 * maioria das semanas isso é a verdade — o Campeonato da Europa não joga, a
 * Liga dos Campeões joga de quinze em quinze dias.
 *
 * Mas esta semana o Championship desapareceu três vezes, por três razões
 * diferentes, e das três o quadro ficou exactamente com este aspecto: sem a
 * competição e sem nada a dizer que ela faltava. Nomeá-las não é um alarme,
 * é tirar o caso de "não vejo o Championship" do sítio onde não tem resposta.
 */
export function silentLeagues(
  matches: BoardMatch[],
  unavailable: string[] = [],
): string[] {
  const refused = new Set(unavailable);
  return leagueCounts(matches)
    .filter((row) => row.count === 0 && !refused.has(row.league))
    .map((row) => row.league);
}

export function leagueCounts(matches: BoardMatch[]): LeagueCount[] {
  const counts = new Map<string, number>(
    COVERED_LEAGUES.map((league) => [league, 0])
  );

  for (const match of matches) {
    counts.set(match.league, (counts.get(match.league) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([league, count]) => ({ league, count }))
    .sort(
      (a, b) => b.count - a.count || a.league.localeCompare(b.league, "pt")
    );
}
