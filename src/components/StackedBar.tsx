export type BarTone = "good" | "bad" | "none";

export interface BarSegment {
  tone: BarTone;
  value: number;
  label: string;
}

const FILL: Record<BarTone, string> = {
  good: "var(--sl-chart-good)",
  bad: "var(--sl-chart-bad)",
  none: "var(--sl-chart-none)",
};

/**
 * Hatching on the losing segment.
 *
 * Green against red is the one pair colour blindness cannot be made to
 * separate — the best-scoring pair still lands under the threshold — so the
 * two are told apart by texture and by the printed count as well as by hue.
 */
const TEXTURE =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.34) 0 3px, transparent 3px 7px)";

/**
 * One thin stacked bar, with a 2px gap of the surface between segments and
 * rounded ends. Values of zero take no width at all rather than a sliver.
 */
export function StackedBar({
  segments,
  height = 12,
}: {
  segments: BarSegment[];
  height?: number;
}) {
  const shown = segments.filter((segment) => segment.value > 0);
  const total = shown.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) {
    return (
      <div
        className="w-full rounded-full bg-[hsl(var(--sl-surface))]"
        style={{ height }}
      />
    );
  }

  return (
    <div className="flex w-full gap-[2px]" style={{ height }}>
      {shown.map((segment, index) => (
        <div
          key={segment.tone}
          role="presentation"
          title={`${segment.label}: ${segment.value}`}
          style={{
            width: `${(segment.value / total) * 100}%`,
            background:
              segment.tone === "bad"
                ? `${TEXTURE}, ${FILL[segment.tone]}`
                : FILL[segment.tone],
            borderTopLeftRadius: index === 0 ? 999 : 2,
            borderBottomLeftRadius: index === 0 ? 999 : 2,
            borderTopRightRadius: index === shown.length - 1 ? 999 : 2,
            borderBottomRightRadius: index === shown.length - 1 ? 999 : 2,
          }}
        />
      ))}
    </div>
  );
}

/** The key. Present whenever a bar carries more than one state. */
export function BarLegend({ items }: { items: { tone: BarTone; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <span
          key={item.tone}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background:
                item.tone === "bad"
                  ? `${TEXTURE}, ${FILL[item.tone]}`
                  : FILL[item.tone],
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
