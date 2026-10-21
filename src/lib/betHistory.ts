import type { PlanBet, PlanRecord } from "@/lib/planStore";

/**
 * As apostas de um desafio, por ordem, com de quem são e de onde vêm.
 *
 * A página do desafio mostrava os dois últimos níveis de cada jogador, lado
 * a lado, e um botão que abria mais quarenta em linhas de uma linha. Isso
 * responde a "quem vai à frente" e não a "o que é que nós fizemos": não se
 * procura, não se filtra, e um boletim de três jogos cabe num nome e um
 * "+2".
 */

export interface HistoryEntry {
  bet: PlanBet & { planId: string };
  /** O nome do desafio, para a aposta não ficar sem contexto nenhum. */
  plan: string;
  /** Se esse desafio já acabou, que muda o que a linha quer dizer. */
  ended: boolean;
  /** O instante por que isto se ordena. */
  at: number;
}

export type Outcome = "todas" | "ganhas" | "perdidas" | "abertas";

export interface HistoryFilter {
  planId?: string | null;
  /** De quem são. Dentro de um desafio partilhado há mais do que um dono. */
  userId?: string | null;
  outcome?: Outcome;
  /** Equipa, mercado ou competição, como se escreve. */
  text?: string;
}

function moment(bet: PlanBet): number {
  // Pela hora a que foi registada e não a que fechou: é a ordem em que
  // aconteceram para quem as fez, e uma aposta em aberto não tem a outra.
  const stamp = Date.parse(bet.placedAt);
  return Number.isNaN(stamp) ? 0 : stamp;
}

export function buildHistory(
  bets: (PlanBet & { planId: string })[],
  plans: PlanRecord[],
): HistoryEntry[] {
  const byId = new Map(plans.map((plan) => [plan.id, plan]));

  return bets
    .map((bet) => {
      const plan = byId.get(bet.planId);
      return {
        bet,
        // Um desafio apagado leva as apostas com ele, mas uma que sobreviva
        // a isso não pode ficar sem nome e desaparecer da lista.
        plan: plan?.name ?? "Desafio apagado",
        ended: Boolean(plan?.ended_at),
        at: moment(bet),
      };
    })
    .sort((a, b) => b.at - a.at);
}

function matchesText(entry: HistoryEntry, text: string): boolean {
  const needle = text.trim().toLowerCase();
  if (!needle) return true;

  if (entry.plan.toLowerCase().includes(needle)) return true;
  return entry.bet.legs.some((leg) =>
    [leg.homeTeam, leg.awayTeam, leg.market, leg.league].some((field) =>
      (field ?? "").toLowerCase().includes(needle),
    ),
  );
}

export function filterHistory(
  entries: HistoryEntry[],
  filter: HistoryFilter,
): HistoryEntry[] {
  const outcome = filter.outcome ?? "todas";

  return entries.filter((entry) => {
    if (filter.planId && entry.bet.planId !== filter.planId) return false;
    if (filter.userId && entry.bet.userId !== filter.userId) return false;
    if (outcome === "ganhas" && entry.bet.status !== "green") return false;
    if (outcome === "perdidas" && entry.bet.status !== "red") return false;
    if (outcome === "abertas" && entry.bet.status !== "pending") return false;
    if (filter.text && !matchesText(entry, filter.text)) return false;
    return true;
  });
}

export interface HistoryTotals {
  bets: number;
  settled: number;
  won: number;
  /** Null enquanto não houver nada fechado: 0% seria uma mentira. */
  winPct: number | null;
  staked: number;
  profit: number;
  roi: number | null;
}

/**
 * O que a lista que está no ecrã soma — não o registo inteiro.
 *
 * Filtrada por competição ou por mercado, a soma responde a "e nisto, como
 * é que me tenho saído?", que é a pergunta por que se filtra.
 */
export function historyTotals(entries: HistoryEntry[]): HistoryTotals {
  const settled = entries.filter(
    (entry) => entry.bet.status === "green" || entry.bet.status === "red",
  );
  const won = settled.filter((entry) => entry.bet.status === "green").length;
  const staked = settled.reduce((total, entry) => total + entry.bet.stake, 0);
  const profit = settled.reduce(
    (total, entry) => total + entry.bet.profitLoss,
    0,
  );

  return {
    bets: entries.length,
    settled: settled.length,
    won,
    winPct: settled.length
      ? Number(((won / settled.length) * 100).toFixed(1))
      : null,
    staked: Number(staked.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    roi: staked > 0 ? Number(((profit / staked) * 100).toFixed(1)) : null,
  };
}

/** As apostas agrupadas por mês, para a lista ter degraus por onde descer. */
export function byMonth(
  entries: HistoryEntry[],
): { label: string; entries: HistoryEntry[] }[] {
  const months = new Map<string, HistoryEntry[]>();

  for (const entry of entries) {
    const date = new Date(entry.at);
    const key = Number.isNaN(date.getTime())
      ? "?"
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months.set(key, [...(months.get(key) ?? []), entry]);
  }

  const name = new Intl.DateTimeFormat("pt-PT", {
    month: "long",
    year: "numeric",
  });

  return [...months.entries()].map(([key, group]) => ({
    label:
      key === "?"
        ? "Sem data"
        : name.format(new Date(`${key}-01T12:00:00Z`)),
    entries: group,
  }));
}
