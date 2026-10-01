/**
 * The same bet, written five ways.
 *
 * A game typed by hand carries whatever the person wrote on the slip: "-3.5",
 * "-3,5 Golos", "Menos de 3.5". Counting those as three different markets is
 * what turns an analysis into noise, so they are folded together at read time.
 * Nothing is rewritten in the database — what somebody typed is what they
 * typed, and the record of it stays as it is.
 */

const GOALS_WORDS = /^(golos|gols|goals|gol)$/;

/** "1,5" and "1.5" are the same number; accents and case are not signal. */
function plain(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/,(\d)/g, ".$1")
    .replace(/\s+/g, " ")
    .trim();
}

function goalsLine(sign: "-" | "+", line: string): string {
  const value = Number(line);
  const label = Number.isInteger(value) ? `${value}.5` : line;
  return sign === "-" ? `Menos de ${label} Golos` : `Mais de ${label} Golos`;
}

const EXACT: Record<string, string> = {
  casa: "Casa",
  "vitoria casa": "Casa",
  "casa para vencer": "Casa",
  "1": "Casa",
  // The shorthand both players actually write on their slips.
  v1: "Casa",
  fora: "Fora",
  "vitoria fora": "Fora",
  "2": "Fora",
  v2: "Fora",
  empate: "Empate",
  x: "Empate",
  vx: "Empate",
  "1x": "1X",
  "x1": "1X",
  "casa ou empate": "1X",
  // Written with "e" by people who mean "either": caught here so the rule for
  // genuine combinations below never sees it and reads it as both at once.
  "casa e empate": "1X",
  "2x": "2X",
  x2: "2X",
  "fora ou empate": "2X",
  "fora e empate": "2X",
  "12": "12",
  btts: "Ambas Marcam",
  "btts yes": "Ambas Marcam",
  "btts sim": "Ambas Marcam",
  "ambas marcam": "Ambas Marcam",
  "ambas marcam - sim": "Ambas Marcam",
  "ambas marcam sim": "Ambas Marcam",
  "ambas equipas marcam": "Ambas Marcam",
  am: "Ambas Marcam",
  "am - sim": "Ambas Marcam",
  "am sim": "Ambas Marcam",
  "btts no": "BTTS No",
  "btts nao": "BTTS No",
  "ambas marcam - nao": "BTTS No",
  "ambas marcam nao": "BTTS No",
  "ambas nao marcam": "BTTS No",
  "am - nao": "BTTS No",
  "am nao": "BTTS No",
};

/**
 * Which half of a combination a market is, and the order the halves go in.
 *
 * The model names its own combinations result-first — "2X e Mais de 1.5 Golos"
 * — so folding to that order is what makes a hand-typed "+1,5 e X2" land on
 * the very market the model already has a forecast for.
 */
const RANK: Record<string, number> = {
  Casa: 0,
  Empate: 0,
  Fora: 0,
  "1X": 0,
  "2X": 0,
  "12": 0,
  "Ambas Marcam": 2,
  "BTTS No": 2,
};

function rankOf(label: string): number {
  // Anything left is a goals line, which sits between the result and BTTS.
  return RANK[label] ?? 1;
}

/** One market, recognised — or null, which is how a combination knows to stop. */
function fold(text: string): string | null {
  const exact = EXACT[text];
  if (exact) return exact;

  // "menos de 2.5", "under 2.5 golos", "mais de 1.5"
  const worded = text.match(
    /^(menos de|abaixo de|under|mais de|acima de|over)\s+(\d+(?:\.\d+)?)(\s+(?:golos|gols|goals))?$/
  );
  if (worded) {
    const under = /menos|abaixo|under/.test(worded[1]);
    return goalsLine(under ? "-" : "+", worded[2]);
  }

  // "-4.5 golos", "+2.5", "-3.5"
  const signed = text.match(/^([-+])\s*(\d+(?:\.\d+)?)(?:\s+(\S+))?$/);
  if (signed && (!signed[3] || GOALS_WORDS.test(signed[3]))) {
    return goalsLine(signed[1] as "-" | "+", signed[2]);
  }

  return null;
}

/**
 * Two markets on one leg: "X2 e +1,5 golos", "V1 e AM - Não".
 *
 * Only when every half is recognised. Half a fold is worse than none — a
 * market this cannot read in full is handed back exactly as written, because
 * "Casa e escanteios acima" tidied into something else would be a different
 * bet from the one somebody placed.
 */
function foldCombination(text: string): string | null {
  const parts = text.split(/\s+e\s+/).filter((part) => part.length > 0);
  if (parts.length < 2) return null;

  const folded = parts.map(fold);
  if (folded.some((part) => part === null)) return null;

  return (folded as string[])
    .slice()
    .sort((a, b) => rankOf(a) - rankOf(b))
    .join(" e ");
}

/**
 * The markets worth a button, in families.
 *
 * Fourteen chips in one wrapped blob is a wall to read on a phone. The same
 * fourteen under four headings is four short rows, and the heading carries the
 * half of each name that would otherwise be repeated on every chip: under
 * "Golos", "+2.5" says everything "Mais de 2.5 Golos" says.
 *
 * The headings are short on purpose: they sit in a fixed column beside the
 * chips, and "Ambas marcam" wrapped that column onto two lines while
 * "Combinados" simply ran out over the first chip.
 */
export interface MarketGroup {
  title: string;
  markets: string[];
}

export const MARKET_GROUPS: MarketGroup[] = [
  { title: "Resultado", markets: ["Casa", "Empate", "Fora", "1X", "2X"] },
  {
    title: "Golos",
    markets: [
      "Mais de 1.5 Golos",
      "Mais de 2.5 Golos",
      "Menos de 2.5 Golos",
      "Menos de 3.5 Golos",
    ],
  },
  { title: "Ambas", markets: ["Ambas Marcam", "BTTS No"] },
  {
    title: "Combos",
    markets: ["1X e Mais de 1.5 Golos", "2X e Mais de 1.5 Golos"],
  },
];

/** Every market with a button, flat, for anything that only needs the set. */
export const COMMON_MARKETS = MARKET_GROUPS.flatMap((group) => group.markets);

/**
 * What a chip says once its heading has said the rest.
 *
 * Only inside a group: on its own a bare "+2.5" is a riddle, which is why
 * everywhere else keeps the full name.
 */
const SHORT: Record<string, string> = {
  "Mais de 1.5 Golos": "+1.5",
  "Mais de 2.5 Golos": "+2.5",
  "Menos de 2.5 Golos": "−2.5",
  "Menos de 3.5 Golos": "−3.5",
  "Ambas Marcam": "Sim",
  "BTTS No": "Não",
  "1X e Mais de 1.5 Golos": "1X e +1.5",
  "2X e Mais de 1.5 Golos": "2X e +1.5",
};

export function shortMarket(market: string): string {
  return SHORT[market] ?? market;
}

/**
 * The market a leg was really on.
 *
 * A bare "-3.5" is a goals line: a handicap always names the team it applies
 * to ("Suíça +0.5"), so a sign and a number with no team beside them cannot be
 * one. Anything this cannot recognise — a team name, a handicap, a wording
 * nobody anticipated — is handed back with its spacing tidied and nothing
 * else changed, because guessing would be worse than leaving it alone.
 */
export function canonicalMarket(raw: string): string {
  const text = plain(raw);
  if (!text) return raw.trim();

  return fold(text) ?? foldCombination(text) ?? raw.trim().replace(/\s+/g, " ");
}
