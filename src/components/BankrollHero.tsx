import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TrendChart } from "@/components/BankrollTrend";
import { useChanged } from "@/hooks/useChanged";
import type { PlanBet } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/**
 * How the money stands, at the top of the page.
 *
 * The first question anybody opens this app with. It was a line of small
 * print with two labels and two figures jammed into it, under a heading, over
 * a chart of the same money a screen further down — the figure, the chart and
 * the challenge count all saying the bankroll separately. One card: the
 * number, what the betting did to it, and the line it drew getting there.
 */
export function BankrollHero({
  bankroll,
  profit,
  startingBankroll,
  bets,
  challenges,
  finished = 0,
  openBets,
}: {
  bankroll: number;
  /** What the betting alone did, with money put in kept out of it. */
  profit: number;
  /** What this person started the running challenges with. */
  startingBankroll: number;
  /** Their bets, for the line. */
  bets: PlanBet[];
  /** Challenges still being played. */
  challenges: number;
  /** Challenges already given as finished, whose money is still money. */
  finished?: number;
  /** Bets placed and not yet settled, which this figure cannot include. */
  openBets: number;
}) {
  // A bet settled two pages away moves this; the figure says so once.
  const moved = useChanged(bankroll);
  const up = profit > 0;
  const down = profit < 0;
  // Against what was put in, not against the last reading: the percentage
  // somebody actually means by "quanto é que isto rendeu".
  const share =
    startingBankroll > 0 ? (profit / startingBankroll) * 100 : null;

  return (
    <section className="sl-card overflow-hidden">
      <Link
        to="/bankroll"
        className="sl-tap flex items-start gap-3 px-4 pb-1 pt-3.5"
      >
        <div className="min-w-0 flex-1">
          <p className="sl-meta text-[10px] uppercase tracking-[0.14em]">
            O teu saldo
          </p>
          <p
            className={`sl-figure sl-hero-figure mt-0.5 text-[1.9rem] leading-9 text-foreground ${
              moved ? "sl-figure-changed" : ""
            }`}
          >
            {eur.format(bankroll)}
          </p>
          <p className="sl-meta mt-0.5 text-[11px]">
            <span
              className={
                up
                  ? "font-semibold text-[hsl(var(--sl-green))]"
                  : down
                    ? "font-semibold text-destructive"
                    : ""
              }
            >
              {up ? "+" : ""}
              {eur.format(profit)}
              {share !== null && Math.abs(share) >= 1
                ? ` (${up ? "+" : ""}${share.toFixed(0)}%)`
                : ""}
            </span>{" "}
            das apostas
            {challenges > 0
              ? ` · ${challenges === 1 ? "1 desafio" : `${challenges} desafios`}`
              : ""}
            {finished > 0
              ? ` · ${finished === 1 ? "1 terminado" : `${finished} terminados`}`
              : ""}
            {openBets > 0
              ? ` · ${openBets === 1 ? "1 aposta aberta" : `${openBets} apostas abertas`}`
              : ""}
          </p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 flex-none text-muted-foreground" />
      </Link>

      {/* The same money over time, in the same card. Two cards about one
          bankroll is how a phone screen fills up without saying more. */}
      <TrendChart
        startingBankroll={startingBankroll}
        bets={bets}
        height={108}
      />
    </section>
  );
}
