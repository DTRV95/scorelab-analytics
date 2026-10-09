import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Clock, PenLine, X } from "lucide-react";
import { marketFamily, pickLabel, slipKind } from "@/lib/betSlip";
import { isManualLeg, type PlanBet } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const TONE = {
  green: "text-[hsl(var(--sl-green))]",
  red: "text-destructive",
  pending: "text-amber-700",
} as const;

const ICON = { green: Check, red: X, pending: Clock } as const;

const PILL = {
  green: "sl-pill-win",
  red: "sl-pill-loss",
  pending: "sl-pill-open",
} as const;

const SAID = { green: "Ganhou", red: "Perdeu", pending: "Por decidir" } as const;

function when(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * One bet, as a slip.
 *
 * The registered bets were three lines of small print each, stacked inside a
 * single card with a hairline between them — which is exactly how a page of
 * separate bets comes to look like the legs of one big multiple. A slip has
 * edges of its own: what kind of bet it is and what it cost at the top, one
 * block per game in the middle, and what it pays at the bottom.
 */
export function BetSlip({
  bet,
  defaultOpen = true,
  /** A line above the kind — the level inside a challenge, whose bet it is. */
  above,
  /** Whatever this bet can be done to, under the money. */
  action,
}: {
  bet: PlanBet;
  defaultOpen?: boolean;
  above?: ReactNode;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const returned = bet.stake * bet.odds;
  const kind = slipKind(bet.legs.length);
  const names = bet.legs.map((leg) => leg.match).join(" · ");

  return (
    <article className="sl-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        className="sl-tap flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          {above && <p className="sl-meta text-[10.5px]">{above}</p>}
          <p className="flex items-baseline gap-2 text-[13.5px] font-bold text-foreground">
            {kind}
            <span className="sl-figure text-[13.5px] font-bold text-foreground">
              {eur.format(bet.stake)}
            </span>
          </p>
          {/* Closed, the card still has to say which bet it is: the day it
              was registered, and the games it was on. */}
          {!open && (
            <p className="sl-meta mt-0.5 truncate text-[11px]">
              {when(bet.placedAt)}
              {names ? ` · ${names}` : ""}
            </p>
          )}
        </div>

        <span className={`sl-pill flex-none text-[11px] ${PILL[bet.status]}`}>
          {SAID[bet.status]}
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <div className="divide-y divide-border border-t border-border">
            {bet.legs.map((leg, index) => {
              const Icon = ICON[leg.status];
              const pick = pickLabel(leg);
              // "Ambas Marcam" under "Ambas Marcam" says nothing twice.
              const family = marketFamily(leg.market);
              const kind =
                family.toLowerCase() === pick.toLowerCase() ? "" : family;

              return (
                <div
                  key={`${bet.id}-${leg.fixtureId ?? "m"}-${index}`}
                  className="flex items-start gap-2.5 px-4 py-3"
                >
                  <Icon
                    className={`mt-0.5 h-3.5 w-3.5 flex-none ${TONE[leg.status]}`}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-5 text-foreground">
                      {pick}
                    </p>
                    {kind && <p className="sl-meta text-[11px]">{kind}</p>}

                    {/* The two teams on two lines, as on the slip itself: a
                        game is between somebody and somebody, and "A vs B"
                        squeezed into one line is the first thing to be cut
                        off on a phone. */}
                    <p className="mt-1.5 text-[12px] leading-5 text-foreground">
                      {leg.homeTeam || leg.match}
                    </p>
                    {leg.awayTeam && (
                      <p className="text-[12px] leading-5 text-foreground">
                        {leg.awayTeam}
                      </p>
                    )}

                    {isManualLeg(leg) && (
                      <p className="sl-meta mt-1 flex items-center gap-1 text-[10px]">
                        <PenLine className="h-2.5 w-2.5" />
                        metido à mão
                      </p>
                    )}
                  </div>

                  <div className="flex flex-none flex-col items-end gap-1.5">
                    <span className="sl-figure text-[13.5px] text-foreground">
                      {leg.odds.toFixed(2)}
                    </span>
                    {leg.score && (
                      <span className="sl-pill sl-pill-muted text-[10px]">
                        Resultado {leg.score.homeGoals}-{leg.score.awayGoals}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <dl className="divide-y divide-border border-t border-border">
            <div className="flex items-baseline justify-between gap-2 px-4 py-2.5">
              <dt className="sl-meta text-[12px]">Montante apostado</dt>
              <dd className="sl-figure text-[13px] text-foreground">
                {eur.format(bet.stake)}
              </dd>
            </div>

            {bet.legs.length > 1 && (
              <div className="flex items-baseline justify-between gap-2 px-4 py-2.5">
                <dt className="sl-meta text-[12px]">Odd total</dt>
                <dd className="sl-figure text-[13px] text-foreground">
                  {bet.odds.toFixed(2)}
                </dd>
              </div>
            )}

            {/* What came back, gross, the way a slip says it. The profit is
                this minus the stake, and saying both would be the third
                number on a card that already has two. */}
            <div className="flex items-baseline justify-between gap-2 px-4 py-2.5">
              <dt className="text-[12.5px] font-semibold text-foreground">
                {bet.status === "pending" ? "Se entrar" : "Ganhos"}
              </dt>
              <dd className={`sl-figure text-[16px] ${TONE[bet.status]}`}>
                {bet.status === "red"
                  ? eur.format(0)
                  : eur.format(returned)}
              </dd>
            </div>
          </dl>

          <p className="sl-meta border-t border-border px-4 py-2 text-[10.5px]">
            Registada a {when(bet.placedAt)}
            {bet.settledAt ? ` · fechada a ${when(bet.settledAt)}` : ""}
          </p>

          {action}
        </>
      )}
    </article>
  );
}
