import type { PlanBet } from "@/lib/planStore";

export interface TrendPoint {
  /** Which settled day this is, counting from the first. */
  step: number;
  /** When it was decided, for the tooltip. */
  at: string;
  /** The bankroll after this day, across every challenge at once. */
  bankroll: number;
  /** What this day alone did. */
  change: number;
}

/**
 * The bankroll after every day that was decided, oldest first.
 *
 * Built from the bets themselves rather than stored, so it can never drift
 * from them. Money put into the bankroll is deliberately left out: this is the
 * line the betting drew, and a deposit would show as a jump that was never won.
 *
 * Days still open are not on it. A bet not yet decided has not changed
 * anything, and drawing it would put the money somewhere it has not been.
 */
export function bankrollTrend(
  startingBankroll: number,
  bets: PlanBet[]
): TrendPoint[] {
  const settled = bets
    .filter((bet) => bet.status !== "pending" && bet.settledAt)
    .sort((a, b) => (a.settledAt ?? "").localeCompare(b.settledAt ?? ""));

  let running = startingBankroll;

  return settled.map((bet, index) => {
    running = Number((running + bet.profitLoss).toFixed(2));
    return {
      step: index + 1,
      at: bet.settledAt ?? "",
      bankroll: running,
      change: Number(bet.profitLoss.toFixed(2)),
    };
  });
}

/** The best and the worst the bankroll has been, for an honest y-axis. */
export function trendRange(points: TrendPoint[], start: number) {
  const values = [start, ...points.map((point) => point.bankroll)];
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A flat line drawn edge to edge reads as a cliff. Pad it so a quiet week
  // looks quiet.
  const pad = Math.max((high - low) * 0.15, 1);
  return { low: Math.max(0, low - pad), high: high + pad };
}
