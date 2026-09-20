type Tone = "emerald" | "cyan" | "amber" | "red";

// The accent is a thin top rule and a dot. The animated wireframe cube this
// used to draw was built for a dark HUD; on a white card it rendered as a
// grey smudge behind the figure it was supposed to decorate.
const toneMap: Record<Tone, { dot: string; rule: string; value: string }> = {
  emerald: {
    dot: "bg-emerald-600",
    rule: "bg-emerald-600",
    value: "text-emerald-700",
  },
  cyan: {
    dot: "bg-primary",
    rule: "bg-primary",
    value: "text-foreground",
  },
  amber: {
    dot: "bg-amber-600",
    rule: "bg-amber-600",
    value: "text-amber-700",
  },
  red: {
    dot: "bg-red-600",
    rule: "bg-red-600",
    value: "text-red-700",
  },
};

export function SystemPulse3D({
  label,
  value,
  detail,
  tone = "emerald",
  size = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
  size?: "default" | "compact";
}) {
  const palette = toneMap[tone];
  const isCompact = size === "compact";

  return (
    <div className={`sl-card h-full ${isCompact ? "p-3" : "p-4"}`}>
      <div className={`h-1 w-8 rounded-full ${palette.rule}`} />
      <div className="mt-3 flex items-center gap-2">
        <span className={`h-2 w-2 flex-none rounded-full ${palette.dot}`} />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p
        className={`mt-2 font-mono-data font-bold tracking-[-0.03em] ${palette.value} ${
          isCompact ? "text-xl" : "text-2xl"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}
