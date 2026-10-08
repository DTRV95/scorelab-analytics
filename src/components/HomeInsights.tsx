import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import type { Insight } from "@/lib/homeInsights";

/**
 * What this person's own numbers say, on the page they open first.
 *
 * Every line is read off their own settled bets and shows the count it rests
 * on, so none of it has to be taken on trust. A finding with too little behind
 * it never gets here, which is why this card can be two lines long.
 */
export function HomeInsights({
  insights,
  settled,
}: {
  insights: Insight[];
  /** How many bets of theirs are decided, which is what all of this rests on. */
  settled: number;
}) {
  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-[13px] font-bold text-foreground">
          O que os teus números dizem
        </h2>
        {/* Análises is the long form of exactly these lines: the same bets,
            by market, by price, by day of the week. Apostas is where a bet
            outside a challenge gets registered, which is another job. */}
        <Link
          to="/dashboard/analises"
          className="sl-meta flex flex-none items-center gap-1 text-[11px]"
        >
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Nothing to say is said out loud.
          The card used to disappear, which from the outside is identical to
          the app having nothing to offer — and somebody who has just placed
          their first bets is exactly the person wondering whether this is
          worth using. */}
      {insights.length === 0 && (
        <p className="px-4 py-3 text-[12px] leading-5 text-muted-foreground">
          {settled === 0
            ? "Ainda não fechaste nenhuma aposta. Assim que fechares, começa a aparecer aqui o que o teu próprio registo diz."
            : `${settled === 1 ? "Uma aposta fechada" : `${settled} apostas fechadas`} ainda não chegam para dizer nada que se aguente. A partir de cinco começa.`}
        </p>
      )}

      <div className="divide-y divide-border">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <span
              className={`h-1.5 w-1.5 flex-none rounded-full ${
                insight.tone === "good"
                  ? "bg-[hsl(var(--sl-green))]"
                  : insight.tone === "bad"
                    ? "bg-destructive"
                    : "bg-muted-foreground/40"
              }`}
            />
            <p className="min-w-0 flex-1 text-[12.5px] leading-5 text-foreground">
              {insight.text}
            </p>
            <p
              className={`sl-figure flex-none text-[12px] ${
                insight.tone === "good"
                  ? "text-[hsl(var(--sl-green))]"
                  : insight.tone === "bad"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            >
              {insight.figure}
            </p>
          </div>
        ))}
      </div>

      {/* Where the numbers come from, because the money above this card is
          only the challenges still running and these are every bet ever
          made — including the ones in challenges already finished. */}
      {insights.length > 0 && (
        <p className="sl-meta border-t border-border px-4 py-2 text-[11px]">
          De {settled} apostas fechadas, em todos os teus desafios.
        </p>
      )}
    </section>
  );
}
