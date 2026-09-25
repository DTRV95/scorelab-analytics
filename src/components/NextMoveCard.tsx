import { ArrowDown, ArrowRight, ArrowUp, Clock, Flag, PauseCircle } from "lucide-react";
import type { NextMove } from "@/lib/challengeGuidance";

const TONE: Record<
  NextMove["state"],
  { ring: string; chip: string; icon: typeof ArrowRight }
> = {
  play: {
    ring: "border-primary/40 bg-gradient-to-br from-primary/10 to-transparent",
    chip: "bg-primary text-white",
    icon: ArrowRight,
  },
  "close-first": {
    ring: "border-amber-500/40 bg-amber-500/5",
    chip: "bg-amber-500 text-white",
    icon: Clock,
  },
  paused: {
    ring: "border-destructive/40 bg-destructive/5",
    chip: "bg-destructive text-white",
    icon: PauseCircle,
  },
  "waiting-start": {
    ring: "border-border bg-[hsl(var(--sl-surface))]",
    chip: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  finished: {
    ring: "border-border bg-[hsl(var(--sl-surface))]",
    chip: "bg-muted text-muted-foreground",
    icon: Flag,
  },
  "target-hit": {
    ring: "border-[hsl(var(--sl-green))]/40 bg-[hsl(var(--sl-green))]/5",
    chip: "bg-[hsl(var(--sl-green))] text-white",
    icon: Flag,
  },
  broke: {
    ring: "border-destructive/40 bg-destructive/5",
    chip: "bg-destructive text-white",
    icon: Flag,
  },
};

/**
 * The one instruction the page exists to give.
 *
 * Everything on it is derived: the day comes off the ladder, the stake off the
 * day and the money actually there, the odd off the challenge's own plan. It
 * sits at the top because a person opening this tab has exactly one question.
 */
export function NextMoveCard({ move }: { move: NextMove }) {
  const tone = TONE[move.state];
  const Icon = tone.icon;
  const movedUp = move.last?.includes("Avanças");
  const movedDown = move.last?.includes("Recuas");

  return (
    <section className={`rounded-xl border px-4 py-3.5 ${tone.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
          O que fazer agora
        </p>
        <span
          className={`flex-none rounded-full px-2.5 py-1 font-mono-data text-[11px] font-bold ${tone.chip}`}
        >
          Dia {move.day}
        </span>
      </div>

      <p className="mt-2 flex items-start gap-2 text-[15px] font-bold leading-6 text-foreground">
        <Icon className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
        {move.action}
      </p>

      <p className="mt-1.5 text-xs leading-6 text-muted-foreground">{move.detail}</p>

      {move.last && (
        <p
          className={`mt-2 flex items-start gap-1.5 border-t border-border/70 pt-2 text-[11px] leading-5 ${
            movedDown ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {movedUp && (
            <ArrowUp className="mt-0.5 h-3 w-3 flex-none text-[hsl(var(--sl-green))]" />
          )}
          {movedDown && <ArrowDown className="mt-0.5 h-3 w-3 flex-none" />}
          {move.last}
        </p>
      )}
    </section>
  );
}
