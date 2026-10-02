import { clears, type LegContext as Context } from "@/lib/betContext";

/**
 * What a leg is asking for, next to what usually happens.
 *
 * Three figures and no verdict dressed as advice: the price's demand is
 * arithmetic, the competition's rate is a count of games played, the record is
 * a count of bets settled. The colour says only whether the evidence clears the
 * price — green when what happens is at least what the odd needs, red when the
 * odd is asking for more than the games have ever given.
 */
export function LegContextRow({ context }: { context: Context }) {
  if (context.required === null) return null;
  if (!context.league && !context.own) return null;

  // Each rate is coloured against the price on its own, because each one
  // answers the same question by itself: does what happens cover what the odd
  // needs? When they disagree, the competition's hundreds of games are the
  // bigger count — and seeing them disagree is worth more than being told
  // which to believe.
  const tone = (pct: number) => {
    const verdict = clears(pct, context.required);
    return verdict === "acima"
      ? "text-[hsl(var(--sl-green))]"
      : verdict === "abaixo"
        ? "text-destructive"
        : "text-foreground";
  };

  return (
    <div className="mt-1.5 flex items-stretch gap-px overflow-hidden rounded-lg bg-border">
      <Cell
        label="a odd pede"
        value={`${context.required}%`}
        note="para pagar"
      />

      {context.league && (
        <Cell
          label="a liga dá"
          value={`${context.league.pct}%`}
          note={`${context.league.hits} de ${context.league.of}`}
          tone={tone(context.league.pct)}
        />
      )}

      {context.own && (
        <Cell
          label="tu acertas"
          value={`${context.own.pct}%`}
          note={`${context.own.hits} de ${context.own.of}`}
          tone={tone(context.own.pct)}
        />
      )}
    </div>
  );
}

function Cell({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 flex-1 bg-card px-2 py-1.5 text-center">
      <p className="sl-meta truncate text-[9px] uppercase tracking-[0.08em]">
        {label}
      </p>
      <p className={`sl-figure text-[14px] leading-tight ${tone ?? "text-foreground"}`}>
        {value}
      </p>
      <p className="sl-meta truncate text-[9px]">{note}</p>
    </div>
  );
}
