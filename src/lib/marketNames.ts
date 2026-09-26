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
  fora: "Fora",
  "vitoria fora": "Fora",
  "2": "Fora",
  empate: "Empate",
  x: "Empate",
  "1x": "1X",
  "x1": "1X",
  "casa ou empate": "1X",
  "2x": "2X",
  x2: "2X",
  "fora ou empate": "2X",
  "12": "12",
  btts: "Ambas Marcam",
  "btts yes": "Ambas Marcam",
  "btts sim": "Ambas Marcam",
  "ambas marcam": "Ambas Marcam",
  "ambas marcam - sim": "Ambas Marcam",
  "ambas marcam sim": "Ambas Marcam",
  "ambas equipas marcam": "Ambas Marcam",
  "btts no": "BTTS No",
  "btts nao": "BTTS No",
  "ambas marcam - nao": "BTTS No",
  "ambas marcam nao": "BTTS No",
  "ambas nao marcam": "BTTS No",
};

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

  return raw.trim().replace(/\s+/g, " ");
}
