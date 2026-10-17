import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TrendChart } from "@/components/BankrollTrend";
import { useChanged } from "@/hooks/useChanged";
import { useCountUp } from "@/hooks/useCountUp";
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
/** Degraus de corpo para o saldo, conforme o que lá cabe. */
function figureSize(value: string): string {
  if (value.length > 13) return "text-[clamp(1.5rem,7.5vw,2.1rem)]";
  if (value.length > 10) return "text-[clamp(1.85rem,9.5vw,2.6rem)]";
  return "text-[clamp(2.3rem,12vw,3.1rem)]";
}

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
  // A bet settled two pages away moves this; the figure says so once — e
  // anda até ao valor novo em vez de aparecer lá, que é a diferença entre
  // ver o dinheiro mexer e dar com ele mexido.
  const moved = useChanged(bankroll);
  const counting = useCountUp(bankroll);
  const up = profit > 0;
  const down = profit < 0;
  // Against what was put in, not against the last reading: the percentage
  // somebody actually means by "quanto é que isto rendeu".
  const share =
    startingBankroll > 0 ? (profit / startingBankroll) * 100 : null;
  const saldo = eur.format(counting);

  return (
    <section className="sl-raised overflow-hidden">
      <Link
        to="/bankroll"
        className="sl-tap flex items-start gap-3 px-4 pb-1 pt-3.5"
      >
        <div className="min-w-0 flex-1">
          <p className="sl-meta text-[10px] uppercase tracking-[0.14em]">
            O teu saldo
          </p>
          {/* O número da aplicação, lido de braço esticado — mas um Plano
              Milhão chega a "1 000 000,00 €", que a esse corpo não cabe
              num telemóvel. Por isso o tamanho desce por degraus com o
              comprimento do que lá está, em vez de cortar ou transbordar. */}
          <p
            className={`sl-figure sl-hero-figure mt-1 leading-[0.92] text-foreground ${figureSize(
              saldo,
            )} ${moved ? "sl-figure-changed" : ""}`}
          >
            {saldo}
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
