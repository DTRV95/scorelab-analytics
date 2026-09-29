import { Crown, Info } from "lucide-react";
import {
  aheadOn,
  duel,
  MIN_SETTLED,
  type PlayerTally,
} from "@/lib/headToHead";
import type { PlayerStanding } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

interface Row {
  label: string;
  hint?: string;
  read: (entry: PlayerTally) => number | null;
  show: (entry: PlayerTally) => string;
}

const ROWS: Row[] = [
  {
    label: "Lucro das apostas",
    hint: "só o que as apostas deram, sem o dinheiro metido na banca",
    read: (entry) => entry.profit,
    show: (entry) => `${entry.profit >= 0 ? "+" : ""}${eur.format(entry.profit)}`,
  },
  {
    label: "Por cada euro apostado",
    hint: "quem aposta melhor, não quem aposta mais",
    read: (entry) => entry.roi,
    show: (entry) =>
      entry.roi === null ? "—" : `${entry.roi > 0 ? "+" : ""}${entry.roi}%`,
  },
  {
    label: "Dias ganhos",
    read: (entry) => entry.greens,
    show: (entry) => `${entry.greens} de ${entry.settled}`,
  },
  {
    label: "Acertos",
    read: (entry) => entry.hitRate,
    show: (entry) => (entry.hitRate === null ? "—" : `${entry.hitRate}%`),
  },
  {
    label: "Melhor sequência",
    read: (entry) => entry.bestStreak,
    show: (entry) =>
      entry.bestStreak === 1 ? "1 dia" : `${entry.bestStreak} dias`,
  },
  {
    label: "Melhor odd acertada",
    read: (entry) => entry.bestOdds,
    show: (entry) => (entry.bestOdds === null ? "—" : entry.bestOdds.toFixed(2)),
  },
  {
    label: "Dia da escada",
    read: (entry) => entry.day,
    show: (entry) => `Dia ${entry.day}`,
  },
];

/**
 * The two of them, measure by measure.
 *
 * The page already shows each player's own numbers; what it never did was put
 * them against each other, which is the only reason two brothers run the same
 * ladder at the same time. Profit leads the card because it is what anybody
 * actually argues about, and profit per euro sits right under it because
 * staking more is not the same as betting better.
 */
export function HeadToHead({ standings }: { standings: PlayerStanding[] }) {
  if (standings.length < 2) return null;

  const { tallies, leader, margin, early } = duel(standings);

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3.5">
        <h2 className="text-sm font-bold text-foreground">Frente a frente</h2>
        {leader && !early && (
          <span className="sl-pill sl-pill-win flex flex-none items-center gap-1">
            <Crown className="h-3 w-3" />
            {leader.name} +{eur.format(margin)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-2 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        <span />
        {tallies.map((entry) => (
          <span key={entry.userId} className="text-right font-semibold">
            {entry.name}
          </span>
        ))}
      </div>

      <div className="divide-y divide-border">
        {ROWS.map((row) => {
          const winner = aheadOn(tallies, row.read);

          return (
            <div
              key={row.label}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-foreground">
                  {row.label}
                </p>
                {row.hint && (
                  <p className="sl-meta text-[10px] leading-4">{row.hint}</p>
                )}
              </div>

              {tallies.map((entry) => {
                const leads = winner === entry.userId;
                return (
                  <span
                    key={entry.userId}
                    className={`sl-figure min-w-[60px] text-right text-[13px] ${
                      leads
                        ? "font-bold text-[hsl(var(--sl-green))]"
                        : "text-muted-foreground"
                    }`}
                  >
                    {row.show(entry)}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Two settled days can put somebody ahead on every row at once. The
          numbers are still each person's own record and worth seeing; what
          they are not yet is an answer. */}
      {early && (
        <p className="sl-meta flex items-start gap-1.5 border-t border-border px-4 py-2.5 text-[11px] leading-5">
          <Info className="mt-0.5 h-3 w-3 flex-none" />
          Ainda são poucos dias fechados para isto dizer quem aposta melhor —
          são precisos pelo menos {MIN_SETTLED} de cada um. Até lá é o
          histórico, não um veredicto.
        </p>
      )}
    </section>
  );
}
