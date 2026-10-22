import { recordVerdict } from "@/lib/matchValue";
import { measuredPct, minimumOdd } from "@/lib/shortlist";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

/**
 * Uma decisão por jogo, e a razão dela numa linha.
 *
 * O dossiê dá factos e objecções e deixa a conta ao leitor. Isso é
 * honesto mas é meio trabalho: às dez da manhã de sábado, com quinze
 * jogos à frente, ninguém faz quinze sínteses.
 *
 * Nada aqui é opinião. Cada regra sai de uma coisa medida — o exagero
 * do modelo acima dos 55%, o registo por mercado, o tamanho da amostra,
 * o preço a que as casas estão a pagar. E, ao contrário de toda a gente
 * que dá palpites, este fica guardado com o preço do dia e é conferido
 * contra o resultado. Daqui a um mês sabe-se se vale alguma coisa.
 */

export type Call = "apostar" | "passar" | "esperar";

export interface Verdict {
  call: Call;
  /** A razão principal. Uma só — a que decidiu. */
  because: string;
  /** A probabilidade por que ficamos, já descontado o nosso exagero. */
  fairPct: number | null;
  /** O preço do mercado, quando o há. */
  price: number | null;
  /** Quanto é que o preço paga acima do que vale, em pontos. */
  edgePp: number | null;
  /** A odd abaixo da qual isto não se aguenta. */
  minimum: number | null;
}

export interface VerdictInput {
  headline: { market: string; pct: number } | null;
  /**
   * O exagero medido deste mercado, em pontos, quando já se sabe.
   *
   * Sem isto, descontava-se o mesmo a todos — e o modelo não erra da
   * mesma maneira no 1X e no "Mais de 2.5 Golos".
   */
  adjustmentPp?: number;
  amostraPct: number;
  record: AccuracyMarket | null;
  /** O preço mediano das casas, por mercado. */
  prices?: Record<string, number> | null;
  /** O que o mercado diz em probabilidade, já sem a margem. */
  implied?: Record<string, number> | null;
}

/**
 * Abaixo disto a vantagem não se distingue do erro do próprio modelo.
 *
 * Medimos um exagero de onze pontos acima dos 55% e corrigimo-lo, mas a
 * correcção tem ela própria margem. Dois pontos de vantagem sobre o
 * mercado não são uma oportunidade, são ruído com sinal positivo.
 */
const EDGE_FLOOR = 3;

/** A partir daqui, discordar do mercado é sinal de que somos nós. */
const MARKET_GAP_VETO = 12;

/** Abaixo disto, o número tem pouco por baixo dele. */
const SAMPLE_FLOOR = 50;

/** E um mercado onde já prometemos muito mais do que entregámos. */
const RECORD_VETO_PP = 10;

const num = (value: number, casas = 1) =>
  value.toFixed(casas).replace(".", ",");

export function decide(input: VerdictInput): Verdict {
  const empty: Verdict = {
    call: "esperar",
    because: "Sem mercado principal para este jogo.",
    fairPct: null,
    price: null,
    edgePp: null,
    minimum: null,
  };

  const { headline } = input;
  if (!headline) return empty;

  const fair = measuredPct(headline.pct, input.adjustmentPp);
  const minimum = minimumOdd(headline.pct, input.adjustmentPp);
  const price = input.prices?.[headline.market] ?? null;
  const mercado = input.implied?.[headline.market] ?? null;
  const edge = price && price > 1 ? fair - 100 / price : null;

  const base = { fairPct: fair, price, edgePp: edge, minimum };

  // Os vetos primeiro, e por ordem de gravidade. Um jogo pode falhar
  // por mais do que uma razão; diz-se a que mais pesa, porque uma lista
  // de cinco motivos não é uma decisão, é outra vez o trabalho todo.
  if (input.amostraPct < SAMPLE_FLOOR) {
    return {
      ...base,
      call: "passar",
      because: `Só ${num(input.amostraPct, 0)}% do histórico necessário sustenta este número.`,
    };
  }

  if (
    recordVerdict(input.record) === "over" &&
    input.record &&
    Math.abs(input.record.gap_pp) >= RECORD_VETO_PP
  ) {
    return {
      ...base,
      call: "passar",
      because: `Neste mercado já prometemos ${num(
        Math.abs(input.record.gap_pp),
      )} pontos a mais do que entregámos, em ${input.record.samples} jogos.`,
    };
  }

  if (mercado !== null && fair - mercado >= MARKET_GAP_VETO) {
    return {
      ...base,
      call: "passar",
      because: `Damos ${num(fair)}% e o mercado dá ${num(
        mercado,
      )}%. Quando a diferença é esta, quem costuma estar errado somos nós.`,
    };
  }

  if (price === null) {
    return {
      ...base,
      call: "esperar",
      because: `As casas ainda não abriram este jogo. A tua conta só fecha a partir de ${num(
        minimum,
        2,
      )}.`,
    };
  }

  if (edge === null || edge <= 0) {
    return {
      ...base,
      call: "passar",
      because: `O mercado paga ${num(price, 2)} e isto vale ${num(
        minimum,
        2,
      )}. A esta odd perdes mesmo acertando a maioria das vezes.`,
    };
  }

  if (edge < EDGE_FLOOR) {
    return {
      ...base,
      call: "esperar",
      because: `Sobram ${num(
        edge,
      )} pontos de vantagem, que é menos do que a margem de erro do nosso próprio acerto.`,
    };
  }

  return {
    ...base,
    call: "apostar",
    because: `O mercado paga ${num(price, 2)} e nós valemos isto a ${num(
      minimum,
      2,
    )} — ${num(edge)} pontos a teu favor.`,
  };
}

/** A cor do veredicto, pela regra da casa: verde e carmim são veredicto. */
export function callTone(call: Call): "good" | "bad" | "wait" {
  if (call === "apostar") return "good";
  if (call === "passar") return "bad";
  return "wait";
}

export const CALL_LABEL: Record<Call, string> = {
  apostar: "Vale a pena",
  passar: "Deixa passar",
  esperar: "Espera",
};
