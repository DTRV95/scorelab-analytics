import { useMemo } from "react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { canonicalMarket, COMMON_MARKETS } from "@/lib/marketNames";

const LIMIT = 14;

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

/**
 * Which market a leg is on, chosen rather than spelled.
 *
 * Every market on every bet so far was typed into a blank box, and it shows:
 * "V1" and "Casa" for the same bet, "AM" and "Ambas Marcam", two spellings of
 * "X2 e +1,5 golos". Counting those apart is what kept the analysis from ever
 * reaching the three decided days it needs before it says anything.
 *
 * What was used before comes first, because what somebody bets this week is
 * mostly what they bet last week.
 */
export function MarketField({
  value,
  onChange,
  used = [],
  label = "A tua aposta",
  describedAs,
}: {
  value: string;
  onChange: (market: string) => void;
  /** Markets already written on these slips, most used first. */
  used?: string[];
  label?: string;
  /** What to call this field for a screen reader, when there are several. */
  describedAs?: string;
}) {
  const options = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];

    for (const raw of [...used, ...COMMON_MARKETS]) {
      const market = canonicalMarket(raw);
      if (!market || seen.has(market)) continue;
      seen.add(market);
      out.push(market);
      if (out.length >= LIMIT) break;
    }

    return out;
  }, [used]);

  // What is in the box, read the way the analysis will read it, so a market
  // typed as "V1" lights up the "Vitória Casa" button it will be counted as.
  const chosen = canonicalMarket(value);

  return (
    <div className="space-y-2">
      <p className="sl-meta text-[10px] uppercase tracking-[0.12em]">{label}</p>

      <div className="flex flex-wrap gap-1.5">
        {options.map((market) => {
          const on = chosen === market;
          return (
            <button
              key={market}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? "" : market)}
              className={`sl-tap rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
                on
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground ring-1 ring-border"
              }`}
            >
              {MARKET_LABELS[market] ?? market}
            </button>
          );
        })}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Outro mercado, à tua maneira"
        aria-label={describedAs ?? label}
        className={field}
      />
    </div>
  );
}
