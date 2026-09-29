import { MIN_DECIDED, type PlayerStyle } from "@/lib/bettingStyle";
import { canonicalMarket } from "@/lib/marketNames";

export interface BetTip {
  id: string;
  tone: "good" | "bad" | "neutral";
  text: string;
}

/** Below this, the whole record is too thin to say anything from. */
const MIN_HISTORY = MIN_DECIDED;

/** Enough bets at one size before its record is worth repeating. */
const MIN_AT_SIZE = 3;

const GOOD = 60;
const BAD = 40;

function toneFor(hitPct: number): BetTip["tone"] {
  if (hitPct >= GOOD) return "good";
  if (hitPct <= BAD) return "bad";
  return "neutral";
}

function landed(count: number): string {
  return count === 1 ? "entrou 1" : `entraram ${count}`;
}

/**
 * What this person's own record says about the bet they are building.
 *
 * The app already knew all of this — which markets they hit, how their
 * doubles and trebles go — and only ever said it on a page nobody opens while
 * deciding. This is the same numbers, at the one moment they could change
 * something.
 *
 * It is a record, never a forecast. Nothing here says a market will land; it
 * says how the ones already backed went, and stays quiet until there are
 * enough of them to be worth the words.
 */
export function betTips(
  style: PlayerStyle,
  slip: { market: string }[],
  /** How the market is written everywhere else on screen. */
  label: (market: string) => string = (market) => market
): BetTip[] {
  const decided = style.markets.reduce(
    (total, row) => total + row.landed + row.failed,
    0
  );
  if (decided < MIN_HISTORY || slip.length === 0) return [];

  const tips: BetTip[] = [];
  const seen = new Set<string>();

  for (const leg of slip) {
    const market = canonicalMarket(leg.market);
    if (seen.has(market)) continue;
    seen.add(market);

    const row = style.markets.find((entry) => entry.market === market);

    if (!row || row.backed === 0) {
      tips.push({
        id: `new:${market}`,
        tone: "neutral",
        text: `${label(market)}: é a primeira vez que apostas nisto.`,
      });
      continue;
    }

    const settled = row.landed + row.failed;
    if (settled < MIN_DECIDED || row.hitPct === null) continue;

    tips.push({
      id: `market:${market}`,
      tone: toneFor(row.hitPct),
      text: `${label(market)}: ${landed(row.landed)} de ${settled} que fizeste.`,
    });
  }

  // How this many games at once has gone, which is the decision nobody thinks
  // of as a decision.
  const bucket = style.sizes.find((row) =>
    row.legs === 4 ? slip.length >= 4 : row.legs === slip.length
  );
  if (bucket && bucket.won + bucket.lost >= MIN_AT_SIZE && bucket.winPct !== null) {
    tips.push({
      id: `size:${bucket.legs}`,
      tone: toneFor(bucket.winPct),
      text: `Boletins de ${bucket.label}: ganhaste ${bucket.won} de ${
        bucket.won + bucket.lost
      }.`,
    });
  }

  // Worst news first: it is the only part anybody can still act on.
  const rank = { bad: 0, neutral: 1, good: 2 } as const;
  return tips.sort((a, b) => rank[a.tone] - rank[b.tone]).slice(0, 3);
}
