import { summarise } from "@/lib/betAnalytics";
import type { PlanBet } from "@/lib/planStore";

/**
 * A vantagem desta pessoa, medida nas apostas dela — e o que ela aguenta.
 *
 * A aplicação julgava os desafios com uma taxa de acerto assumida de 55%:
 * "com 55% de acerto, a banca cresce". É uma frase sobre um apostador
 * imaginário, e serve para quem ainda não tem registo nenhum. Para quem tem,
 * é a conta errada feita com o número errado.
 *
 * O aviso de que o Plano Milhão não pode funcionar já estava escrito no
 * código há meses, em `expectedGrowth`. O que faltava era dizê-lo com os
 * números de quem o está a jogar: meia banca a 1,85 precisa de 66% para não
 * encolher, e quem acerta 51% vê a banca multiplicar por 0,85 por dia.
 */

/** Abaixo disto uma taxa de acerto é uma moeda a cair umas vezes seguidas. */
export const MIN_FOR_EDGE = 15;

export interface MeasuredEdge {
  /** Quantas apostas estão por trás disto. */
  settled: number;
  /** A taxa de acerto, em percentagem. */
  winPct: number;
  /** A odd média a que se apostou. */
  odds: number;
  /**
   * O que cada euro apostado devolve, em média. Acima de 1 há vantagem.
   *
   * É a única pergunta que interessa, e não é a taxa de acerto: 55% a 1,80
   * é dinheiro, 55% a 1,70 é perder devagar.
   */
  perEuro: number;
  /**
   * A fracção da banca que esta vantagem aguenta, em percentagem.
   *
   * Kelly. Zero quando não há vantagem — e aí não há aposta nenhuma que o
   * dinheiro aguente, por muito pequena que seja.
   */
  stakePct: number;
}

/**
 * O que o registo desta pessoa diz, ou nada enquanto for cedo.
 *
 * Devolve `null` em vez de um número frouxo: com cinco apostas a taxa de
 * acerto é ruído, e pôr ruído ao lado de uma quantia em euros é pior do que
 * não pôr nada.
 */
export function measuredEdge(bets: PlanBet[]): MeasuredEdge | null {
  const settled = bets.filter(
    (bet) => bet.status === "green" || bet.status === "red",
  );
  if (settled.length < MIN_FOR_EDGE) return null;

  const record = summarise(settled);
  if (record.winPct === null) return null;

  const odds =
    settled.reduce((total, bet) => total + (bet.odds || 0), 0) / settled.length;
  if (!(odds > 1)) return null;

  const p = record.winPct / 100;
  const perEuro = p * odds;
  // Kelly: a fracção que maximiza o crescimento. Negativa quer dizer que a
  // aposta é má em si mesma, e aí a resposta é zero e não "aposta pouco".
  const kelly = (p * (odds - 1) - (1 - p)) / (odds - 1);

  return {
    settled: settled.length,
    winPct: Number(record.winPct.toFixed(1)),
    odds: Number(odds.toFixed(2)),
    perEuro: Number(perEuro.toFixed(3)),
    stakePct: Number(Math.max(0, kelly * 100).toFixed(1)),
  };
}

/** O que a vantagem medida aguenta em euros, sobre esta banca. */
export function sustainableStake(edge: MeasuredEdge, bankroll: number): number {
  return Number(((edge.stakePct / 100) * Math.max(bankroll, 0)).toFixed(2));
}

/**
 * Quanto a banca encolhe, ou cresce, por aposta, ao ritmo a que se está a
 * jogar — a fracção verdadeira, não a que a tabela recomenda.
 *
 * Devolve o multiplicador: 0,85 quer dizer que duas apostas, uma ganha e
 * uma perdida, deixam 72% do que lá estava. É a conta que nenhuma maré de
 * sorte corrige, e por isso é a que tem de estar no ecrã.
 */
export function growthPerBet(
  edge: MeasuredEdge,
  stakePct: number,
): number | null {
  const f = stakePct / 100;
  if (!(f > 0) || f >= 1) return null;

  const p = edge.winPct / 100;
  const log =
    p * Math.log(1 + f * (edge.odds - 1)) + (1 - p) * Math.log(1 - f);
  return Number(Math.exp(log).toFixed(3));
}
