import { Link } from "react-router-dom";
import { ChevronRight, Flag } from "lucide-react";
import type { FinishedChallenge } from "@/lib/finishedChallenges";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function day(at: string | null): string {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/**
 * A challenge that is over, and what it did.
 *
 * Read off the bets rather than written down at the end: a figure stored at
 * the moment of ending would stop agreeing with the bets behind it the first
 * time one was corrected. Everything here is still one tap from the challenge
 * itself, which keeps its whole ladder and every bet.
 */
function Card({ entry }: { entry: FinishedChallenge }) {
  const me = entry.me;
  const grew = (me?.profit ?? entry.profit) >= 0;

  return (
    <Link
      to={`/desafios/${entry.plan.id}`}
      className="sl-card sl-tap block overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Flag className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {entry.plan.name}
          </p>
          <p className="sl-meta truncate text-[11px]">
            {entry.startedAt ? `${day(entry.startedAt)} → ` : ""}
            {day(entry.endedAt)}
            {entry.lasted ? ` · ${entry.lasted} dias` : ""}
          </p>
        </div>
        {entry.hitTarget && (
          <span className="sl-pill sl-pill-win flex-none text-[10px]">
            Alvo
          </span>
        )}
        <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
      </div>

      <div className="grid grid-cols-3 gap-px bg-border">
        {[
          {
            label: "Banca",
            value: eur.format(me?.bankroll ?? entry.bankroll),
          },
          {
            label: "Das apostas",
            value: `${grew ? "+" : ""}${eur.format(me?.profit ?? entry.profit)}`,
            tone: grew
              ? "text-[hsl(var(--sl-green))]"
              : "text-destructive",
          },
          { label: "Nível", value: `${entry.day} de ${entry.days}` },
        ].map((cell) => (
          <div
            key={cell.label}
            className="flex flex-col bg-card px-2 py-2.5 text-center"
          >
            <p className="sl-meta text-[10px] uppercase leading-tight tracking-[0.1em]">
              {cell.label}
            </p>
            <p
              className={`sl-figure mt-auto pt-1 text-[13px] ${
                cell.tone ?? "text-foreground"
              }`}
            >
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      <p className="sl-meta px-4 py-2.5 text-[11px] leading-5">
        {me && me.settled > 0 ? (
          <>
            {me.settled} {me.settled === 1 ? "aposta" : "apostas"} fechadas ·{" "}
            {me.greens} verdes, {me.reds} vermelhas
            {me.hitRate !== null ? ` · ${me.hitRate}%` : ""}
            {me.bestStreak > 1 ? ` · melhor série ${me.bestStreak}` : ""}
          </>
        ) : (
          "Terminou sem nenhuma aposta fechada."
        )}
        {entry.winner && (
          <>
            {" · "}
            <span className="font-semibold text-foreground">
              {entry.winner.name} ficou à frente
            </span>
          </>
        )}
      </p>
    </Link>
  );
}

export function FinishedChallenges({
  entries,
}: {
  entries: FinishedChallenge[];
}) {
  if (entries.length === 0) {
    return (
      <p className="sl-card px-4 py-4 text-[12px] leading-6 text-muted-foreground">
        Ainda não terminaste nenhum desafio. Quando terminares um, fica aqui
        com o que deu — e continua inteiro lá dentro, com todas as apostas.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <Card key={entry.plan.id} entry={entry} />
      ))}
    </div>
  );
}
