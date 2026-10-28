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
 *
 * Isto conta-se no dinheiro, e durante meses contou-se nas apostas. É a
 * mesma conta quando todas valem o mesmo e deixa de ser quando não valem:
 * em 74 apostas fechadas a taxa de acerto é 52,7% e a odd média 2,05, que
 * multiplicadas dão 1,08 € por euro — e o que saiu da conta bancária diz
 * 657,86 € postos, 649,68 € devolvidos, **0,99 €**. Nove pontos de
 * diferença, e no sentido mau: as que se perderam levaram 9,53 € em média
 * e as que entraram levavam 8,32 €. A aplicação estava a dizer a quem lê
 * que tinha 8% de vantagem, e logo a seguir a recomendar uma quantia
 * calculada por cima dela.
 *
 * Por isso daqui em diante o euro é a unidade: o que se pôs e o que voltou.
 * A taxa de acerto fica, que é verdadeira e diz outra coisa — mas não é
 * ela que paga.
 */

/** Abaixo disto uma taxa de acerto é uma moeda a cair umas vezes seguidas. */
export const MIN_FOR_EDGE = 15;

export interface MeasuredEdge {
  /** Quantas apostas estão por trás disto. */
  settled: number;
  /**
   * A taxa de acerto, em percentagem. Conta apostas, não dinheiro.
   *
   * Fica porque é verdadeira e porque é a que se sente. Mas não é com ela
   * que se faz nenhuma das contas abaixo: multiplicá-la pela odd média dá
   * um número que pode estar nove pontos acima do que o banco diz.
   */
  winPct: number;
  /** A odd média que cada euro comprou — pesada pela quantia, não pelas apostas. */
  odds: number;
  /** Quanto se pôs, ao todo. */
  staked: number;
  /** E quanto voltou. */
  returned: number;
  /**
   * O que cada euro apostado devolveu. Acima de 1 há vantagem.
   *
   * É a única pergunta que interessa, e não é a taxa de acerto: 55% a 1,80
   * é dinheiro, 55% a 1,70 é perder devagar. E é o dinheiro a dividir pelo
   * dinheiro, porque uma aposta de 20 € que falha não custa o mesmo que
   * uma de 5 € que falha, por muito que nas contas pesem uma cada.
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

  // Tudo pesado pela quantia. Uma aposta de 20 € pesa quatro vezes uma de
  // 5 €, porque foi isso que ela fez à banca.
  const staked = settled.reduce((total, bet) => total + (bet.stake || 0), 0);
  if (!(staked > 0)) return null;

  const bought = settled.reduce(
    (total, bet) => total + (bet.stake || 0) * (bet.odds || 0),
    0,
  );
  const returned = settled.reduce(
    (total, bet) =>
      total + (bet.status === "green" ? (bet.stake || 0) * (bet.odds || 0) : 0),
    0,
  );

  const odds = bought / staked;
  if (!(odds > 1)) return null;

  const perEuro = returned / staked;
  // Kelly: a fracção que maximiza o crescimento, feita sobre o que o
  // dinheiro devolveu e não sobre o que a taxa de acerto prometia.
  // Negativa quer dizer que a aposta é má em si mesma, e aí a resposta é
  // zero e não "aposta pouco".
  const kelly = (perEuro - 1) / (odds - 1);

  return {
    settled: settled.length,
    winPct: Number(record.winPct.toFixed(1)),
    odds: Number(odds.toFixed(2)),
    staked: Number(staked.toFixed(2)),
    returned: Number(returned.toFixed(2)),
    perEuro: Number(perEuro.toFixed(3)),
    stakePct: Number(Math.max(0, kelly * 100).toFixed(1)),
  };
}

/**
 * A taxa de acerto que o dinheiro viu, e não a que as apostas contam.
 *
 * As duas separam-se quando as quantias não são todas iguais: 52,7% das
 * apostas entraram, mas as que entraram eram as mais pequenas, e por euro
 * posto a taxa cai para 49%. Para julgar um desafio — que é uma pergunta
 * sobre dinheiro — é esta que serve, e é sempre a mais baixa das duas
 * quando se perdeu dinheiro a acertar muito.
 */
export function moneyWinRate(edge: MeasuredEdge): number {
  return Math.min(1, Math.max(0, edge.perEuro / edge.odds));
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

  // A taxa que o dinheiro viu, e não a que as apostas contam: é a que
  // fecha com o euro devolvido, e um par (taxa, odd) que não fecha com
  // ele dá um ritmo que o extracto desmente.
  const p = Math.min(1, Math.max(0, edge.perEuro / edge.odds));
  const log =
    p * Math.log(1 + f * (edge.odds - 1)) + (1 - p) * Math.log(1 - f);
  return Number(Math.exp(log).toFixed(3));
}
