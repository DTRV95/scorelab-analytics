import { useId, useMemo } from "react";
import { canonicalMarket, COMMON_MARKETS } from "@/lib/marketNames";

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

/**
 * Which market a leg is on.
 *
 * There was a row of buttons here for every market worth one, grouped into
 * families. It was asked for and then asked to go: a wall of names above a
 * form somebody is filling in reads as a quiz, and the thing it was solving —
 * "V1" and "Casa" counting as two markets — is solved at read time by the
 * normaliser, not by the buttons. Taking them out costs the analysis nothing.
 *
 * What is left is the box, and a list of names it has seen before that stays
 * out of the way until somebody starts typing, exactly like the teams.
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
  const listId = useId();

  const suggestions = useMemo(() => {
    const seen = new Set<string>();

    return [...used, ...COMMON_MARKETS].map(canonicalMarket).filter((market) => {
      if (!market || seen.has(market)) return false;
      seen.add(market);
      return true;
    });
  }, [used]);

  return (
    <div className="space-y-1">
      <p className="sl-meta text-[10px] uppercase tracking-[0.12em]">{label}</p>

      <datalist id={listId}>
        {suggestions.map((market) => (
          <option key={market} value={market} />
        ))}
      </datalist>

      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ex: Casa, Mais de 2.5 Golos, X2 e +1.5"
        aria-label={describedAs ?? label}
        className={field}
      />
    </div>
  );
}
