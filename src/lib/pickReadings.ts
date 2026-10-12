import type { BoardMatch } from "@/lib/probabilityBoardCache";
import { SHORTLIST_MARKETS, SHORTLIST_MIN_PCT } from "@/lib/shortlist";

/**
 * O que o registo do próprio quadro diz sobre uma escolha, antes de ser feita.
 *
 * Tudo aqui saiu de 82 jogos previstos e marcados entre 29/09 e 12/10/2026,
 * cada um previsto outra vez a partir da liga como estava antes do apito.
 * Nenhum destes números é uma opinião e nenhum deles é uma garantia: são
 * duas semanas, e vão por isso sempre acompanhados do tamanho da amostra.
 *
 * São três leituras, e respondem a perguntas diferentes:
 *
 *   o mercado — o modelo sabe dizer que uma equipa não perde (70%) e não
 *               sabe dizer quantos golos haverá (47%);
 *   a força   — o número só quer dizer alguma coisa a partir dos 70, e
 *               entre 65 e 69 o quadro entrou menos vezes (47%) do que
 *               abaixo de 65 (56%);
 *   o jogo    — entre equipas desniveladas acertou 80%, entre equipas
 *               equilibradas 47%. É a leitura sobre o jogo, não sobre o
 *               mercado, e é a que explica as outras duas.
 */

/** Quando os números abaixo foram medidos, e sobre quantos jogos. */
export const MEASURED_ON = 82;

export type Tone = "forte" | "neutro" | "fraco";

export interface PickReading {
  /** "mercado", "força" ou "jogo" — a pergunta a que responde. */
  about: "mercado" | "força" | "jogo";
  tone: Tone;
  text: string;
  /** Quantos jogos marcados estão por trás desta leitura. */
  games: number;
}

/** O desequilíbrio entre as duas equipas, em golos esperados. */
export function mismatch(match: Pick<BoardMatch, "lambda_casa" | "lambda_fora">): number {
  const home = Number(match.lambda_casa);
  const away = Number(match.lambda_fora);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return Number.NaN;
  return Math.abs(home - away);
}

function marketReading(market: string): PickReading {
  if (SHORTLIST_MARKETS.includes(market)) {
    return {
      about: "mercado",
      tone: "forte",
      text: "Dupla hipótese — o que uma época de resultados mede mesmo: 70% em 57 jogos",
      games: 57,
    };
  }

  if (
    /golos/i.test(market) ||
    /ambas/i.test(market) ||
    market === "BTTS No"
  ) {
    return {
      about: "mercado",
      tone: "fraco",
      text: "Golos ou ambas marcam — o quadro entrou 47% em 32 jogos, uma moeda ao ar",
      games: 32,
    };
  }

  return {
    about: "mercado",
    tone: "neutro",
    text: "Resultado seco — poucos jogos marcados para dizer alguma coisa",
    games: 2,
  };
}

function strengthReading(pct: number): PickReading {
  if (pct >= SHORTLIST_MIN_PCT) {
    return {
      about: "força",
      tone: "forte",
      text: `Acima de ${SHORTLIST_MIN_PCT}% — daqui para cima o quadro entrou 83% em 29 jogos`,
      games: 29,
    };
  }

  if (pct >= 65) {
    return {
      about: "força",
      tone: "fraco",
      text: "Entre 65% e 69% — a pior banda de todas: 47% em 17 jogos",
      games: 17,
    };
  }

  return {
    about: "força",
    tone: "neutro",
    text: "Abaixo de 65% — o número ainda não diz nada: 56% em 45 jogos",
    games: 45,
  };
}

function gameReading(gap: number): PickReading | null {
  if (!Number.isFinite(gap)) return null;

  if (gap >= 0.8) {
    return {
      about: "jogo",
      tone: "forte",
      text: "Equipas muito desniveladas — o quadro entrou 80% nestes, em 15 jogos",
      games: 15,
    };
  }

  if (gap >= 0.4) {
    return {
      about: "jogo",
      tone: "neutro",
      text: "Desnível médio entre as equipas — 72% em 29 jogos",
      games: 29,
    };
  }

  return {
    about: "jogo",
    tone: "fraco",
    text: "Equipas equilibradas — é onde o modelo menos sabe: 47% em 38 jogos",
    games: 38,
  };
}

export interface PickVerdict {
  /** Forte quando o mercado e a força concordam, que é a lista curta. */
  verdict: Tone;
  readings: PickReading[];
}

export function readPick(
  match: Pick<
    BoardMatch,
    "headline_market" | "headline_pct" | "lambda_casa" | "lambda_fora"
  >,
): PickVerdict {
  const readings: PickReading[] = [
    marketReading(match.headline_market),
    strengthReading(match.headline_pct),
  ];

  const game = gameReading(mismatch(match));
  if (game) readings.push(game);

  // Forte exige as duas leituras que se mediram juntas — é a lista curta,
  // 88% em 25 jogos. Qualquer leitura fraca puxa o resto para baixo, porque
  // foi assim que elas se mediram: o mercado dos golos a 47% não deixa de o
  // ser por o número estar alto.
  const weak = readings.some((reading) => reading.tone === "fraco");
  const strong =
    readings[0].tone === "forte" && readings[1].tone === "forte" && !weak;

  return { verdict: strong ? "forte" : weak ? "fraco" : "neutro", readings };
}

export const VERDICT_LABEL: Record<Tone, string> = {
  forte: "Boa escolha",
  neutro: "Escolha razoável",
  fraco: "Escolha fraca",
};
