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

export interface LeagueLater {
  league: string;
  /** O pontapé de saída do próximo jogo dela, em ISO. */
  next: string;
}

/**
 * As competições que não jogam hoje mas jogam mais à frente.
 *
 * O quadro mostra um dia de cada vez, e uma liga sem jogos nesse dia
 * desaparece sem explicação. Para a maioria das semanas isso é
 * inofensivo — mas o Brasileirão joga às 20:30 de Brasília, que em
 * Lisboa é meia-noite do dia seguinte, e por isso falta sistematicamente
 * do dia em que uma pessoa o foi procurar. Já desapareceu duas vezes por
 * avaria a sério, e da terceira ninguém vai saber distinguir.
 *
 * Dizer "não joga hoje, joga sábado" custa uma linha e tira a pergunta
 * do sítio onde ela não tem resposta.
 */
export function awayToday(
  dayItems: BoardMatch[],
  board: BoardMatch[],
  reference?: Date,
): LeagueLater[] {
  const present = new Set(dayItems.map((match) => match.league));

  // O dia em causa é o dos jogos que estão no ecrã; sem nenhum, é hoje.
  const base =
    reference ??
    (dayItems[0]?.kickoff ? new Date(dayItems[0].kickoff) : new Date());
  const cutoff = new Date(base);
  cutoff.setHours(23, 59, 59, 999);

  const out: LeagueLater[] = [];

  for (const league of COVERED_LEAGUES) {
    if (present.has(league)) continue;

    const next = board
      .filter((match) => match.league === league && match.kickoff)
      .map((match) => match.kickoff as string)
      .filter((kickoff) => new Date(kickoff).getTime() > cutoff.getTime())
      .sort()[0];

    if (next) out.push({ league, next });
  }

  return out;
}

/** "sábado", "amanhã" — como se diz, e não uma data por extenso. */
export function whenLabel(kickoff: string, now = new Date()): string {
  const when = new Date(kickoff);
  if (Number.isNaN(when.getTime())) return "";

  const dia = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dias = Math.round((dia(when) - dia(now)) / 86400000);

  if (dias <= 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias < 7) {
    return new Intl.DateTimeFormat("pt-PT", { weekday: "long" }).format(when);
  }
  return new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "short",
  }).format(when);
}
