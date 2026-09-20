import { useEffect, useMemo, useState } from "react";
import { Layers3, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import {
  MULTIPLES_UPDATED_EVENT,
  clearMultipleDraft,
  getMultipleDraft,
  getMultipleMetrics,
  removeLegFromMultipleDraft,
  saveMultipleFromDraft,
} from "@/lib/multipleStorage";

function euros(value: number) {
  return `${value.toFixed(2)} €`;
}

/**
 * The betslip: what is in the multiple right now, and what it pays.
 *
 * It rides above the bottom bar on every page because a multiple is built
 * across fixtures — you add a leg on one game, scroll on, add another. Keeping
 * the running odd and the leg count in view is the whole point; the sheet
 * underneath is where the stake is typed and the return is read.
 *
 * It reads and writes the same draft the Multiples page uses, so a slip
 * started here can be finished there and the two never disagree.
 */
export function BetSlip() {
  const [draft, setDraft] = useState(getMultipleDraft);
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState("");
  const [savedOdds, setSavedOdds] = useState<number | null>(null);

  useEffect(() => {
    const refresh = () => setDraft(getMultipleDraft());
    refresh();
    window.addEventListener(MULTIPLES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(MULTIPLES_UPDATED_EVENT, refresh);
  }, []);

  const metrics = useMemo(() => getMultipleMetrics(draft), [draft]);
  const stakeValue = Number(stake.replace(",", "."));
  const hasStake = Number.isFinite(stakeValue) && stakeValue > 0;
  const canPlace = draft.length >= 2 && hasStake;
  const potentialReturn = hasStake ? stakeValue * metrics.combinedOdds : 0;

  const place = () => {
    if (!canPlace) return;
    const saved = saveMultipleFromDraft(stakeValue);
    if (!saved) return;
    setSavedOdds(saved.combinedOdds);
    setStake("");
  };

  const close = () => {
    setOpen(false);
    // The confirmation belongs to the slip that was just placed, not to the
    // next one, so it is cleared on the way out rather than on the way in.
    setTimeout(() => setSavedOdds(null), 250);
  };

  if (draft.length === 0 && savedOdds === null) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Múltipla com ${draft.length} ${
          draft.length === 1 ? "seleção" : "seleções"
        }, odd combinada ${metrics.combinedOdds.toFixed(2)}`}
        className="fixed bottom-[68px] right-3 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 shadow-lg shadow-primary/30 transition active:scale-95 lg:bottom-6 lg:right-6"
      >
        <Layers3 className="h-4 w-4 text-white" strokeWidth={2.2} />
        <span className="font-mono-data text-sm font-bold text-white">
          {metrics.combinedOdds.toFixed(2)}
        </span>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[hsl(var(--sl-green-cta))] px-1 text-[11px] font-bold text-white">
          {draft.length}
        </span>
      </button>

      <Sheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <SheetContent
          side="bottom"
          // Capped width: a betslip stretched across a desktop monitor reads
          // as a page, not as the small running total it is.
          className="mx-auto max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border-border bg-background p-4"
        >
          <SheetTitle className="text-base font-semibold text-foreground">
            A tua múltipla
          </SheetTitle>

          {savedOdds !== null ? (
            <div className="mt-3">
              <SheetDescription className="sr-only">
                Múltipla registada.
              </SheetDescription>
              <div className="rounded-xl border border-[hsl(var(--sl-green))]/30 bg-[hsl(var(--sl-green))]/5 p-3.5">
                <p className="text-sm font-semibold text-[hsl(var(--sl-green))]">
                  Múltipla registada @ {savedOdds.toFixed(2)}.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Fica em "Apostas" como pendente. Os resultados dos jogos são
                  obtidos pela API e a múltipla fecha como green ou red assim
                  que o último jogo acabar.
                </p>
              </div>
              <Button
                className="sl-btn-primary mt-3 h-11 w-full text-sm"
                onClick={close}
              >
                Fechar
              </Button>
            </div>
          ) : (
            <>
              <SheetDescription className="mt-1 text-xs leading-relaxed text-muted-foreground">
                As odds multiplicam-se entre si. Mete a stake e vês logo quanto
                recebes se todos os jogos entrarem.
              </SheetDescription>

              <div className="mt-3 space-y-2">
                {draft.map((leg) => (
                  <div
                    key={`${leg.analysisId}-${leg.market}`}
                    className="flex items-start gap-2 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-foreground">
                        {leg.match}
                      </p>
                      <p className="sl-meta mt-0.5 text-[11px]">
                        {MARKET_LABELS[leg.market] ?? leg.market}
                      </p>
                    </div>
                    <span className="flex-none font-mono-data text-sm font-bold text-foreground">
                      {leg.odds.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remover ${leg.match}`}
                      className="flex-none rounded-lg p-1 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setDraft(
                          removeLegFromMultipleDraft(leg.analysisId, leg.market)
                        )
                      }
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {draft.length < 2 && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Uma múltipla precisa de pelo menos dois jogos. Adiciona outro
                  a partir do quadro de probabilidades.
                </p>
              )}

              {metrics.correlationLevel !== "Low" && (
                <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-semibold text-amber-700">
                    Seleções ligadas entre si
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-700/90">
                    {metrics.correlationReasons[0] ??
                      "Há seleções do mesmo jogo nesta múltipla."}{" "}
                    Não são resultados independentes, por isso a múltipla vale
                    menos do que a odd sugere.
                  </p>
                </div>
              )}

              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2.5">
                  <span className="sl-meta text-[11px]">Odd combinada</span>
                  <span className="font-mono-data text-lg font-bold text-foreground">
                    {metrics.combinedOdds.toFixed(2)}
                  </span>
                </div>

                <label className="block">
                  <span className="sl-meta text-[11px]">Stake (€)</span>
                  <input
                    inputMode="decimal"
                    value={stake}
                    onChange={(e) => setStake(e.target.value)}
                    placeholder={
                      metrics.recommendedStakeAmount > 0
                        ? metrics.recommendedStakeAmount.toFixed(2)
                        : "10"
                    }
                    className="mt-1 h-11 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 font-mono-data text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </label>

                {metrics.recommendedStakeAmount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setStake(metrics.recommendedStakeAmount.toFixed(2))
                    }
                    className="text-[12px] font-semibold text-primary"
                  >
                    Usar stake sugerida (
                    {euros(metrics.recommendedStakeAmount)})
                  </button>
                )}

                <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--sl-green))]/30 bg-[hsl(var(--sl-green))]/5 px-3 py-3">
                  <span className="text-xs font-semibold text-foreground">
                    Ganho se entrar tudo
                  </span>
                  <span className="font-mono-data text-xl font-bold text-[hsl(var(--sl-green))]">
                    {hasStake ? euros(potentialReturn) : "—"}
                  </span>
                </div>

                {hasStake && (
                  <p className="sl-meta text-[11px]">
                    Lucro de {euros(potentialReturn - stakeValue)} sobre uma
                    stake de {euros(stakeValue)}.
                  </p>
                )}

                <Button
                  className="sl-btn-primary h-11 w-full text-sm disabled:opacity-40"
                  disabled={!canPlace}
                  onClick={place}
                >
                  Registar múltipla
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    clearMultipleDraft();
                    setDraft([]);
                    close();
                  }}
                  className="w-full py-1 text-[12px] font-semibold text-muted-foreground hover:text-destructive"
                >
                  Limpar múltipla
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
