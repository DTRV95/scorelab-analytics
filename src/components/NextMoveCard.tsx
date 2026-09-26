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
    ring: "bg-gradient-to-br from-[hsl(22_100%_97%)] via-card to-card ring-primary/25",
    chip: "text-white [background:var(--sl-gradient)]",
    icon: ArrowRight,
  },
  "close-first": {
    ring: "bg-gradient-to-br from-amber-50 via-card to-card ring-amber-500/25",
    chip: "bg-amber-500 text-white",
    icon: Clock,
  },
  paused: {
    ring: "bg-gradient-to-br from-red-50 via-card to-card ring-destructive/25",
    chip: "bg-destructive text-white",
    icon: PauseCircle,
  },
  "waiting-start": {
    ring: "bg-card ring-border",
    chip: "bg-muted text-muted-foreground",
    icon: Clock,
  },
  finished: {
    ring: "bg-card ring-border",
    chip: "bg-muted text-muted-foreground",
    icon: Flag,
  },
  "target-hit": {
    ring: "bg-gradient-to-br from-emerald-50 via-card to-card ring-[hsl(var(--sl-green))]/30",
    chip: "bg-[hsl(var(--sl-green))] text-white",
    icon: Flag,
  },
  broke: {
    ring: "bg-gradient-to-br from-red-50 via-card to-card ring-destructive/25",
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
    <section
      className={`sl-card overflow-hidden px-4 py-4 ring-1 ${tone.ring}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          O que fazer agora
        </p>
        <span
          className={`sl-figure flex-none rounded-full px-3 py-1 text-[11px] ${tone.chip}`}
        >
          Dia {move.day}
        </span>
      </div>

      <p className="mt-2.5 flex items-start gap-2 text-[17px] font-bold leading-6 tracking-[-0.02em] text-foreground">
        <Icon className="mt-1 h-4 w-4 flex-none text-primary" />
        {move.action}
      </p>

      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{move.detail}</p>

      {/* The two numbers side by side are the whole point of tracking: the
          table's figure never moves, and the real one does, so the gap between
          them is the only honest measure of how it is going. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-[hsl(var(--sl-surface))] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Tens agora
          </p>
          <p className="sl-figure mt-0.5 text-[17px] text-foreground">
            {eur.format(bankroll)}
          </p>
        </div>
        <div className="rounded-2xl bg-[hsl(var(--sl-surface))] px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            O quadro diz
          </p>
          <p className="sl-figure mt-0.5 text-[17px] text-foreground">
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
          className="sl-btn-primary mt-3 h-12 w-full text-[15px]"
          onClick={onStart}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Inserir os jogos do dia {move.day}
        </Button>
      )}

      {move.state === "close-first" && (
        <Button
          variant="outline"
          className="sl-tap mt-3 h-12 w-full rounded-2xl border-amber-500/40 bg-card text-sm font-semibold text-amber-700"
          onClick={onClose}
        >
          Ver o dia por fechar
        </Button>
      )}

      {move.last && (
        <p
          className={`mt-3 flex items-start gap-1.5 border-t border-border/60 pt-2.5 text-[11px] leading-5 ${
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
