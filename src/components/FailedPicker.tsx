import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { canonicalMarket } from "@/lib/marketNames";
import type { PlanBet } from "@/lib/planStore";

/**
 * Which games took the day down.
 *
 * A multiple loses because a game fell, and the rest came in — so the only
 * thing left to say is which ones failed. Everything not picked is settled as
 * landed, which is what makes this one tap on the usual day and still exact on
 * the day two games went.
 */
export function FailedPicker({
  bet,
  saving,
  onSave,
  onCancel,
}: {
  bet: PlanBet;
  saving: boolean;
  onSave: (failed: number[]) => void;
  onCancel: () => void;
}) {
  const [failed, setFailed] = useState<number[]>(() =>
    bet.legs
      .map((leg, index) => (leg.status === "red" ? index : -1))
      .filter((index) => index >= 0)
  );

  const toggle = (index: number) =>
    setFailed((current) =>
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : [...current, index]
    );

  return (
    <div className="mt-2.5 space-y-2 rounded-2xl bg-destructive/5 p-3">
      <p className="text-[12px] font-semibold text-foreground">
        Quais é que falharam?
      </p>
      <p className="sl-meta text-[11px] leading-5">
        Os que não escolheres ficam como entrados.
      </p>

      <div className="space-y-1.5">
        {bet.legs.map((leg, index) => {
          const down = failed.includes(index);
          return (
            <button
              key={`${bet.id}-${index}`}
              type="button"
              onClick={() => toggle(index)}
              aria-pressed={down}
              className={`sl-tap flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left ${
                down
                  ? "bg-destructive/12 ring-1 ring-destructive/40"
                  : "bg-card ring-1 ring-border"
              }`}
            >
              <span
                className={`flex h-5 w-5 flex-none items-center justify-center rounded-md ${
                  down ? "bg-destructive text-white" : "ring-1 ring-border"
                }`}
              >
                {down && <X className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-semibold text-foreground">
                  {leg.match}
                </span>
                <span className="sl-meta block truncate text-[11px]">
                  {MARKET_LABELS[leg.market] ?? canonicalMarket(leg.market)} @{" "}
                  {leg.odds.toFixed(2)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pt-0.5">
        <Button
          variant="destructive"
          className="h-10 flex-1 rounded-xl text-xs disabled:opacity-40"
          disabled={failed.length === 0 || saving}
          onClick={() => onSave(failed)}
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Guardar o dia perdido"
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

      {failed.length === 0 && (
        <p className="sl-meta text-[11px]">
          Um dia perdido tem pelo menos um jogo falhado.
        </p>
      )}
    </div>
  );
}
