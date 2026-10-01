import { useMemo } from "react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import {
  canonicalMarket,
  COMMON_MARKETS,
  MARKET_GROUPS,
  shortMarket,
} from "@/lib/marketNames";

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

function Chip({
  market,
  on,
  onClick,
}: {
  market: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      // Shortened for the eye, never for the ear: "Sim" read out on its own,
      // away from the heading above it, is not a market.
      aria-label={MARKET_LABELS[market] ?? market}
      onClick={onClick}
      className={`sl-tap flex-none rounded-full px-2.5 py-1.5 text-[11px] font-semibold ${
        on
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground ring-1 ring-border"
      }`}
    >
      {shortMarket(market)}
    </button>
  );
}

/**
 * Which market a leg is on, chosen rather than spelled.
 *
 * Every market on every bet so far was typed into a blank box, and it shows:
 * "V1" and "Casa" for the same bet, "AM" and "Ambas Marcam", two spellings of
 * "X2 e +1,5 golos". Counting those apart is what kept the analysis from ever
 * reaching the three decided days it needs before it says anything.
 *
 * In families rather than one row of fourteen: the heading carries the half of
 * each name the chips would otherwise repeat, so "Golos · +2.5" fits where
 * "Mais de 2.5 Golos" did not.
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
  // Anything they have written before that has no button of its own. Their own
  // wording is worth a chip: it is the one they will reach for again.
  const theirs = useMemo(() => {
    const known = new Set(COMMON_MARKETS);
    const seen = new Set<string>();

    return used
      .map(canonicalMarket)
      .filter((market) => {
        if (!market || known.has(market) || seen.has(market)) return false;
        seen.add(market);
        return true;
      })
      .slice(0, 4);
  }, [used]);

  // What is in the box, read the way the analysis will read it, so a market
  // typed as "V1" lights up the "Casa" button it will be counted as.
  const chosen = canonicalMarket(value);

  const groups = useMemo(
    () =>
      theirs.length > 0
        ? [...MARKET_GROUPS, { title: "Teus", markets: theirs }]
        : MARKET_GROUPS,
    [theirs],
  );

  return (
    <div className="space-y-2">
      <p className="sl-meta text-[10px] uppercase tracking-[0.12em]">{label}</p>

      <div className="space-y-1.5">
        {groups.map((group) => (
          <div key={group.title} className="flex items-center gap-2">
            {/* Not uppercase: "RESULTADO" with letter-spacing did not fit the
                column at any width worth giving it, and a heading cut short is
                worse than a heading that is simply quiet. */}
            <span className="sl-meta w-[72px] flex-none truncate text-[11px]">
              {group.title}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {group.markets.map((market) => (
                <Chip
                  key={market}
                  market={market}
                  on={chosen === market}
                  onClick={() => onChange(chosen === market ? "" : market)}
                />
              ))}
            </div>
          </div>
        ))}
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
