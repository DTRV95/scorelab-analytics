import { summarise } from "@/lib/betAnalytics";
import {
  buildCombinedStyle,
  legOutcome,
  MIN_DECIDED,
} from "@/lib/bettingStyle";
import type { PlanBet } from "@/lib/planStore";
import type { HomeChallenge } from "@/lib/homeBoard";

/**
 * What this person's own betting says, in sentences.
 *
 * The app has carried every one of these numbers for months, scattered over
 * four pages nobody opens: the hit rate on one, the markets on another, the
 * odds bands on a third. This reads them all and keeps the few that say
 * something, so the home page can answer "como é que isto está a correr?"
 * without anybody going looking.
 *
 * Nothing here is an opinion and nothing is padded: a finding with too little
 * behind it is left out rather than softened, which is why a new account sees
 * two lines and an old one sees five.
 */

export interface Insight {
  id: string;
  /** The finding, in one sentence. */
  text: string;
  /** The count or percentage it rests on, so it can be checked. */
  figure: string;
  tone: "good" | "bad" | "flat";
}

/** Below this, a hit rate is a coin landing a few times in a row. */
const MIN_SETTLED = 5;
/** Comparing two bet sizes needs both of them to have happened. */
const MIN_PER_SIZE = 4;
/** A competition needs this many decided games before it says anything. */
const MIN_PER_LEAGUE = 4;

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const pct = (value: number) => `${Math.round(value)}%`;

/** The run of same-result bets at the end of the record. */
export function currentStreak(bets: PlanBet[]): {
  kind: "green" | "red";
  length: number;
} | null {
  const settled = bets
    .filter((bet) => bet.status === "green" || bet.status === "red")
    .sort((a, b) => (a.settledAt ?? a.placedAt).localeCompare(b.settledAt ?? b.placedAt));

  if (settled.length === 0) return null;

  const kind = settled[settled.length - 1].status as "green" | "red";
  let length = 0;
  for (let index = settled.length - 1; index >= 0; index -= 1) {
    if (settled[index].status !== kind) break;
    length += 1;
  }

  return { kind, length };
}

/** How each competition has gone, counted leg by leg. */
function leagueRecord(bets: PlanBet[]) {
  const rows = new Map<string, { landed: number; decided: number }>();

  for (const bet of bets) {
    for (const leg of bet.legs) {
      // A game typed by hand carries no competition worth counting.
      if (!leg.league || leg.league === "Adicionado à mão") continue;
      const outcome = legOutcome(bet, leg);
      if (outcome === "unknown") continue;

      const row = rows.get(leg.league) ?? { landed: 0, decided: 0 };
      row.decided += 1;
      if (outcome === "landed") row.landed += 1;
      rows.set(leg.league, row);
    }
  }

  return [...rows.entries()]
    .map(([league, row]) => ({ league, ...row }))
    .filter((row) => row.decided >= MIN_PER_LEAGUE)
    .sort(
      (a, b) =>
        b.landed / b.decided - a.landed / a.decided || b.decided - a.decided,
    );
}

export function homeInsights({
  bets,
  challenges,
  label = (market) => market,
  limit = 5,
}: {
  /** This person's bets, across the challenges still running. */
  bets: PlanBet[];
  challenges: HomeChallenge[];
  /** Turns a stored market into the name people read. */
  label?: (market: string) => string;
  limit?: number;
}): Insight[] {
  const found: Insight[] = [];
  const record = summarise(bets);
  const style = buildCombinedStyle(bets);

  // What happened last, which is what somebody opening the app is still
  // thinking about.
  const streak = currentStreak(bets);
  if (streak && streak.length >= 2) {
    found.push({
      id: "streak",
      text:
        streak.kind === "green"
          ? "Vais numa série de níveis ganhos"
          : "Vais numa série de níveis perdidos",
      figure: `${streak.length} seguidos`,
      tone: streak.kind === "green" ? "good" : "bad",
    });
  }

  if (record.settled >= MIN_SETTLED && record.winPct !== null) {
    found.push({
      id: "rate",
      text: "Ganhas os níveis que fechas",
      figure: `${pct(record.winPct)} · ${record.won} de ${record.settled}`,
      tone: record.winPct >= 50 ? "good" : "flat",
    });

    // The number that turns a hit rate into a verdict. 68% looks healthy
    // until the prices behind it wanted 72%.
    if (record.breakEven !== null) {
      const clear = record.winPct - record.breakEven;
      found.push({
        id: "price",
        text:
          clear >= 0
            ? "Acertas mais do que as odds pedem"
            : "Acertas menos do que as odds pedem",
        figure: `pedem ${pct(record.breakEven)}`,
        tone: clear >= 0 ? "good" : "bad",
      });
    }
  }

  if (style.sharpest && style.sharpest.hitPct !== null) {
    found.push({
      id: "sharpest",
      text: `Acertas mais em ${label(style.sharpest.market)}`,
      figure: `${style.sharpest.landed} de ${
        style.sharpest.landed + style.sharpest.failed
      }`,
      tone: "good",
    });
  }

  if (
    style.weakest &&
    style.weakest.market !== style.sharpest?.market &&
    style.weakest.failed >= MIN_DECIDED
  ) {
    found.push({
      id: "weakest",
      text: `Falhas mais em ${label(style.weakest.market)}`,
      figure: `${style.weakest.landed} de ${
        style.weakest.landed + style.weakest.failed
      }`,
      tone: "bad",
    });
  }

  // Singles against multiples, which is the choice made on every slip.
  const sizes = style.sizes.filter(
    (size) => size.bets >= MIN_PER_SIZE && size.winPct !== null,
  );
  if (sizes.length >= 2) {
    const ranked = [...sizes].sort(
      (a, b) => (b.winPct ?? 0) - (a.winPct ?? 0),
    );
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    if ((best.winPct ?? 0) - (worst.winPct ?? 0) >= 15) {
      found.push({
        id: "size",
        text: `${best.label} saem-te melhor do que ${worst.label.toLowerCase()}`,
        figure: `${pct(best.winPct ?? 0)} contra ${pct(worst.winPct ?? 0)}`,
        tone: "flat",
      });
    }
  }

  const leagues = leagueRecord(bets);
  if (leagues.length > 0) {
    const best = leagues[0];
    found.push({
      id: "league",
      text: `Na ${best.league} entram-te mais jogos`,
      figure: `${best.landed} de ${best.decided}`,
      tone: "good",
    });
  }

  // The challenge closest to what it set out to do. Below a tenth of the way
  // there, the percentage is a rounding error dressed as progress — which is
  // most of the life of a ladder that multiplies.
  const nearest = challenges
    .map((entry) => ({
      entry,
      share: entry.standing.bankroll / Number(entry.plan.target),
    }))
    .filter((row) => row.share >= 0.1 && row.share < 1)
    .sort((a, b) => b.share - a.share)[0];

  if (nearest) {
    found.push({
      id: "target",
      text: `${nearest.entry.plan.name} está a caminho do objetivo`,
      figure: `faltam ${eur.format(
        Number(nearest.entry.plan.target) - nearest.entry.standing.bankroll,
      )}`,
      tone: "flat",
    });
  }

  return found.slice(0, limit);
}
