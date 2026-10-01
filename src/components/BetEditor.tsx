import { useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  GamePicker,
  type BoardAccess,
  type PickedGame,
} from "@/components/GamePicker";
import { MarketField } from "@/components/MarketField";
import { Button } from "@/components/ui/button";
import { combineOdds, type PlanBet, type PlanLeg } from "@/lib/planStore";
import type { TypingMemory } from "@/lib/typingMemory";

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
 * the market, the amount, a game that should not be in there at all — and a
 * game that should be in there and is not. Taking one out was possible from
 * the start; putting one in meant deleting the bet and typing the whole slip
 * again, which is a lot to ask for one forgotten game.
 *
 * Only while the day is still open. On a day already closed the arithmetic is
 * done and the games have results: a new game would arrive undecided on a bet
 * that is not, and there is no honest answer to what that day then won.
 */
export function BetEditor({
  bet,
  access,
  memory,
  saving,
  onSave,
  onDelete,
  onCancel,
}: {
  bet: PlanBet;
  /** The board, so a game can be picked here the same way it is in the slip. */
  access: BoardAccess;
  /** What has already been typed on these slips, to offer back. */
  memory: TypingMemory;
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
  const [picking, setPicking] = useState(false);

  const stillOpen = bet.status === "pending";

  const chosenIds = useMemo(
    () =>
      new Set(
        legs
          .map((leg) => leg.fixtureId)
          .filter((id): id is number => id !== null),
      ),
    [legs],
  );

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

  /** A game chosen in the pop-up, onto the slip, still undecided like the day. */
  const add = (game: PickedGame) => {
    setLegs((current) => [
      ...current,
      {
        match: `${game.homeTeam} vs ${game.awayTeam}`,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        league: game.league,
        market: game.market,
        odds: toNumber(game.odds),
        modelProb: game.modelProb,
        fixtureId: game.fixtureId,
        kickoff: game.kickoff,
        status: "pending",
      },
    ]);
    setOdds((current) => [...current, game.odds]);
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

            <MarketField
              value={leg.market}
              onChange={(market) => setMarket(index, market)}
              used={memory.markets}
              label={`${leg.homeTeam} vs ${leg.awayTeam}`}
              describedAs={`Mercado de ${leg.homeTeam} vs ${leg.awayTeam}`}
            />

            <div>
              <p className="sl-meta mb-1 text-[10px] uppercase tracking-[0.12em]">
                Odd
              </p>
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

      {stillOpen ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-2.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar jogo
        </button>
      ) : (
        <p className="sl-meta text-[11px] leading-5">
          Só dá para juntar outro jogo enquanto o dia estiver em aberto. Põe a
          aposta em aberto primeiro, se foi fechada cedo demais.
        </p>
      )}

      {stillOpen && (
        <GamePicker
          open={picking}
          onOpenChange={setPicking}
          access={access}
          memory={memory}
          chosenIds={chosenIds}
          onPick={add}
          title={`Juntar ao dia ${bet.day}`}
          footer={
            <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-card px-4 py-3">
              <p className="sl-meta min-w-0 flex-1 text-[11px]">
                {legs.length === 1
                  ? "1 jogo nesta aposta"
                  : `${legs.length} jogos nesta aposta`}
                {" · a odd escreve-se na correção"}
              </p>
              <Button
                className="sl-btn-primary sl-tap h-10 flex-none px-5 text-xs"
                onClick={() => setPicking(false)}
              >
                Concluído
              </Button>
            </div>
          }
        />
      )}

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
