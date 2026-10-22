import { recordVerdict } from "@/lib/matchValue";
import { measuredPct } from "@/lib/shortlist";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

/**
 * A aposta que eu faria neste jogo, e porquê.
 *
 * O veredicto que já existe julga um mercado, o que o quadro pôs à
 * frente. Mas a escolha interessante é outra: de quinze mercados, qual
 * é o que vale a pena — e muitas vezes não é o mais provável, é aquele
 * em que o preço está desalinhado com o que ele vale.
 *
 * O critério é o mesmo que uso à mão:
 *
 * 1. Histórico curto trava o jogo inteiro. Sem jogos por baixo, o resto
 *    da conta é aritmética sobre areia.
 * 2. Discordar muito do mercado desqualifica o mercado em causa. Doze
 *    pontos acima de milhares de pessoas com dinheiro em cima não é uma
 *    oportunidade, é um aviso — e é o erro que o nosso registo mostra
 *    que cometemos.
 * 3. Do que sobra, ganha o que mais paga acima do que vale.
 * 4. E diz-se também o que evitar, que é a pergunta que ninguém faz e
 *    que custa mais dinheiro do que a outra.
 */

export interface MarketQuote {
  market: string;
  /** O que o modelo diz, em bruto. */
  raw: number;
  /** O mesmo, já descontado o exagero medido. */
  ours: number;
  /** O que o mercado diz, sem a margem da casa. */
  marketPct: number | null;
  /** O preço mediano das casas, quando é um mercado que elas nos dão. */
  price: number | null;
  /** O preço a que isto fica justo. */
  fairPrice: number;
  /** Quanto o preço paga acima do que vale, em pontos. */
  edge: number | null;
  /** Quanto estamos acima do mercado. Negativo: eles estão acima de nós. */
  gap: number | null;
}

export interface Suggestion {
  /**
   * "esperar" não é "passar".
   *
   * Um jogo que as casas ainda não abriram não é um jogo mau: é um jogo
   * por abrir, e dizer "não aposto" a quem volta cá amanhã é mentira.
   */
  call: "apostar" | "passar" | "esperar";
  pick: MarketQuote | null;
  because: string;
  /** O mercado mais tentador e mais perigoso deste jogo. */
  avoid: MarketQuote | null;
  avoidBecause: string;
}

export interface SuggestionInput {
  markets: { mercado: string; probabilidade_pct: number }[];
  amostraPct: number;
  prices: Record<string, number> | null;
  implied: Record<string, number> | null;
  record: Map<string, AccuracyMarket>;
  adjustments: Record<string, number>;
  /**
   * Como se escreve o nome de um mercado para quem lê.
   *
   * A frase é feita aqui porque é aqui que ela se testa, mas "Casa" é um
   * código do nosso lado — no ecrã diz-se "Vitória Casa".
   */
  label?: (market: string) => string;
}

/** Abaixo disto a vantagem não se distingue do erro do próprio modelo. */
const EDGE_FLOOR = 3;
/** A partir daqui, discordar do mercado é sinal de que somos nós. */
const GAP_VETO = 12;
/** E a partir daqui já merece ser nomeado como armadilha. */
const GAP_WARN = 8;
/** Sem isto por baixo, não há conta que se aproveite. */
const SAMPLE_FLOOR = 50;

const num = (value: number, casas = 1) =>
  value.toFixed(casas).replace(".", ",");

function fairOdd(pct: number): number {
  if (pct <= 0) return 0;
  return Math.ceil((100 / pct) * 100) / 100;
}

export function quotes(input: SuggestionInput): MarketQuote[] {
  return input.markets.map((entry) => {
    const ours = measuredPct(
      entry.probabilidade_pct,
      input.adjustments[entry.mercado],
    );
    const marketPct = input.implied?.[entry.mercado] ?? null;
    const price = input.prices?.[entry.mercado] ?? null;

    return {
      market: entry.mercado,
      raw: entry.probabilidade_pct,
      ours,
      marketPct,
      price,
      fairPrice: fairOdd(ours),
      edge: price && price > 1 ? ours - 100 / price : null,
      gap: marketPct === null ? null : ours - marketPct,
    };
  });
}

export function suggest(input: SuggestionInput): Suggestion {
  const all = quotes(input);
  const name = input.label ?? ((market: string) => market);

  // O que evitar diz-se sempre que houver, mesmo quando há uma boa: é
  // nos mercados em que estamos muito acima do mercado que o dinheiro
  // desaparece, e são precisamente os que parecem melhores.
  const trap = all
    .filter((q) => q.gap !== null && q.gap >= GAP_WARN)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];

  const avoid = trap ?? null;
  const avoidBecause = avoid
    ? `Damos ${num(avoid.ours)}% e o mercado dá ${num(
        avoid.marketPct as number,
      )}%. É onde o nosso registo mostra que nos enganamos.`
    : "";

  if (input.amostraPct < SAMPLE_FLOOR) {
    return {
      call: "passar",
      pick: null,
      // O "não aposto" está no título do cartão, em letra grande. Aqui
      // diz-se só porquê.
      because: `Só ${num(
        input.amostraPct,
        0,
      )}% do histórico necessário sustenta estes números.`,
      avoid,
      avoidBecause,
    };
  }

  const comPreco = all.filter((q) => q.price !== null && q.marketPct !== null);
  if (comPreco.length === 0) {
    return {
      call: "esperar",
      pick: null,
      because: "As casas ainda não abriram este jogo.",
      avoid,
      avoidBecause,
    };
  }

  const elegiveis = comPreco.filter((q) => {
    if ((q.gap ?? 0) >= GAP_VETO) return false;
    if ((q.edge ?? 0) < EDGE_FLOOR) return false;
    const rec = input.record.get(q.market);
    return !(recordVerdict(rec ?? null) === "over" && Math.abs(rec?.gap_pp ?? 0) >= 10);
  });

  if (elegiveis.length === 0) {
    // Dizer qual esteve mais perto, e de quê, vale mais do que um "não".
    const melhor = [...comPreco].sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0))[0];
    const razao =
      (melhor.gap ?? 0) >= GAP_VETO
        ? `estamos ${num(melhor.gap as number)} pontos acima do mercado`
        : `só sobram ${num(Math.max(melhor.edge ?? 0, 0))} pontos de vantagem`;

    return {
      call: "passar",
      pick: null,
      because: `O melhor que há era ${name(melhor.market)} a ${num(
        melhor.price as number,
        2,
      )}, e ${razao}.`,
      avoid,
      avoidBecause,
    };
  }

  const pick = elegiveis.sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0))[0];

  return {
    call: "apostar",
    pick,
    // Sem repetir o nome do mercado nem o preço, que estão em cima em
    // letra grande: o que falta aqui é porque é que isso é uma aposta.
    because: `Nós damos ${num(pick.ours)}% e o mercado ${num(
      pick.marketPct as number,
    )}%. A ${num(pick.price as number, 2)} o justo seria ${num(
      pick.fairPrice,
      2,
    )} — ${num(pick.edge as number)} pontos a teu favor.`,
    avoid: avoid && avoid.market !== pick.market ? avoid : null,
    avoidBecause: avoid && avoid.market !== pick.market ? avoidBecause : "",
  };
}
