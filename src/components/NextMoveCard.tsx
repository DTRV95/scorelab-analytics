import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Clock,
  Flag,
  PauseCircle,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

// The gap goes beside a figure that already carries the symbol, so it drops it.
const euroPlain = new Intl.NumberFormat("pt-PT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function NextMoveCard({
  move,
  bankroll,
  onStart,
  onClose,
}: {
  move: NextMove;
  bankroll: number;
  /** Starts the day's bet from here, so nobody has to scroll to find it. */
  onStart: () => void;
  /** Jumps to the day waiting to be closed. */
  onClose: () => void;
}) {
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

      {/* The two numbers side by side are the whole point of tracking: the
          table's figure never moves, and the real one does, so the gap between
          them is the only honest measure of how it is going. */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
          <p className="sl-meta text-[10px] uppercase tracking-[0.12em]">
            Tens agora
          </p>
          <p className="mt-0.5 font-mono-data text-sm font-bold text-foreground">
            {eur.format(bankroll)}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-card px-3 py-2">
          <p className="sl-meta text-[10px] uppercase tracking-[0.12em]">
            O quadro diz
          </p>
          <p className="mt-0.5 font-mono-data text-sm font-bold text-foreground">
            {eur.format(move.tableBankroll)}
            {Math.abs(move.versusTable) >= 0.01 && (
              <span
                className={`ml-1.5 text-[11px] font-semibold ${
                  move.versusTable > 0
                    ? "text-[hsl(var(--sl-green))]"
                    : "text-destructive"
                }`}
              >
                {move.versusTable > 0 ? "+" : "−"}
                {euroPlain.format(Math.abs(move.versusTable))}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* The instruction and the button that carries it out, together. On a
          phone the rest of the page is below the fold, and an instruction you
          have to go looking for is half an instruction. */}
      {move.state === "play" && (
        <Button
          className="sl-btn-primary mt-3 h-11 w-full text-sm"
          onClick={onStart}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Inserir os jogos do dia {move.day}
        </Button>
      )}

      {move.state === "close-first" && (
        <Button
          variant="outline"
          className="mt-3 h-11 w-full border-amber-500/40 text-sm font-semibold text-amber-700"
          onClick={onClose}
        >
          Ver o dia por fechar
        </Button>
      )}

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
