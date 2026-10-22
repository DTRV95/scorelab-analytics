import { recordVerdict } from "@/lib/matchValue";
import { measuredPct } from "@/lib/shortlist";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

/**
 * O que eu faria neste jogo, e porquê.
 *
 * O veredicto que já existe julga um mercado, o que o quadro pôs à
 * frente. Mas a escolha interessante é outra: de quinze mercados, qual
 * é o que vale a pena — e muitas vezes não é o mais provável, é aquele
 * em que o preço está desalinhado com o que ele vale.
 *
 * Isto dá sempre uma opinião. Houve aqui, durante umas horas, um
 * histórico curto que travava o jogo inteiro: com as amostras que os
 * jogos de um sábado têm, saía "não aposto neste jogo" em todos eles, e
 * oito cartões iguais não são oito opiniões — são nenhuma. A amostra
 * curta não é motivo para calar, é motivo para **pedir mais**: mesmo
 * jogo, mesma conta, fasquia mais alta.
 *
 * O critério, por ordem:
 *
 * 1. Fora de questão o mercado em que estamos doze pontos acima das
 *    casas, e aquele onde o nosso registo é comprovadamente mau. Doze
 *    pontos acima de milhares de pessoas com dinheiro em cima não é uma
 *    oportunidade, é um aviso.
 * 2. Do que sobra, a fasquia: três pontos de vantagem com histórico
 *    cheio, e até nove quando quase não há histórico.
 * 3. Quem a passa é aposta. Quem paga acima do justo mas não chega à
 *    fasquia é aposta pequena. Quem nem isso é o melhor que o jogo tem
 *    — nomeado na mesma, com a razão por que não lhe punha dinheiro.
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
  /** Se este preço não é uma cotação, é o que as cotações obrigam. */
  derived: boolean;
}

/**
 * Quanto é que eu punha nisto.
 *
 * Quatro respostas e não duas, porque entre "aposta" e "nada" está a
 * maior parte dos jogos de um fim-de-semana, e empurrar essa maioria
 * para um dos extremos é mentir para um dos lados.
 */
export type Call = "apostar" | "pequena" | "passar" | "esperar";

export const CALL_LABEL: Record<Call, string> = {
  apostar: "aposto",
  pequena: "aposto pouco",
  passar: "não punha",
  esperar: "sem preço",
};

export interface Suggestion {
  call: Call;
  /**
   * O mercado de que estamos a falar.
   *
   * Vem preenchido mesmo quando a resposta é "não punha": a opinião é
   * sobre alguma coisa, e "o melhor deste jogo é este e nem esse presta"
   * diz muito mais do que um não em branco.
   */
  pick: MarketQuote | null;
  /** A vantagem que este jogo tinha de ter, dado o histórico que tem. */
  required: number;
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
  /** Os mercados cujo preço foi deduzido das simples, não cotado. */
  derived?: string[];
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
/** O histórico a partir do qual não se pede nada de especial. */
const SAMPLE_FULL = 70;
/** E o máximo que a falta dele chega a pedir, por mais curta que seja. */
const EXTRA_MAX = 6;

const num = (value: number, casas = 1) =>
  value.toFixed(casas).replace(".", ",");

function fairOdd(pct: number): number {
  if (pct <= 0) return 0;
  return Math.ceil((100 / pct) * 100) / 100;
}

/**
 * A vantagem que este jogo tem de ter para eu lhe pegar.
 *
 * Três pontos é o chão: abaixo disso a vantagem não se distingue do
 * erro do próprio modelo. O que o histórico curto faz é subir esse
 * chão, porque uma conta feita sobre dez jogos erra mais do que a
 * mesma conta feita sobre cem — e o preço de errar é o mesmo.
 *
 * Um ponto por cada dez que faltam para os setenta, até nove. Com 33%
 * de histórico, que é o que um sábado normal traz, pede-se 6,7.
 */
export function required(amostraPct: number): number {
  const falta = Math.max(0, SAMPLE_FULL - (amostraPct || 0));
  return EDGE_FLOOR + Math.min(EXTRA_MAX, falta / 10);
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
      derived: (input.derived ?? []).includes(entry.mercado),
    };
  });
}

/** Um mercado em que o modelo já provou prometer mais do que entrega. */
function badRecord(
  record: Map<string, AccuracyMarket>,
  market: string,
): boolean {
  const found = record.get(market) ?? null;
  return recordVerdict(found) === "over" && Math.abs(found?.gap_pp ?? 0) >= 10;
}

export function suggest(input: SuggestionInput): Suggestion {
  const all = quotes(input);
  const name = input.label ?? ((market: string) => market);
  const exigido = required(input.amostraPct);

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

  const feito = (call: Call, pick: MarketQuote | null, because: string) => ({
    call,
    pick,
    required: exigido,
    // Quando a escolha é ela própria o mercado em que mais discordamos
    // das casas, o aviso não pode desaparecer só porque não cabe na
    // linha de baixo — era exactamente aí que ele fazia falta. Fica
    // dito na mesma frase: é aposta, e é aposta contra o mercado.
    because:
      (call === "apostar" || call === "pequena") &&
      pick &&
      (pick.gap ?? 0) >= GAP_WARN
        ? `${because} E vai contra as casas: estamos ${num(
            pick.gap as number,
          )} pontos acima delas aqui.`
        : because,
    // O que se evita nunca é o que se escolhe, mas a regra de um não
    // obriga a do outro: oito pontos nomeiam uma armadilha, doze
    // desqualificam o mercado, e entre os dois há folga.
    avoid: avoid && avoid.market !== pick?.market ? avoid : null,
    avoidBecause: avoid && avoid.market !== pick?.market ? avoidBecause : "",
  });

  const usable = all.filter(
    (q) => (q.gap ?? 0) < GAP_VETO && !badRecord(input.record, q.market),
  );

  if (usable.length === 0) {
    return feito(
      "passar",
      null,
      all.length === 0
        ? "Ainda não há contas feitas para este jogo."
        : "Em todos os mercados deste jogo ou estamos acima das casas ou temos mau registo. Não há aqui nada que eu jogasse.",
    );
  }

  /** O mais provável, que é a que se escolhe quando não há preço a favor. */
  const maisProvavel = [...usable].sort((a, b) => b.ours - a.ours)[0];

  const priced = usable.filter((q) => q.price !== null && q.marketPct !== null);
  if (priced.length === 0) {
    return feito(
      "esperar",
      maisProvavel,
      `As casas ainda não abriram este jogo. Quando abrirem é aqui que olho: damos ${num(
        maisProvavel.ours,
      )}% e só paga acima de ${num(maisProvavel.fairPrice, 2)}.`,
    );
  }

  const porVantagem = [...priced].sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const melhor = porVantagem[0];
  const vantagem = melhor.edge ?? 0;

  const lado = `Nós damos ${num(melhor.ours)}% e o mercado ${num(
    melhor.marketPct as number,
  )}%.`;
  const preco = num(melhor.price as number, 2);

  if (vantagem >= exigido) {
    return feito(
      "apostar",
      melhor,
      // Sem repetir o nome do mercado nem o preço, que estão em cima em
      // letra grande: o que falta aqui é porque é que isso é uma aposta.
      `${lado} A ${preco} o justo seria ${num(
        melhor.fairPrice,
        2,
      )} — ${num(vantagem)} pontos a teu favor.`,
    );
  }

  // Três pontos também aqui, e não "acima de zero". Um azarão a 4,20
  // que paga um ponto acima do justo cabia na folga, e "aposto pouco
  // em Vitória Fora a 4,20" não é coisa que eu diga: abaixo dos 55% a
  // probabilidade não leva desconto nenhum, por isso essa vantagem é o
  // ruído da própria medição e não uma vantagem.
  if (vantagem >= EDGE_FLOOR) {
    return feito(
      "pequena",
      melhor,
      `${lado} A ${preco} paga ${num(
        vantagem,
      )} pontos acima do justo, e com ${num(
        input.amostraPct,
        0,
      )}% de histórico eu queria ${num(exigido)}. Dá, mas pouco.`,
    );
  }

  // Nem isso. Nomeia-se o melhor que o jogo tem na mesma — e aqui o
  // melhor é o mais provável, não o menos mau ao preço: sem vantagem
  // nenhuma em lado nenhum, ordenar por vantagem põe à frente um azarão
  // caro só porque ninguém o cotou pior.
  //
  // E sem armadilhas aqui dentro. Nas duas respostas de cima escolhe-se
  // por vantagem medida, e oito pontos de discordância com vantagem a
  // sério é precisamente o caso que interessa. Aqui escolhe-se pela
  // nossa própria probabilidade, sem o mercado a confirmar nada — e a
  // probabilidade de que mais duvidamos é exactamente a daquele em que
  // discordamos deles.
  const porSegurança = (lista: MarketQuote[]) =>
    [...lista].sort((a, b) => b.ours - a.ours)[0];
  const calmos = priced.filter((q) => (q.gap ?? 0) < GAP_WARN);
  const firme = porSegurança(calmos.length > 0 ? calmos : priced);

  // Pagar exactamente o que vale e pagar menos do que vale não são a
  // mesma recusa, e dizer "o preço come a vantagem" sobre uma odd que
  // está em cima do justo é dizer uma coisa falsa.
  const sobra = firme.edge ?? 0;
  const remate =
    sobra >= 0
      ? `O justo era ${num(firme.fairPrice, 2)} e pagam ${num(
          firme.price as number,
          2,
        )}: paga o que vale e mais nada, e não é por isso que eu arriscava.`
      : `O justo era ${num(firme.fairPrice, 2)} e pagam só ${num(
          firme.price as number,
          2,
        )} — ${num(Math.abs(sobra))} pontos abaixo do que isto vale.`;

  return feito(
    "passar",
    firme,
    `Nós damos ${num(firme.ours)}% e o mercado ${num(
      firme.marketPct as number,
    )}%. ${remate}`,
  );
}
