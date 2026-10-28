import { recordVerdict } from "@/lib/matchValue";
import { measuredPct } from "@/lib/shortlist";
import { losing, patternFor, type Patterns } from "@/lib/betPatterns";
import { canonicalMarket } from "@/lib/marketNames";
import { statusLabel } from "@/lib/absences";
import { noteOf } from "@/lib/matchNote";
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
 * 1. Fora de questão o mercado em que estamos muito acima das casas, e
 *    aquele onde o nosso registo é comprovadamente mau. Estar acima de
 *    milhares de pessoas com dinheiro em cima não é uma oportunidade, é
 *    um aviso.
 * 2. Do que sobra, a fasquia: três pontos de vantagem com histórico
 *    cheio, e até nove quando quase não há histórico.
 * 3. Quem a passa é aposta. Quem paga acima do justo mas não chega à
 *    fasquia é aposta pequena. Quem nem isso é o melhor que o jogo tem
 *    — nomeado na mesma, com a razão por que não lhe punha dinheiro.
 * 4. E diz-se também o que evitar, que é a pergunta que ninguém faz e
 *    que custa mais dinheiro do que a outra.
 *
 * "Muito acima" conta-se de duas maneiras, e basta uma. Em pontos, como
 * sempre se contou. E em vezes — um terço acima do número deles — que é
 * a que faltava, e por falta dela este motor passou meses a recomendar
 * azarões. As trinta primeiras sugestões que ficaram escritas dizem-no
 * sem margem: nas seis que mandaram apostar, a odd média era 5,53 e
 * cinco das seis eram azarões; nas nove que mandaram passar, odds de
 * 1,20 a 1,61, sete entraram. Doze pontos de discordância num mercado
 * de 70% é um desacordo de um sexto; os mesmos doze pontos num mercado
 * de 10% é dizer que as casas estão enganadas por mais do dobro — e era
 * esse que passava, porque em pontos parecia igual.
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
  /** Os golos que o modelo espera de cada lado, para a frase ter jogo. */
  goals?: { home: number; away: number; total: number } | null;
  /** O mercado que o quadro pôs à frente, que nem sempre é o escolhido. */
  headline?: string | null;
  /** Não há preço porque a fonte nos recusou, não porque o jogo não o tenha. */
  blocked?: boolean;
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
/** O mesmo, em vezes: um terço acima do número deles tira de questão. */
const VETO_RATIO = 1.35;
/** E um quinto acima já merece ser nomeado. */
const WARN_RATIO = 1.2;
/**
 * Abaixo de dois pontos não se conta em vezes.
 *
 * Num mercado de 3% um número de 4,5% é uma vez e meia o deles e não é
 * nada: é um ponto e meio, que é menos do que a casa de arredondamento
 * de qualquer um dos dois. Sem este chão, as vezes faziam armadilhas de
 * mercados que ninguém joga.
 */
const GAP_MIN = 2;
/** O histórico a partir do qual não se pede nada de especial. */
const SAMPLE_FULL = 70;
/** E o máximo que a falta dele chega a pedir, por mais curta que seja. */
const EXTRA_MAX = 6;

/**
 * Uma probabilidade como quem a diz em voz alta.
 *
 * "Damos 54%" é a linguagem de quem fez a conta, e esteve aqui durante
 * uns dias. "Damos-lhe 54 hipóteses em 100" é a mesma coisa dita a
 * quem vai pôr o dinheiro — e é esse que está a ler. Pelo mesmo
 * motivo saiu daqui tudo o que se contava em "pontos": a vantagem
 * sobre o preço justo é uma medida de quem faz o modelo, não de quem
 * aposta, e diz-se melhor comparando duas odds.
 */
const hip = (value: number) => `${Math.round(value)} hipóteses em 100`;

/** O mesmo número quando a frase já disse em quantas. */
const hips = (value: number) => String(Math.round(value));

/** Um preço com os dois cêntimos, que num preço são dinheiro. */
const odd = (value: number) => value.toFixed(2).replace(".", ",");

function fairOdd(pct: number): number {
  if (pct <= 0) return 0;
  return Math.ceil((100 / pct) * 100) / 100;
}

/** Uma coisa que me fez pedir mais do que o costume, e quanto. */
export interface Reason {
  /** De que família é, para não se dizer duas vezes no mesmo cartão. */
  key: "amostra" | "baixas" | "dinheiro";
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
      key: "amostra",
      what: `só temos ${Math.round(input.amostraPct)}% dos jogos passados que queríamos`,
      pp: Math.min(EXTRA_MAX, falta / 10),
    });
  }

  const fora = [
    { side: input.teams?.home, nome: input.teams?.home },
    { side: input.teams?.away, nome: input.teams?.away },
  ].filter((team) => missing(input.absences, team.side) >= SQUAD_HOLE);

  for (const team of fora) {
    because.push({
      key: "baixas",
      what: `o ${team.nome} leva ${missing(
        input.absences,
        team.side,
      )} jogadores de fora`,
      pp: 1,
    });
  }

  if (market) {
    const nosso = patternFor(market, input.patterns ?? null);
    if (nosso && losing(nosso)) {
      because.push({
        key: "dinheiro",
        what: "já perdemos dinheiro em apostas destas",
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

/**
 * A forma do jogo, tirada dos mercados simples.
 *
 * Em bruto, de propósito: serve para dizer se alguém é favorito, e
 * isso é uma leitura do jogo e não uma aposta. O desconto existe para
 * não se pagar de mais por uma probabilidade, não para descrever um
 * jogo a quem o vai ver.
 */
function chances(
  input: SuggestionInput,
): { home: number; away: number } | null {
  const of = (market: string) =>
    input.markets.find((entry) => entry.mercado === market)
      ?.probabilidade_pct ?? null;

  const home = of("Casa");
  const away = of("Fora");
  return home === null || away === null ? null : { home, away };
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

/**
 * Quantas vezes o nosso número é o das casas.
 *
 * Um é concordar. Dois é dizer que elas estão enganadas para o dobro —
 * e isso diz-se sobre um mercado de 10% com sete pontos de diferença,
 * que em pontos não dava nas vistas nenhumas.
 */
function excess(q: MarketQuote): number {
  if (q.marketPct === null || q.marketPct <= 0) return 1;
  if ((q.gap ?? 0) < GAP_MIN) return 1;
  return q.ours / q.marketPct;
}

/** Estamos acima das casas ao ponto de isto merecer ser nomeado. */
function risky(q: MarketQuote): boolean {
  return (q.gap ?? 0) >= GAP_WARN || excess(q) >= WARN_RATIO;
}

/**
 * Quanto do bolso é que isto merecia, pela regra de Kelly.
 *
 * Serve para ordenar e não para apostar — quem aposta é quem lê, e a
 * fracção que o cartão mostra é um quarto desta. Mas ordenar por ela
 * em vez de ordenar por pontos de vantagem muda tudo, e é a segunda
 * metade da correcção: entre um 4,00 que paga cinco pontos acima do
 * justo e um 1,95 que paga quatro, os pontos escolhem o 4,00 e o
 * dinheiro escolhe o outro. O que faz crescer uma banca não é ter
 * razão em pontos, é ter razão muitas vezes — e a mesma vantagem numa
 * odd alta vem com uma variância que come o que ela paga.
 */
function growth(q: MarketQuote): number {
  const price = q.price ?? 0;
  if (price <= 1) return -1;
  return ((q.ours / 100) * price - 1) / (price - 1);
}

export function suggest(input: SuggestionInput): Suggestion {
  const all = quotes(input);
  const name = input.label ?? ((market: string) => market);

  // O que evitar diz-se sempre que houver, mesmo quando há uma boa: é
  // nos mercados em que estamos muito acima do mercado que o dinheiro
  // desaparece, e são precisamente os que parecem melhores.
  const trap = all
    .filter((q) => q.gap !== null && risky(q))
    .sort((a, b) => excess(b) - excess(a) || (b.gap ?? 0) - (a.gap ?? 0))[0];

  const avoid = trap ?? null;
  const avoidBecause = avoid
    ? `Damos-lhe ${hip(avoid.ours)} e as casas dão ${hips(
        avoid.marketPct as number,
      )}. Quando a diferença é assim, quem costuma ter razão são elas.`
    : "";

  /**
   * A frase começa pelo que é próprio deste jogo.
   *
   * Sem isto, oito jogos davam oito frases com a mesma forma e números
   * diferentes — e uma carta-tipo deixa de se ler ao terceiro cartão.
   */
  const nota = (pick: MarketQuote | null) =>
    noteOf({
      teams: input.teams,
      goals: input.goals,
      chances: chances(input),
      headline: input.headline,
      absences: input.absences,
      pick: pick ? { market: pick.market, gap: pick.gap } : null,
      label: name,
    });

  /**
   * A mesma coisa não se diz duas vezes no mesmo cartão.
   *
   * Quando a observação já abriu com as baixas, repeti-las na linha da
   * exigência é dizer "o Chelsea leva 8 jogadores de fora" a seguir a
   * "8 fora no Chelsea". Elas continuam a contar para a fasquia — o
   * que sai é a repetição, não a razão.
   */

  const feito = (call: Call, pick: MarketQuote | null, because: string) => ({
    call,
    pick,
    required: pedido(pick?.market).points,
    raised: pedido(pick?.market).because.filter(
      (item) => item.key !== "baixas" || nota(pick).kind !== "baixas",
    ),
    // Quando a escolha é ela própria o mercado em que mais discordamos
    // das casas, o aviso não pode desaparecer só porque não cabe na
    // linha de baixo — era exactamente aí que ele fazia falta. Fica
    // dito na mesma frase: é aposta, e é aposta contra o mercado.
    because: [
      nota(pick).text,
      because,
      (call === "apostar" || call === "pequena") && pick && risky(pick)
        ? "E atenção: aqui estamos mais optimistas do que as casas, que é quando costumamos enganar-nos."
        : "",
    ]
      .filter(Boolean)
      .join(" "),
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
    // Em pontos e em vezes, e basta uma das duas. A primeira apanha o
    // mercado grande em que nos afastámos; a segunda apanha o pequeno,
    // onde o mesmo afastamento cabe em meia dúzia de pontos e passava.
    if ((q.gap ?? 0) >= GAP_VETO) return false;
    if (excess(q) >= VETO_RATIO) return false;
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
          ? "As fontes não concordam sobre qual é a equipa da casa, e sem isso não dá para confiar em quem ganha."
          : "Em todos os mercados deste jogo estamos mais optimistas do que as casas, ou já nos enganámos muito neles. Não arriscava nada aqui.",
    );
  }

  /** O mais provável, que é a que se escolhe quando não há preço a favor. */
  const maisProvavel = [...usable].sort((a, b) => b.ours - a.ours)[0];

  const priced = usable.filter((q) => q.price !== null && q.marketPct !== null);
  if (priced.length === 0) {
    return feito(
      "esperar",
      maisProvavel,
      input.blocked
        ? `Não consegui ir buscar o preço — a fonte recusou o pedido. Sem ele só sei que isto só vale a pena acima de ${odd(
            maisProvavel.fairPrice,
          )}.`
        : `As casas ainda não abriram este jogo. Quando abrirem, só vale a pena acima de ${odd(
            maisProvavel.fairPrice,
          )}.`,
    );
  }

  // Pelo que faz crescer a banca, e não pelos pontos de vantagem. Os
  // pontos põem sempre o azarão à frente: a mesma vantagem numa odd de
  // 5,00 e numa de 1,60 é o mesmo número e não é o mesmo dinheiro.
  const porCrescimento = [...priced].sort((a, b) => growth(b) - growth(a));
  const melhor = porCrescimento[0];
  const vantagem = melhor.edge ?? 0;
  const exigido = pedido(melhor.market).points;

  if (vantagem >= exigido) {
    return feito(
      "apostar",
      melhor,
      // Sem repetir o nome do mercado nem o preço, que estão em cima em
      // letra grande: o que falta aqui é porque é que isso é uma aposta.
      `Só compensava acima de ${odd(
        melhor.fairPrice,
      )} e estão a pagar mais do que isso.`,
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
      `Compensa, mas por pouco: se apostares, aposta menos do que o costume.`,
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
  const calmos = priced.filter((q) => !risky(q));
  const firme = porSegurança(calmos.length > 0 ? calmos : priced);

  // Pagar exactamente o que vale e pagar menos do que vale não são a
  // mesma recusa, e dizer "o preço come a vantagem" sobre uma odd que
  // está em cima do justo é dizer uma coisa falsa.
  const sobra = firme.edge ?? 0;
  const remate =
    sobra >= 0
      ? `A ${odd(
          firme.price as number,
        )} pagam exactamente o que isto vale, e não é por isso que eu arriscava.`
      : `Só compensava acima de ${odd(firme.fairPrice)} e pagam ${odd(
          firme.price as number,
        )} — menos do que vale.`;

  return feito(
    "passar",
    firme,
    remate,
  );
}
