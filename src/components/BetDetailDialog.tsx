import { Check, Clock, PenLine, X } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isManualLeg, type PlanBet } from "@/lib/planStore";

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
  onClose,
}: {
  bet: PlanBet | null;
  player: string;
  onClose: () => void;
}) {
  if (!bet) return null;

  const won = bet.status === "green";
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

        <div className="divide-y divide-border">
          {bet.legs.map((leg, index) => {
            const Icon =
              leg.status === "green" ? Check : leg.status === "red" ? X : Clock;
            return (
              <div key={`${leg.fixtureId ?? "m"}-${index}`} className="flex items-start gap-2.5 px-4 py-3">
                <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${LEG_TONE[leg.status]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">
                    {leg.homeTeam} vs {leg.awayTeam}
                  </p>
                  <p className="sl-meta text-[11px] leading-5">
                    {MARKET_LABELS[leg.market] ?? leg.market}
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
                <span className="font-mono-data flex-none text-sm font-bold text-foreground">
                  {leg.odds.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

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
