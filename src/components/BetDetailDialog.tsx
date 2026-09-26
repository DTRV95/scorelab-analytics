import { useEffect, useState } from "react";
import { Check, Clock, PenLine, Pencil, RotateCcw, X } from "lucide-react";
import { BetEditor } from "@/components/BetEditor";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canonicalMarket } from "@/lib/marketNames";
import { isManualLeg, type PlanBet, type PlanLeg } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

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

const LEG_TONE = {
  green: "text-[hsl(var(--sl-green))]",
  red: "text-destructive",
  pending: "text-muted-foreground",
} as const;

/**
 * One bet, opened in full.
 *
 * The list can only fit "3 jogos @ 1.95", which is exactly the part that does
 * not settle an argument about what somebody actually backed. Both players can
 * read each other's, which is the point of playing it together.
 */
export function BetDetailDialog({
  bet,
  player,
  mine,
  marking,
  saving,
  onMarkLeg,
  onMarkRest,
  onSaveEdits,
  onDelete,
  onResettle,
  onReopen,
  onClose,
}: {
  bet: PlanBet | null;
  player: string;
  /** Only the person who placed it gets to say how its games went. */
  mine: boolean;
  /** Index of the leg being saved, so its buttons can wait. */
  marking: number | null;
  /** A correction is on its way to the server. */
  saving: boolean;
  onMarkLeg: (bet: PlanBet, index: number, status: "green" | "red") => void;
  /** Settles every game still open in one go, for the usual case. */
  onMarkRest: (bet: PlanBet, status: "green" | "red") => void;
  onSaveEdits: (bet: PlanBet, legs: PlanLeg[], stake: number) => void;
  onDelete: (bet: PlanBet) => void;
  /** A day closed the wrong way round. */
  onResettle: (bet: PlanBet, won: boolean) => void;
  /** A day that should never have been closed at all. */
  onReopen: (bet: PlanBet) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);

  // A different bet opened in the same dialog starts from its own numbers,
  // never in the middle of correcting the last one.
  useEffect(() => setEditing(false), [bet?.id]);

  if (!bet) return null;

  const won = bet.status === "green";
  const undecided = bet.legs.filter((leg) => leg.status === "pending").length;
  const lost = bet.status === "red";
  const returned = bet.stake * bet.odds;

  return (
    <Dialog open={Boolean(bet)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-primary/15 font-mono-data text-[11px] font-bold text-primary">
              {bet.day}
            </span>
            Dia {bet.day} · {player}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
          {[
            { label: "Apostou", value: eur.format(bet.stake) },
            { label: "Odd", value: bet.odds.toFixed(2) },
            {
              label: won ? "Ganhou" : lost ? "Perdeu" : "Podia ganhar",
              value: won
                ? `+${eur.format(bet.profitLoss)}`
                : lost
                  ? eur.format(bet.profitLoss)
                  : eur.format(returned - bet.stake),
            },
          ].map((cell) => (
            <div key={cell.label} className="bg-card px-3 py-2.5">
              <p className="sl-meta text-[10px] uppercase tracking-[0.1em]">
                {cell.label}
              </p>
              <p
                className={`mt-0.5 font-mono-data text-sm font-bold ${
                  cell.label === "Ganhou"
                    ? "text-[hsl(var(--sl-green))]"
                    : cell.label === "Perdeu"
                      ? "text-destructive"
                      : "text-foreground"
                }`}
              >
                {cell.value}
              </p>
            </div>
          ))}
        </div>

        {editing && (
          <BetEditor
            bet={bet}
            saving={saving}
            onSave={(legs, stake) => onSaveEdits(bet, legs, stake)}
            onDelete={() => onDelete(bet)}
            onCancel={() => setEditing(false)}
          />
        )}

        <div className={`divide-y divide-border ${editing ? "hidden" : ""}`}>
          {bet.legs.map((leg, index) => {
            const Icon =
              leg.status === "green" ? Check : leg.status === "red" ? X : Clock;
            const undecided = leg.status === "pending";

            return (
              <div key={`${leg.fixtureId ?? "m"}-${index}`} className="px-4 py-3">
                <div className="flex items-start gap-2.5">
                <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${LEG_TONE[leg.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">
                    {leg.homeTeam} vs {leg.awayTeam}
                  </p>
                  <p className="sl-meta text-[11px] leading-5">
                    {MARKET_LABELS[leg.market] ?? canonicalMarket(leg.market)}
                    {leg.league ? ` · ${leg.league}` : ""}
                  </p>
                  {isManualLeg(leg) ? (
                    <p className="sl-meta flex items-center gap-1 text-[10px]">
                      <PenLine className="h-2.5 w-2.5" />
                      metido à mão, sem previsão do modelo
                    </p>
                  ) : (
                    <p className="sl-meta text-[10px]">
                      o modelo dava {leg.modelProb.toFixed(0)}%
                    </p>
                  )}
                </div>
                <span className="sl-figure flex-none text-sm text-foreground">
                  {leg.odds.toFixed(2)}
                </span>
                </div>

                {/* A day marked lost by hand says the day went down, not which
                    game took it. With every game typed by hand, this is the
                    only thing that ever fills that in. */}
                {mine && undecided && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={marking === index}
                      onClick={() => onMarkLeg(bet, index, "green")}
                      className="sl-tap flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[hsl(var(--sl-green))] ring-1 ring-[hsl(var(--sl-green))]/40 disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Entrou
                    </button>
                    <button
                      type="button"
                      disabled={marking === index}
                      onClick={() => onMarkLeg(bet, index, "red")}
                      className="sl-tap flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-destructive ring-1 ring-destructive/40 disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                      Falhou
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {mine && !editing && undecided > 0 && (
          <div className="space-y-2 border-t border-border bg-amber-500/8 px-4 py-3">
            <p className="text-[11px] leading-5 text-amber-700">
              {undecided === 1 ? "Falta 1 jogo" : `Faltam ${undecided} jogos`} por
              dizer como correram. Sem isso, a análise não sabe em que mercados
              acertas.
            </p>

            {/* The usual case, in one tap. A day lost with every game down is
                far more common than one lost by a single leg, and making
                somebody mark three games one by one is how the data stays
                empty. */}
            {bet.status === "red" && undecided > 1 && (
              <button
                type="button"
                disabled={marking !== null}
                onClick={() => onMarkRest(bet, "red")}
                className="sl-tap h-9 w-full rounded-xl bg-destructive/10 text-xs font-semibold text-destructive disabled:opacity-40"
              >
                Falharam todos
              </button>
            )}
            {bet.status === "green" && undecided > 1 && (
              <button
                type="button"
                disabled={marking !== null}
                onClick={() => onMarkRest(bet, "green")}
                className="sl-tap h-9 w-full rounded-xl bg-[hsl(var(--sl-green))]/10 text-xs font-semibold text-[hsl(var(--sl-green))] disabled:opacity-40"
              >
                Entraram todos
              </button>
            )}
          </div>
        )}

        {/* Everything on a slip is typed on a phone, in a hurry, often after
            the game has started. Without this the only way out of a wrong odd
            was to live with it: nothing here could be changed once saved. */}
        {mine && !editing && (
          <div className="space-y-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="sl-tap flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-foreground ring-1 ring-border"
            >
              <Pencil className="h-3.5 w-3.5" />
              Corrigir esta aposta
            </button>

            {bet.status !== "pending" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onResettle(bet, !won)}
                  className={`sl-tap h-10 flex-1 rounded-xl text-xs font-semibold ring-1 disabled:opacity-40 ${
                    won
                      ? "text-destructive ring-destructive/40"
                      : "text-[hsl(var(--sl-green))] ring-[hsl(var(--sl-green))]/40"
                  }`}
                >
                  {won ? "Afinal perdeu" : "Afinal ganhou"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onReopen(bet)}
                  className="sl-tap flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-muted-foreground ring-1 ring-border disabled:opacity-40"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Pôr em aberto
                </button>
              </div>
            )}
          </div>
        )}

        <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px]">
          {bet.legs.length > 1
            ? `${bet.legs.length} jogos, odds multiplicadas. Todos tinham de entrar.`
            : "Um jogo."}{" "}
          Registada a {when(bet.placedAt)}
          {bet.settledAt ? ` · fechada a ${when(bet.settledAt)}` : " · ainda aberta"}.
        </p>
      </DialogContent>
    </Dialog>
  );
}
