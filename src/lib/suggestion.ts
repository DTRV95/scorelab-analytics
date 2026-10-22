import { recordVerdict } from "@/lib/matchValue";
import { measuredPct } from "@/lib/shortlist";
import { losing, patternFor, type Patterns } from "@/lib/betPatterns";
import { canonicalMarket } from "@/lib/marketNames";
import { statusLabel } from "@/lib/absences";
import type { Absence } from "@/lib/marketPrice";
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

export interface Suggestion {
  call: Call;
  /**
   * O mercado de que estamos a falar.
   *
   * Vem preenchido mesmo quando a resposta é não: a opinião é
   * sobre alguma coisa, e "o melhor deste jogo é este e nem esse presta"
   * diz muito mais do que um não em branco.
   */
  pick: MarketQuote | null;
  /** A vantagem que este jogo tinha de ter para eu lhe pegar. */
  required: number;
  /**
   * O que levantou essa fasquia acima do chão.
   *
   * Vem em campo próprio e não na frase. A frase diz o que fazer, e
   * tem de caber num ecrã de telemóvel; isto é o meu raciocínio, que
   * quem quiser conferir lê por baixo e quem não quiser salta.
   */
  raised: Reason[];
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
  /** Quem falta, por equipa. Null quando ninguém olhou. */
  absences?: Record<string, Absence[]> | null;
  /** Os nomes das duas equipas, para se saber de quem são as baixas. */
  teams?: { home: string; away: string } | null;
  /**
   * As duas fontes discordam sobre quem joga em casa.
   *
   * O preço não sofre, que vai pelo nome. A previsão sofre: ela deu a
   * vantagem de casa a uma equipa, e pode tê-la dado à errada.
   */
  homeAwayDisagrees?: boolean;
  /** O que o nosso próprio dinheiro já fez em mercados como este. */
  patterns?: Patterns | null;
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

/**
 * Percentagens inteiras, preços com os dois cêntimos.
 *
 * O "54,0%" tinha uma casa decimal que ninguém usa para decidir nada e
 * que ocupava o espaço de uma palavra em cada frase. Num preço a casa
 * decimal é dinheiro, por isso essa fica.
 */
const pct = (value: number) => `${Math.round(value)}%`;
const odd = (value: number) => value.toFixed(2).replace(".", ",");

function fairOdd(pct: number): number {
  if (pct <= 0) return 0;
  return Math.ceil((100 / pct) * 100) / 100;
}

/** Uma coisa que me fez pedir mais do que o costume, e quanto. */
export interface Reason {
  what: string;
  pp: number;
}

export interface Demand {
  /** A vantagem que este jogo tem de ter para eu lhe pegar. */
  points: number;
  /** E quem a levantou acima do chão. */
  because: Reason[];
}

/** Quantos faltam de certeza, por equipa. "Em dúvida" não conta como falta. */
export function missing(
  absences: Record<string, Absence[]> | null | undefined,
  side: string | null | undefined,
): number {
  if (!absences || !side) return 0;
  return (absences[side] ?? []).filter(
    (player) => statusLabel(player.status) !== "em dúvida",
  ).length;
}

/** A partir de quantas ausências certas uma equipa deixa de ser a que foi medida. */
const SQUAD_HOLE = 3;

/**
 * A vantagem que este jogo tem de ter para eu lhe pegar.
 *
 * Três pontos é o chão: abaixo disso a vantagem não se distingue do
 * erro do próprio modelo. O que vem a seguir não está medido em lado
 * nenhum — é juízo meu, e por isso tem uma regra que o torna seguro:
 * **só pode subir a fasquia, nunca baixá-la**. Um juízo errado para
 * cima custa uma aposta que não se fez; para baixo custa dinheiro, e
 * entre os dois erros só um é recuperável.
 *
 * Quatro coisas a levantam, e nenhuma delas o modelo vê:
 *
 * O histórico curto, que é a única medida das quatro: uma conta feita
 * sobre dez jogos erra mais do que a mesma conta sobre cem. Um ponto
 * por cada dez que faltam para os setenta, até seis.
 *
 * As baixas. O modelo conta golos de uma época inteira e não sabe que
 * faltam quatro titulares hoje — a equipa que ele mediu não é a que vai
 * jogar. Um ponto por cada lado com três ou mais ausências certas.
 *
 * O nosso próprio dinheiro. Se já perdemos em mercados desta família,
 * isso não prova nada sobre o próximo, mas é razão para exigir mais
 * antes de lá voltar. Ponto e meio.
 *
 * E a confusão de casa e fora, que vale por si e está mais abaixo: essa
 * não sobe a fasquia, tira o mercado de questão.
 */
export function demand(input: SuggestionInput, market?: string): Demand {
  const because: Reason[] = [];

  const falta = Math.max(0, SAMPLE_FULL - (input.amostraPct || 0));
  if (falta > 0) {
    because.push({
      what: `${Math.round(input.amostraPct)}% de histórico`,
      pp: Math.min(EXTRA_MAX, falta / 10),
    });
  }

  const fora = [
    { side: input.teams?.home, nome: input.teams?.home },
    { side: input.teams?.away, nome: input.teams?.away },
  ].filter((team) => missing(input.absences, team.side) >= SQUAD_HOLE);

  for (const team of fora) {
    because.push({
      what: `${team.nome} com ${missing(input.absences, team.side)} baixas`,
      pp: 1,
    });
  }

  if (market) {
    const nosso = patternFor(market, input.patterns ?? null);
    if (nosso && losing(nosso)) {
      because.push({
        what: `o nosso dinheiro perde em "${nosso.key}"`,
        pp: 1.5,
      });
    }
  }

  return {
    points: EDGE_FLOOR + because.reduce((sum, item) => sum + item.pp, 0),
    because,
  };
}

/**
 * A fasquia de um jogo, sem olhar a mercado nenhum.
 *
 * É a que se escreve quando ainda não há um mercado escolhido, e a que
 * os testes do histórico usam.
 */
export function required(amostraPct: number): number {
  return demand({
    markets: [],
    amostraPct,
    prices: null,
    implied: null,
    record: new Map(),
    adjustments: {},
  }).points;
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

/**
 * Os mercados que deixam de fazer sentido quando as fontes discordam
 * sobre quem joga em casa.
 *
 * Jogar em casa vale golos, e a previsão deu essa vantagem a uma das
 * equipas. Se foi à errada, o 1X e o Casa estão trocados com o 2X e o
 * Fora — e um mercado trocado não é um mercado menos certo, é outro
 * mercado. Os golos aguentam: a conta de quantos se marcam não muda
 * por se trocarem os lados.
 */
const SIDED = /^(Casa|Fora|1X|2X|12)$/i;

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
    ? `Damos ${pct(avoid.ours)} e o mercado ${pct(
        avoid.marketPct as number,
      )}. É onde o nosso registo mostra que nos enganamos.`
    : "";

  const feito = (call: Call, pick: MarketQuote | null, because: string) => ({
    call,
    pick,
    required: pedido(pick?.market).points,
    raised: pedido(pick?.market).because,
    // Quando a escolha é ela própria o mercado em que mais discordamos
    // das casas, o aviso não pode desaparecer só porque não cabe na
    // linha de baixo — era exactamente aí que ele fazia falta. Fica
    // dito na mesma frase: é aposta, e é aposta contra o mercado.
    because:
      (call === "apostar" || call === "pequena") &&
      pick &&
      (pick.gap ?? 0) >= GAP_WARN
        ? `${because} Vai contra as casas: ${num(
            pick.gap as number,
          )} pontos acima delas.`
        : because,
    // O que se evita nunca é o que se escolhe, mas a regra de um não
    // obriga a do outro: oito pontos nomeiam uma armadilha, doze
    // desqualificam o mercado, e entre os dois há folga.
    avoid: avoid && avoid.market !== pick?.market ? avoid : null,
    avoidBecause: avoid && avoid.market !== pick?.market ? avoidBecause : "",
  });

  // A fasquia depende do mercado, porque uma das razões que a levanta é
  // o que o nosso dinheiro já fez na família dele.
  const pedido = (market?: string) => demand(input, market);

  const usable = all.filter((q) => {
    if ((q.gap ?? 0) >= GAP_VETO) return false;
    if (badRecord(input.record, q.market)) return false;
    // Fontes a discordar sobre quem joga em casa: os mercados de
    // resultado saem, e os de golos ficam.
    if (input.homeAwayDisagrees && SIDED.test(canonicalMarket(q.market))) return false;
    return true;
  });

  if (usable.length === 0) {
    return feito(
      "passar",
      null,
      all.length === 0
        ? "Ainda não há contas feitas para este jogo."
        : input.homeAwayDisagrees
          ? "As fontes discordam sobre quem joga em casa, e sem isso o resultado não se calcula."
          : "Em todos os mercados ou estamos acima das casas ou temos mau registo. Nada a fazer aqui.",
    );
  }

  /** O mais provável, que é a que se escolhe quando não há preço a favor. */
  const maisProvavel = [...usable].sort((a, b) => b.ours - a.ours)[0];

  const priced = usable.filter((q) => q.price !== null && q.marketPct !== null);
  if (priced.length === 0) {
    return feito(
      "esperar",
      maisProvavel,
      `Sem preço ainda. Damos ${pct(
        maisProvavel.ours,
      )} — quando abrir, só paga acima de ${odd(maisProvavel.fairPrice)}.`,
    );
  }

  const porVantagem = [...priced].sort((a, b) => (b.edge ?? 0) - (a.edge ?? 0));
  const melhor = porVantagem[0];
  const vantagem = melhor.edge ?? 0;
  const exigido = pedido(melhor.market).points;

  const lado = `Damos ${pct(melhor.ours)}, o mercado ${pct(
    melhor.marketPct as number,
  )}.`;

  if (vantagem >= exigido) {
    return feito(
      "apostar",
      melhor,
      // Sem repetir o nome do mercado nem o preço, que estão em cima em
      // letra grande: o que falta aqui é porque é que isso é uma aposta.
      `${lado} Justo a ${odd(melhor.fairPrice)} — paga ${num(
        vantagem,
      )} pontos a mais.`,
    );
  }

  // Três pontos também aqui, e não "acima de zero". Um azarão a 4,20
  // que paga um ponto acima do justo cabia na folga, e meio boletim
  // num Vitória Fora a 4,20 não é coisa que eu diga: abaixo dos 55% a
  // probabilidade não leva desconto nenhum, por isso essa vantagem é o
  // ruído da própria medição e não uma vantagem.
  if (vantagem >= EDGE_FLOOR) {
    return feito(
      "pequena",
      melhor,
      `${lado} Paga ${num(vantagem)} pontos a mais e eu queria ${num(
        exigido,
      )}. Entra com metade.`,
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
      ? `A ${odd(firme.price as number)} paga o que vale e nada mais. Não chega.`
      : `Justo a ${odd(firme.fairPrice)}, pagam ${odd(
          firme.price as number,
        )}. Não vale o preço.`;

  return feito(
    "passar",
    firme,
    `Damos ${pct(firme.ours)}, o mercado ${pct(
      firme.marketPct as number,
    )}. ${remate}`,
  );
}
