import { canonicalMarket } from "@/lib/marketNames";
import { supabase } from "@/lib/supabaseClient";
import type { PlanBetPayload } from "@/lib/planStore";

/**
 * O que as nossas próprias apostas têm em comum, cruzadas.
 *
 * Isto não é o registo do modelo, que mede previsões. É o registo do
 * dinheiro: cada perna de cada boletim fechado, com o preço a que foi
 * tomada e o que lhe aconteceu. São duas perguntas diferentes, e o
 * modelo pode estar certo num mercado onde nós perdemos dinheiro — basta
 * pagarem-nos mal por ele.
 *
 * Foram cruzados os cortes óbvios primeiro, em 125 pernas fechadas com
 * 76,8% de acerto, e nenhum separa coisa nenhuma:
 *
 *     veio do quadro     57 pernas   77,2%
 *     escrito à mão      68 pernas   76,5%
 *     odd abaixo de 1,25 31 pernas   83,9%   (margem ±15)
 *     odd de 1,75 acima  14 pernas   85,7%   (margem ±23)
 *     boletim simples     8 pernas   87,5%
 *     boletim duplo      68 pernas   73,5%
 *
 * Nem a origem, nem o preço, nem o tamanho do boletim. Quem ganha e quem
 * perde não se distingue por nada disso, e dizer o contrário com estes
 * números era inventar.
 *
 * O que distingue é **o preço que se paga pelo risco que se corre**, e
 * isso só aparece quando se põe o acerto de cada família ao lado da odd
 * que ela recebeu:
 *
 *     vencedor simples   18 pernas   88,9%   pagam 1,40   precisa 1,13
 *     combinado          27 pernas   70,4%   pagam 1,56   precisa 1,42
 *     mais de X golos    14 pernas   78,6%   pagam 1,39   precisa 1,27
 *     dupla hipótese     37 pernas   83,8%   pagam 1,27   precisa 1,19
 *     ambas marcam       13 pernas   69,2%   pagam 1,53   precisa 1,44
 *     menos de X golos   16 pernas   62,5%   pagam 1,27   precisa 1,60
 *
 * Cinco famílias pagam. Uma não: em "menos de X golos" perdem-se vinte e
 * um cêntimos por cada euro, porque entram seis em cada dez e o preço
 * está cotado para entrarem oito.
 *
 * Nada disto manda em nada. Dezasseis pernas dão uma margem de vinte
 * pontos, e o desvio cabe lá dentro — é "reparámos", não é "está
 * provado", e a diferença entre as duas coisas é a diferença entre isto
 * e uma procura. O que lhe dá peso é não vir sozinho: o registo do
 * próprio quadro, medido noutros jogos e noutra altura, diz o mesmo
 * (golos e ambas a 53,8%, dupla hipótese a 87,5%).
 */

/** Uma perna fechada: o que se apostou, a que preço, e o que deu. */
export interface SettledLeg {
  market: string;
  odds: number;
  won: boolean;
}

export type Family =
  | "dupla hipótese"
  | "vencedor simples"
  | "mais de X golos"
  | "menos de X golos"
  | "ambas marcam"
  | "combinado";

export interface Pattern {
  key: string;
  n: number;
  hits: number;
  /** Quantas entraram, em percentagem. */
  rate: number;
  /** A odd média a que foram tomadas. */
  paid: number;
  /** A odd que esse acerto obrigaria, para não se perder dinheiro. */
  needed: number;
  /** O que cada euro apostado nesta família devolveu, menos o próprio euro. */
  perEuro: number;
  /** Dois sigmas do acerto, que é o que separa um padrão de um acaso. */
  margin: number;
}

export interface Patterns {
  /** Todas as pernas fechadas juntas, que é a régua de tudo o resto. */
  base: Pattern;
  families: Pattern[];
  markets: Pattern[];
}

/**
 * Abaixo disto nem se olha.
 *
 * Dez pernas dão uma margem de vinte e seis pontos: qualquer coisa que
 * se veja ali dentro é ruído com nome.
 */
export const MIN_LEGS = 10;

/**
 * A família de um mercado, que é o corte onde há jogos que cheguem.
 *
 * Por mercado seriam quarenta e cinco grupos de duas ou três pernas,
 * onde não há nada para medir. Por família são seis, e são seis coisas
 * diferentes de fazer: não perder, ganhar, haver golos, não haver,
 * marcarem os dois, e duas coisas ao mesmo tempo.
 */
export function familyOf(market: string): Family {
  const name = canonicalMarket(market);

  if (/\se\s/i.test(name)) return "combinado";
  if (/^(1X|2X|12)$/i.test(name)) return "dupla hipótese";
  if (/^(Ambas Marcam|BTTS No)$/i.test(name)) return "ambas marcam";

  // O canónico devolve tal e qual o que não soube ler, e sabe ler
  // "mais de 1.5 golos" mas não "mais 1.5 golos" — que é como uma das
  // pernas está escrita. Uma linha de golos sem o "de" continua a ser
  // uma linha de golos, e mandá-la para "vencedor simples" estragava os
  // dois grupos de uma vez.
  if (/^(mais|acima|over|\+)/i.test(name)) return "mais de X golos";
  if (/^(menos|abaixo|under|-)/i.test(name)) return "menos de X golos";
  return "vencedor simples";
}

function measure(key: string, legs: SettledLeg[]): Pattern {
  const n = legs.length;
  const hits = legs.filter((leg) => leg.won).length;
  const rate = (hits / n) * 100;
  const paid = legs.reduce((sum, leg) => sum + leg.odds, 0) / n;
  // O retorno é sobre a odd que se pagou mesmo, não sobre a média: uma
  // família onde as que entram são as baratas e as que falham são as
  // caras perde dinheiro com um acerto que parece bom.
  const back = legs.reduce((sum, leg) => sum + (leg.won ? leg.odds : 0), 0) / n;

  return {
    key,
    n,
    hits,
    rate,
    paid,
    needed: rate > 0 ? Math.ceil((100 / rate) * 100) / 100 : 0,
    perEuro: back - 1,
    margin: 200 * Math.sqrt(((rate / 100) * (1 - rate / 100)) / n),
  };
}

function group(legs: SettledLeg[], by: (leg: SettledLeg) => string): Pattern[] {
  const buckets = new Map<string, SettledLeg[]>();
  for (const leg of legs) {
    const key = by(leg);
    buckets.set(key, [...(buckets.get(key) ?? []), leg]);
  }

  return [...buckets.entries()]
    .map(([key, found]) => measure(key, found))
    .filter((row) => row.n >= MIN_LEGS)
    .sort((a, b) => a.perEuro - b.perEuro);
}

export function readPatterns(legs: SettledLeg[]): Patterns | null {
  const usable = legs.filter(
    (leg) => Number.isFinite(leg.odds) && leg.odds > 1,
  );
  if (usable.length < MIN_LEGS) return null;

  return {
    base: measure("tudo", usable),
    families: group(usable, (leg) => familyOf(leg.market)),
    markets: group(usable, (leg) => canonicalMarket(leg.market)),
  };
}

/**
 * O que o preço pago diz que esta família devia entrar.
 *
 * É esta a régua, e não o acerto das outras famílias. Uma dupla
 * hipótese a 1,27 tem de entrar 79% das vezes e um "ambas marcam" a
 * 1,56 só precisa de 64%: pôr os dois acertos lado a lado e chamar pior
 * ao segundo é comparar duas coisas que nunca foram a mesma. A primeira
 * versão disto fazia exactamente isso.
 */
export function implied(row: Pattern): number {
  return row.paid > 1 ? 100 / row.paid : 0;
}

/**
 * Reparámos: esta família devolveu menos do que levou.
 *
 * É uma frase sobre o passado e nada mais. Dezasseis pernas não provam
 * nada sobre as próximas dezasseis, e por isso isto não trava nem
 * desconta coisa nenhuma — aparece escrito ao lado da sugestão, para
 * quem decide saber o que já aconteceu ali.
 */
export function losing(row: Pattern): boolean {
  return row.n >= MIN_LEGS && row.perEuro < 0;
}

/**
 * Está provado: o acerto ficou fora da margem do que o preço pedia.
 *
 * Nenhuma família nossa chega aqui hoje, e isso é a resposta honesta —
 * a que mais perde fica a dezasseis pontos do que o preço pedia, com
 * uma margem de vinte e quatro. Encontrar um padrão é fácil; o difícil
 * é esperar que ele sobreviva à margem dele próprio.
 */
export function proven(row: Pattern): boolean {
  return losing(row) && Math.abs(row.rate - implied(row)) > row.margin;
}

/** O que dizer de um mercado, quando a família dele tem alguma coisa a dizer. */
export function patternFor(
  market: string,
  patterns: Patterns | null,
): Pattern | null {
  if (!patterns) return null;
  const family = familyOf(market);
  return patterns.families.find((row) => row.key === family) ?? null;
}

/**
 * Todas as pernas fechadas que esta conta consegue ver.
 *
 * Sem filtro por jogador, de propósito. São dois a jogar o mesmo
 * desafio com as mesmas regras, e trinta pernas de cada um não medem
 * nada — sessenta medem alguma coisa. O que se procura aqui também não
 * é quem joga melhor: é que mercados é que pagam o risco que têm.
 */
export async function fetchSettledLegs(): Promise<SettledLeg[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("plan_bets")
    .select("payload");
  if (error || !data) return [];

  const out: SettledLeg[] = [];
  for (const row of data as { payload: PlanBetPayload }[]) {
    for (const leg of row.payload?.legs ?? []) {
      // Uma perna por fechar não diz nada, e "void" não é nem uma
      // coisa nem outra: fica de fora das duas contas.
      if (leg.status !== "green" && leg.status !== "red") continue;
      out.push({
        market: leg.market,
        odds: Number(leg.odds),
        won: leg.status === "green",
      });
    }
  }
  return out;
}
