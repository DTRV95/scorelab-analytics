import { legOutcome } from "@/lib/bettingStyle";
import { canonicalMarket } from "@/lib/marketNames";
import type { PlanBet } from "@/lib/planStore";
import {
  SHORTLIST_MARKETS,
  SHORTLIST_MIN_PCT,
  minimumOddOfSlip,
} from "@/lib/shortlist";

/**
 * As conquistas, e o que se escolheu não premiar.
 *
 * Isto é uma aplicação de apostas, e a maneira fácil de fazer conquistas
 * numa aplicação de apostas é premiar o volume: apostas feitas, dias
 * seguidos a apostar, quantias arriscadas. Era meio caminho para alguém
 * apostar para desbloquear uma medalha, e nenhuma delas valeria o que
 * custou.
 *
 * Por isso nenhuma destas se ganha por apostar mais. Ganham-se pelas duas
 * coisas que o registo de cada um mostra fazerem diferença — aceitar o
 * preço certo e escolher o que o quadro mede bem — e por manter o registo
 * em dia, que é a base de tudo o que esta aplicação diz. Os níveis do
 * desafio contam porque são o jogo que a pessoa escolheu jogar, não um
 * jogo que a aplicação lhe pôs à frente.
 *
 * Tudo isto é calculado a partir das apostas. Não há nada guardado na base
 * de dados, nada para sincronizar, e uma conquista nunca pode ficar
 * dessincronizada do que lhe deu origem.
 */

export type AchievementTone = "discipline" | "record" | "ladder";

export interface Achievement {
  id: string;
  title: string;
  /** Uma linha: o que isto quer dizer, não uma palmadinha nas costas. */
  note: string;
  tone: AchievementTone;
  /** Onde a pessoa vai. */
  value: number;
  /** Onde isto se ganha. */
  target: number;
  earned: boolean;
}

export interface AchievementsView {
  earned: Achievement[];
  /** A seguinte a caminho, a que está mais perto de sair. */
  next: Achievement | null;
  /** Todas, para quem quiser ver a lista inteira. */
  all: Achievement[];
}

const SHORT = new Set(SHORTLIST_MARKETS.map((market) => market.toLowerCase()));

/** Só o que já tem resultado: o registo, não o que está em cima da mesa. */
function decided(bets: PlanBet[]): PlanBet[] {
  return bets.filter((bet) => bet.status !== "pending");
}

/**
 * Pernas do tipo que o registo do quadro mede melhor: dupla hipótese alta.
 *
 * Só de apostas já decididas, e por uma razão que um teste apanhou: a
 * contar as que ainda estão em jogo, bastava registar vinte e cinco para a
 * ganhar — uma conquista que se ganha a apostar, que é precisamente o que
 * nenhuma destas pode ser.
 */
function shortlistLegs(bets: PlanBet[]): number {
  let total = 0;
  for (const bet of decided(bets)) {
    for (const leg of bet.legs) {
      const market = canonicalMarket(leg.market).toLowerCase();
      if (SHORT.has(market) && leg.modelProb >= SHORTLIST_MIN_PCT) total += 1;
    }
  }
  return total;
}

/**
 * Apostas aceites acima do preço a que ficam a zero.
 *
 * Medido nas apostas deles: as pernas entram 75% das vezes e mesmo assim os
 * golos deram -1,2%, porque foram aceites a 1,32 quando precisavam de 1,36.
 * É a única coisa que separa acertar de ganhar, e por isso é a conquista
 * que está primeiro. Também só conta decididas: o que se mede é o registo,
 * não quantas apostas estão abertas neste momento.
 */
function atTheRightPrice(bets: PlanBet[]): number {
  let total = 0;
  for (const bet of decided(bets)) {
    const judged = bet.legs.filter((leg) => leg.modelProb > 0);
    if (judged.length === 0 || judged.length !== bet.legs.length) continue;

    const floor = minimumOddOfSlip(judged.map((leg) => leg.modelProb));
    if (floor > 1 && bet.odds >= floor) total += 1;
  }
  return total;
}

/** Apostas perdidas em que se disse quais das pernas falharam. */
function namedTheFailures(bets: PlanBet[]): number {
  return bets.filter(
    (bet) =>
      bet.status === "red" &&
      bet.legs.length > 1 &&
      bet.legs.every((leg) => legOutcome(bet, leg) !== "unknown"),
  ).length;
}

/** Dias diferentes em que se registou alguma coisa. */
function daysKept(bets: PlanBet[]): number {
  const days = new Set<string>();
  for (const bet of bets) {
    const day = (bet.placedAt || "").slice(0, 10);
    if (day) days.add(day);
  }
  return days.size;
}

/** A maior corrida de apostas ganhas, pela ordem em que foram registadas. */
function longestRun(bets: PlanBet[]): number {
  const decided = [...bets]
    .filter((bet) => bet.status !== "pending")
    .sort((a, b) => (a.placedAt || "").localeCompare(b.placedAt || ""));

  let best = 0;
  let run = 0;
  for (const bet of decided) {
    run = bet.status === "green" ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

function make(
  id: string,
  title: string,
  note: string,
  tone: AchievementTone,
  value: number,
  target: number,
): Achievement {
  return { id, title, note, tone, value, target, earned: value >= target };
}

/**
 * O que esta pessoa já conquistou, e o que está mais perto de conquistar.
 *
 * `level` é o nível mais alto a que chegou em qualquer desafio: é a única
 * coisa aqui que não se lê das apostas, porque um nível é do desafio.
 */
export function achievements(
  bets: PlanBet[],
  level = 0,
): AchievementsView {
  const settled = bets.filter((bet) => bet.status !== "pending").length;
  const open = bets.filter((bet) => bet.status === "pending").length;

  const all: Achievement[] = [
    make(
      "primeira",
      "A primeira",
      "Uma aposta registada. A partir daqui há registo para ler.",
      "record",
      bets.length,
      1,
    ),
    make(
      "dez-decididas",
      "Dez decididas",
      "Dez apostas fechadas: abaixo disto uma percentagem é só uma moeda.",
      "record",
      settled,
      10,
    ),
    make(
      "cinquenta-decididas",
      "Cinquenta decididas",
      "Com cinquenta, o que o teu registo diz já se sustenta.",
      "record",
      settled,
      50,
    ),
    make(
      "preco-certo",
      "Ao preço certo",
      "Dez apostas aceites acima da odd a que ficavam a zero.",
      "discipline",
      atTheRightPrice(bets),
      10,
    ),
    make(
      "lista-curta",
      "Lista curta",
      `Vinte e cinco jogos de dupla hipótese a ${SHORTLIST_MIN_PCT}% ou mais — o que o quadro mede melhor.`,
      "discipline",
      shortlistLegs(bets),
      25,
    ),
    make(
      "sem-pendencias",
      "Mesa limpa",
      "Dez decididas e nenhuma por fechar. O registo só vale se estiver em dia.",
      "discipline",
      settled >= 10 && open === 0 ? 1 : 0,
      1,
    ),
    make(
      "disse-o-que-falhou",
      "Disseste o que falhou",
      "Cinco dias perdidos com os jogos marcados um a um, em vez de um risco por cima.",
      "discipline",
      namedTheFailures(bets),
      5,
    ),
    make(
      "trinta-dias",
      "Trinta dias de registo",
      "Trinta dias diferentes com alguma coisa registada.",
      "record",
      daysKept(bets),
      30,
    ),
    make(
      "cinco-seguidas",
      "Cinco seguidas",
      "Cinco apostas decididas sem falhar uma.",
      "ladder",
      longestRun(bets),
      5,
    ),
    make(
      "nivel-dez",
      "Nível dez",
      "Chegar ao décimo nível de um desafio.",
      "ladder",
      level,
      10,
    ),
    make(
      "nivel-vinte",
      "Nível vinte",
      "Metade do Plano Milhão, que é mais do que quase toda a gente faz.",
      "ladder",
      level,
      20,
    ),
  ];

  const earned = all.filter((item) => item.earned);
  // A seguinte é a que está mais perto, em proporção: faltar uma de vinte e
  // cinco está mais perto do que faltar uma de duas.
  const next =
    all
      .filter((item) => !item.earned)
      .sort((a, b) => b.value / b.target - a.value / a.target)[0] ?? null;

  return { earned, next, all };
}
