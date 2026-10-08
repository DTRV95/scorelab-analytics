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
export function HomeInsights({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-[13px] font-bold text-foreground">
          O que os teus números dizem
        </h2>
        <Link
          to="/apostas"
          className="sl-meta flex flex-none items-center gap-1 text-[11px]"
        >
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

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
    </section>
  );
}
