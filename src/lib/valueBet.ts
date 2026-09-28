/**
 * Is this bet worth making at the price offered?
 *
 * Every number on the slip until now says what happens *if* it lands. None of
 * them say whether it is worth backing at all, which is the only question that
 * decides whether a season of betting ends up or down. An odd of 1.85 is the
 * bookmaker saying "this happens 54% of the time". Backing it is only sensible
 * if you think it happens more often than that.
 *
 * Nothing here blocks anything. It puts the comparison on screen, and the
 * person decides.
 */

/** The chance the price itself implies, before anybody's opinion of the game. */
export function impliedPct(odds: number): number | null {
  if (!Number.isFinite(odds) || odds <= 1) return null;
  return Number((100 / odds).toFixed(1));
}

/**
 * The model's chance minus the price's, in percentage points.
 *
 * Positive is the only reason to bet: it says the game lands more often than
 * the price is paying for. Null means there is no forecast to compare — a
 * game typed by hand carries none, and inventing one would be worse than
 * admitting it.
 */
export function edgePoints(modelPct: number, odds: number): number | null {
  const implied = impliedPct(odds);
  if (implied === null || !modelPct) return null;
  return Number((modelPct - implied).toFixed(1));
}

/**
 * What a euro staked is worth on average, at this price and this forecast.
 *
 * 1.06 means six cents of profit per euro over the long run; 0.92 means eight
 * cents lost. This is the number that compounds, for good or bad.
 */
export function expectedReturn(modelPct: number, odds: number): number | null {
  if (!Number.isFinite(odds) || odds <= 1 || !modelPct) return null;
  return Number(((modelPct / 100) * odds).toFixed(3));
}

export interface SlipValue {
  /** The model's chance of the whole slip landing. */
  modelPct: number;
  /** The chance the combined price implies. */
  impliedPct: number;
  edge: number;
  expectedReturn: number;
}

/**
 * The same question asked of the whole slip.
 *
 * Multiplying games multiplies their prices — and their edges with them. Two
 * legs each paying a little less than they should is not a small problem
 * twice: it is the product, which is why a slip of three thin games is so
 * much worse than any one of them looks.
 *
 * Null when any game has no forecast: one unknown makes the product unknown,
 * and a number built on a zero would read as "no chance" rather than "no
 * idea".
 */
export function slipValue(
  legs: { modelProb: number; odds: number }[]
): SlipValue | null {
  if (legs.length === 0) return null;
  if (legs.some((leg) => !leg.modelProb || !(leg.odds > 1))) return null;

  const modelChance = legs.reduce((product, leg) => product * (leg.modelProb / 100), 1);
  const price = legs.reduce((product, leg) => product * leg.odds, 1);
  const modelPct = Number((modelChance * 100).toFixed(1));
  const implied = Number((100 / price).toFixed(1));

  return {
    modelPct,
    impliedPct: implied,
    edge: Number((modelPct - implied).toFixed(1)),
    expectedReturn: Number((modelChance * price).toFixed(3)),
  };
}

/** One line for the slip, in the words somebody would actually use. */
export function describeValue(value: SlipValue): string {
  // Kept to a decimal: rounding 7.5 cents to a whole number lands on 7 or 8
  // depending on which way the float fell, and the half is the interesting
  // part when the whole thing is a couple of cents either way.
  const cents = (Math.abs(value.expectedReturn - 1) * 100)
    .toFixed(1)
    .replace(".0", "")
    .replace(".", ",");

  if (value.edge > 0) {
    return `O modelo dá ${value.modelPct}% e a odd só paga ${value.impliedPct}%. Cada euro apostado vale ${cents} cêntimos a mais.`;
  }
  if (value.edge < 0) {
    return `A odd paga ${value.impliedPct}% e o modelo só dá ${value.modelPct}%. Cada euro apostado perde ${cents} cêntimos a longo prazo.`;
  }
  return `O modelo e a odd dizem o mesmo: ${value.modelPct}%. Não há vantagem nenhuma de nenhum dos lados.`;
}
