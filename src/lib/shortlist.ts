import type { BoardMatch } from "@/lib/probabilityBoardCache";

/**
 * The games worth looking at, and the price each one has to pay.
 *
 * Measured on 91 games, and again on 102 after the markets were
 * recalibrated, the board's own record splits cleanly in two:
 *
 *     dupla hipótese com 70%+   24 jogos   87.5% certos   (antes: 25 / 88%)
 *     2X abaixo de 70%          13 jogos   46.2%
 *     golos / ambas / combinados 65 jogos  53.8%          (antes: 32 / 47%)
 *     tudo junto               102 jogos   60.8%
 *
 * A third of what the board leads with is a coin flip, and it is all in the
 * goals and both-teams-to-score markets: a score is the one thing the model
 * is asked to invent, while "this side does not lose" is the one thing a
 * season of results actually measures. The confidence only starts meaning
 * something at seventy — between 65% and 69% the board hit 47%, below 65% it
 * hit 56%, and above 70% it hit 83%.
 *
 * Since the recalibration the board leads with the double chance whenever it
 * clears seventy, which is what this file always said it should: the two
 * numbers below are now the same rule on both sides of the wire.
 *
 * None of which is a bet. A pick that lands 88% of the time is worth money
 * only above the price that 88% is worth, and the bookmaker knows the Benfica
 * does not lose at home too — so the minimum odd travels with every pick.
 */

/** What a season of results can measure: a side not losing. */
export const SHORTLIST_MARKETS = ["1X", "2X"];

/** Under this the forecast carries no information worth acting on. */
export const SHORTLIST_MIN_PCT = 70;

export interface Pick {
  headline_market: string;
  headline_pct: number;
}

export function onShortlist(match: Pick): boolean {
  return (
    SHORTLIST_MARKETS.includes(match.headline_market) &&
    match.headline_pct >= SHORTLIST_MIN_PCT
  );
}

/**
 * O que a previsão faz mesmo, acima dos 60%.
 *
 * Medido no registo do próprio quadro, 1185 previsões marcadas contra o
 * resultado:
 *
 *     dizia 26%   entrou 25.7%   (n=171)
 *     dizia 35%   entrou 42.2%   (n=237)
 *     dizia 45%   entrou 38.6%   (n=267)
 *     dizia 55%   entrou 53.0%   (n=219)
 *     dizia 65%   entrou 51.6%   (n=184)   <- 12.9 pontos curto, margem 7.4
 *     dizia 74%   entrou 64.0%   (n=86)    <- 10.2 pontos curto, margem 10.4
 *
 * Até aos 55% o número está onde diz estar. Acima disso promete cerca de
 * dez pontos a mais, e é exactamente aí que se aposta — é a faixa que
 * enche a lista dos mais prováveis.
 *
 * Não é a semana dos poucos empates, que foi o que me enganou à primeira.
 * Separado em duas famílias que não partilham resultados, as duas ficam
 * curtas na mesma medida e as duas fora da própria margem:
 *
 *     mercados que levam o empate   n=128   diz 69.1%   entra 57.0%   ±8.8
 *     golos e resultado seco        n=151   diz 67.3%   entra 57.0%   ±8.1
 *
 * Abaixo dos 55% não se corrige nada. A faixa dos 35% entrou sete pontos
 * acima do prometido, e corrigir para cima baixaria o preço mínimo — ou
 * seja, mandaria aceitar odds piores por causa de uma medição que mal
 * passa a margem. O erro que custa dinheiro é só num sentido.
 *
 * A rampa entre 55 e 60 existe para não haver um degrau: sem ela, 59,9%
 * e 60,1% pediriam preços a treze cêntimos de distância.
 */
const OVERSELL_PP = 11;
const OVERSELL_FROM = 55;
const OVERSELL_FULL = 60;

export function measuredPct(pct: number): number {
  if (!Number.isFinite(pct) || pct <= OVERSELL_FROM) return pct;
  const share = Math.min(
    1,
    (pct - OVERSELL_FROM) / (OVERSELL_FULL - OVERSELL_FROM),
  );
  return Math.max(1, pct - OVERSELL_PP * share);
}

/**
 * The odd a pick has to beat to be worth taking.
 *
 * Break-even, and rounded up: at 88% the fair price is 1.136, and quoting
 * 1.13 would be telling somebody a losing bet is an even one.
 *
 * Sobre o que a previsão faz e não sobre o que ela diz. Era sobre o que
 * ela diz, e isso punha no ecrã um preço mínimo que já era uma perda: a
 * 74% pedia 1,36 quando essas entram 64% das vezes e precisam de 1,57.
 * Vinte e um jogos deste registo foram aceites a 1,21 de média por isso.
 */
function breakEven(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  if (pct >= 100) return 1;
  return Math.ceil((100 / pct) * 100) / 100;
}

export function minimumOdd(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return breakEven(measuredPct(pct));
}

/**
 * Of several picks taken together, what the whole slip has to pay.
 *
 * Cada perna é corrigida e só depois se multiplicam. Ao contrário dava
 * outra coisa: a correcção foi medida em previsões de mercados, e duas
 * pernas de 80% dão um boletim de 64% — um número que nunca foi previsto
 * por ninguém e a que nada do que está medido se aplica.
 */
export function minimumOddOfSlip(pcts: number[]): number {
  if (pcts.length === 0) return 0;
  const together = pcts.reduce(
    (chance, pct) => chance * (measuredPct(pct) / 100),
    1,
  );
  return breakEven(together * 100);
}

export function shortlistOf(matches: BoardMatch[]): BoardMatch[] {
  return matches.filter((match) => onShortlist(match));
}
