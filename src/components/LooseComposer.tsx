import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { GamePicker, type BoardAccess, type PickedGame } from "@/components/GamePicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { combineOdds, type PlanLeg } from "@/lib/planStore";
import type { TypingMemory } from "@/lib/typingMemory";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

interface Draft {
  key: string;
  fixtureId: number | null;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  modelProb: number;
  kickoff: string | null;
  /** As typed, so "1," on the way to "1,85" does not get eaten. */
  odds: string;
}

function toOdds(raw: string): number {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 1 ? value : 0;
}

/**
 * Registering a bet that answers to nobody.
 *
 * The challenge composer carries a day, a ladder, a bankroll and a set of
 * rules to be checked against — none of which exist here. What is left is the
 * part everybody actually fills in: which games, at what price, for how much.
 * The games are chosen in the same pop-up as everywhere else.
 */
export function LooseComposer({
  open,
  onOpenChange,
  access,
  memory,
  saving,
  onPlace,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: BoardAccess;
  memory: TypingMemory;
  saving: boolean;
  onPlace: (legs: PlanLeg[], odds: number, stake: number) => void;
}) {
  const [legs, setLegs] = useState<Draft[]>([]);
  const [stakeInput, setStakeInput] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const chosenIds = useMemo(
    () =>
      new Set(
        legs.map((leg) => leg.fixtureId).filter((id): id is number => id !== null),
      ),
    [legs],
  );

  const priced = legs.every((leg) => toOdds(leg.odds) > 0);
  const combined = priced
    ? combineOdds(legs.map((leg) => ({ odds: toOdds(leg.odds) })))
    : 0;
  const stake = Math.max(0, Number(stakeInput.replace(",", ".")) || 0);
  const ready = legs.length > 0 && priced && combined > 1 && stake > 0;

  const addGame = (game: PickedGame) =>
    setLegs((previous) => [
      ...previous,
      {
        ...game,
        key: game.fixtureId === null ? `m${Date.now()}` : `f${game.fixtureId}`,
      },
    ]);

  const place = () => {
    if (!ready) return;
    onPlace(
      legs.map((leg) => ({
        match: `${leg.homeTeam} vs ${leg.awayTeam}`,
        homeTeam: leg.homeTeam,
        awayTeam: leg.awayTeam,
        league: leg.league,
        market: leg.market,
        odds: toOdds(leg.odds),
        modelProb: leg.modelProb,
        fixtureId: leg.fixtureId,
        kickoff: leg.kickoff,
        status: "pending",
      })),
      combined,
      stake,
    );
    setLegs([]);
    setStakeInput("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setLegs([]);
          setStakeInput("");
        }
      }}
    >
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-sm font-bold">Registar aposta</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 px-4 py-3.5">
          {legs.map((leg, index) => (
            <div
              key={leg.key}
              className="rounded-xl bg-[hsl(var(--sl-surface))] p-2.5 ring-1 ring-border"
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-foreground">
                    {leg.homeTeam} vs {leg.awayTeam}
                  </p>
                  <p className="sl-meta truncate text-[11px]">{leg.market}</p>
                </div>
                <input
                  inputMode="decimal"
                  value={leg.odds}
                  onChange={(event) =>
                    setLegs((previous) =>
                      previous.map((entry, position) =>
                        position === index
                          ? { ...entry, odds: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  placeholder="1.85"
                  aria-label={`Odd de ${leg.homeTeam} vs ${leg.awayTeam}`}
                  className="sl-figure h-10 w-[72px] flex-none rounded-xl border-0 bg-card px-2 text-center text-[15px] text-foreground ring-1 ring-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <button
                  type="button"
                  onClick={() =>
                    setLegs((previous) =>
                      previous.filter((entry) => entry.key !== leg.key),
                    )
                  }
                  aria-label={`Tirar ${leg.homeTeam} vs ${leg.awayTeam}`}
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-3 text-xs font-semibold text-primary transition hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            {legs.length === 0 ? "Inserir jogo" : "Inserir outro jogo"}
          </button>

          {legs.length > 0 && (
            <>
              <div className="flex items-center justify-between rounded-xl bg-[hsl(var(--sl-surface))] px-3.5 py-3 ring-1 ring-primary/25">
                <span className="sl-meta text-[11px]">
                  {legs.length === 1
                    ? "1 jogo"
                    : `${legs.length} jogos multiplicados`}
                </span>
                <span className="sl-figure text-lg text-foreground">
                  {combined > 1 ? combined.toFixed(2) : "—"}
                </span>
              </div>

              <div>
                <label className="sl-meta mb-1 block text-[10px] uppercase tracking-[0.12em]">
                  Quanto apostaste
                </label>
                <input
                  inputMode="decimal"
                  value={stakeInput}
                  onChange={(event) => setStakeInput(event.target.value)}
                  placeholder="10"
                  aria-label="Valor apostado"
                  className="sl-figure h-11 w-full rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {ready && (
                <p className="sl-meta text-[11px]">
                  Se entrar, recebes {eur.format(stake * combined)} —{" "}
                  {eur.format(stake * combined - stake)} de lucro.
                </p>
              )}

              <Button
                className="sl-btn-primary sl-tap h-11 w-full text-xs disabled:opacity-40"
                disabled={!ready || saving}
                onClick={place}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Registar aposta"
                )}
              </Button>
            </>
          )}
        </div>

        <GamePicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          access={access}
          memory={memory}
          chosenIds={chosenIds}
          onPick={addGame}
          footer={
            legs.length > 0 ? (
              <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-card px-4 py-3">
                <p className="sl-meta min-w-0 flex-1 text-[11px]">
                  {legs.length === 1
                    ? "1 jogo na aposta"
                    : `${legs.length} jogos na aposta`}
                </p>
                <Button
                  className="sl-btn-primary sl-tap h-10 flex-none px-5 text-xs"
                  onClick={() => setPickerOpen(false)}
                >
                  Concluído
                </Button>
              </div>
            ) : null
          }
        />
      </DialogContent>
    </Dialog>
  );
}
