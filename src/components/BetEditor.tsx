import { useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { combineOdds, type PlanBet, type PlanLeg } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

function toNumber(raw: string): number {
  return Math.max(0, Number(raw.replace(",", ".")) || 0);
}

/**
 * A registered bet, corrected.
 *
 * Everything anybody can get wrong while typing a slip on a phone: the odd,
 * the market, the amount, a game that should not be in there at all. The
 * games themselves are not re-picked here — a slip with the wrong game in it
 * is a slip to take the game out of, and adding one is what the bet composer
 * is for.
 */
export function BetEditor({
  bet,
  saving,
  onSave,
  onDelete,
  onCancel,
}: {
  bet: PlanBet;
  saving: boolean;
  onSave: (legs: PlanLeg[], stake: number) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [legs, setLegs] = useState<PlanLeg[]>(bet.legs);
  const [stake, setStake] = useState(String(bet.stake));
  const [odds, setOdds] = useState<string[]>(() =>
    bet.legs.map((leg) => leg.odds.toFixed(2)),
  );
  const [confirming, setConfirming] = useState(false);

  const priced = legs.map((leg, index) => ({
    ...leg,
    odds: toNumber(odds[index] ?? String(leg.odds)),
  }));
  const combined = combineOdds(priced);
  const money = toNumber(stake);
  const ready =
    legs.length > 0 &&
    money > 0 &&
    priced.every((leg) => leg.odds > 1 && leg.market.trim().length > 0);

  const setMarket = (index: number, market: string) =>
    setLegs((current) =>
      current.map((leg, position) =>
        position === index ? { ...leg, market } : leg,
      ),
    );

  const drop = (index: number) => {
    setLegs((current) => current.filter((_, position) => position !== index));
    setOdds((current) => current.filter((_, position) => position !== index));
  };

  return (
    <div className="space-y-3 border-t border-border bg-[hsl(var(--sl-surface))] px-4 py-3.5">
      <div>
        <label className="sl-meta mb-1 block text-[10px] uppercase tracking-[0.12em]">
          Quanto apostaste
        </label>
        <input
          inputMode="decimal"
          value={stake}
          onChange={(event) => setStake(event.target.value)}
          aria-label="Valor apostado"
          className={`${field} font-mono-data`}
        />
      </div>

      <div className="space-y-2">
        {legs.map((leg, index) => (
          <div
            key={`${leg.fixtureId ?? "m"}-${index}`}
            className="space-y-2 rounded-xl bg-card p-2.5 ring-1 ring-border"
          >
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
                {leg.homeTeam} vs {leg.awayTeam}
              </p>
              {legs.length > 1 && (
                <button
                  type="button"
                  onClick={() => drop(index)}
                  aria-label={`Tirar ${leg.homeTeam} vs ${leg.awayTeam} da aposta`}
                  className="sl-tap flex h-6 w-6 flex-none items-center justify-center rounded-md text-muted-foreground ring-1 ring-border"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-[1fr_84px] gap-2">
              <input
                value={leg.market}
                onChange={(event) => setMarket(index, event.target.value)}
                placeholder="A tua aposta"
                aria-label={`Mercado de ${leg.homeTeam} vs ${leg.awayTeam}`}
                className={field}
              />
              <input
                inputMode="decimal"
                value={odds[index] ?? ""}
                onChange={(event) =>
                  setOdds((current) =>
                    current.map((entry, position) =>
                      position === index ? event.target.value : entry,
                    ),
                  )
                }
                placeholder="Odd"
                aria-label={`Odd de ${leg.homeTeam} vs ${leg.awayTeam}`}
                className={`${field} text-center font-mono-data`}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5 ring-1 ring-primary/25">
        <span className="sl-meta text-[11px]">
          Odd total · {eur.format(money)}
        </span>
        <span className="sl-figure text-lg text-foreground">
          {combined > 1 ? combined.toFixed(2) : "—"}
        </span>
      </div>

      <div className="flex gap-2">
        <Button
          className="sl-btn-primary h-10 flex-1 text-xs disabled:opacity-40"
          disabled={!ready || saving}
          onClick={() => onSave(priced, money)}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Guardar correção"
          )}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="sl-tap h-10 flex-none rounded-xl px-4 text-xs font-semibold text-muted-foreground ring-1 ring-border"
        >
          Cancelar
        </button>
      </div>

      {/* Deleting takes the day off both players' ladders, so it asks once. */}
      {confirming ? (
        <div className="space-y-2 rounded-xl bg-destructive/5 p-3">
          <p className="text-[11px] leading-5 text-foreground">
            Apagar apaga o dia {bet.day} do histórico, para os dois. Não dá para
            voltar atrás.
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              className="h-9 flex-1 rounded-xl text-xs disabled:opacity-40"
              disabled={saving}
              onClick={onDelete}
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Apagar mesmo"
              )}
            </Button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="sl-tap h-9 flex-none rounded-xl px-4 text-xs font-semibold text-muted-foreground ring-1 ring-border"
            >
              Não
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="sl-tap flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-semibold text-destructive"
        >
          <Trash2 className="h-3 w-3" />
          Apagar esta aposta
        </button>
      )}
    </div>
  );
}
