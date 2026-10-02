import { useEffect, useMemo, useState } from "react";
import { ListPlus, Plus, X } from "lucide-react";
import {
  GamePicker,
  type BoardAccess,
  type PickedGame,
} from "@/components/GamePicker";
import { LegContextRow } from "@/components/LegContext";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { legContext } from "@/lib/betContext";
import { useLeagueRates } from "@/hooks/useLeagueRates";
import { betTips } from "@/lib/betTips";
import type { PlayerStyle } from "@/lib/bettingStyle";
import { describeValue, edgePoints, slipValue } from "@/lib/valueBet";
import { checkBet, type ChallengeRules } from "@/lib/challengeRules";
import { combineOdds, type PlanLeg } from "@/lib/planStore";
import type { TypingMemory } from "@/lib/typingMemory";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** A game picked for today, before it is worth saving. */
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
 * Building the day's bet.
 *
 * The slip itself: the games already on it, their prices, what the rules make
 * of the whole thing, and the amount. Choosing the games is the picker's job,
 * which lives apart from this so that a bet already registered can be sent to
 * the same pop-up.
 */
export function BetComposer({
  access,
  memory,
  rules,
  day,
  bankroll,
  betsToday,
  lossStreak,
  openBets,
  style,
  openSignal,
  entryElsewhere,
  targetOdds,
  plannedStake,
  saving,
  onPlace,
}: {
  /** The board of games, and everything said about how it was fetched. */
  access: BoardAccess;
  /** What has already been typed on these slips, to offer back. */
  memory: TypingMemory;
  rules: ChallengeRules;
  day: number;
  bankroll: number;
  betsToday: number;
  lossStreak: number;
  openBets: number;
  /** This person's settled record, to say what it makes of the slip. */
  style: PlayerStyle | null;
  /** Bumped from outside to open the picker, so the card at the top of the
      page can start the day's bet without anyone scrolling to find it. */
  openSignal?: number;
  /** True when the card at the top of the page is already offering the way in
      and this one would only repeat it. */
  entryElsewhere?: boolean;
  /** The odd the table pencils in for today, to aim the slip at. */
  targetOdds: number;
  /** What the table asks for today, which is what the field starts on. */
  plannedStake: number;
  saving: boolean;
  onPlace: (legs: PlanLeg[], odds: number, stake: number) => void;
}) {
  const [legs, setLegs] = useState<Draft[]>([]);
  const [stakeInput, setStakeInput] = useState<string | null>(null);
  /** The picker lives in a pop-up: the slip is what the page is for. */
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (openSignal) setPickerOpen(true);
  }, [openSignal]);

  const suggested = plannedStake;
  const stake =
    stakeInput === null
      ? suggested
      : Math.max(0, Number(stakeInput.replace(",", ".")) || 0);

  const chosenIds = useMemo(
    () =>
      new Set(
        legs
          .map((leg) => leg.fixtureId)
          .filter((id): id is number => id !== null),
      ),
    [legs],
  );

  // What the competitions usually give: one request for the lot, held for the
  // session, and absent for a game typed by hand — which is the honest answer
  // for a competition the provider does not cover.
  const rates = useLeagueRates();

  const tips = useMemo(
    () =>
      style
        ? betTips(
            style,
            legs,
            (market) => MARKET_LABELS[market] ?? market,
          )
        : [],
    [style, legs],
  );

  const priced = legs.every((leg) => toOdds(leg.odds) > 0);
  const combined = priced
    ? combineOdds(legs.map((leg) => ({ odds: toOdds(leg.odds) })))
    : 0;
  const ready = legs.length > 0 && priced && combined > 1 && stake > 0;

  const violations = ready
    ? checkBet(rules, {
        odds: combined,
        stake,
        bankroll,
        day,
        betsPlacedToday: betsToday,
        lossStreak,
        openBets,
        plannedStake: suggested,
      })
    : [];

  /** A game chosen in the pop-up, onto the slip. The price is typed here. */
  const addGame = (game: PickedGame) =>
    setLegs((previous) => [
      ...previous,
      {
        ...game,
        key:
          game.fixtureId === null ? `m${Date.now()}` : `f${game.fixtureId}`,
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
    setStakeInput(null);
  };

  // Empty, this card would repeat what the card at the top of the page already
  // says, and put a second button beside its button. So it stays out of the way
  // until there is a slip to show — but only while that other button exists:
  // when the top card is saying something else, this is the only way in.
  const slipOnly = legs.length === 0 && Boolean(entryElsewhere);

  return (
    <section className={slipOnly ? "contents" : "sl-card overflow-hidden"}>
      <div
        className={`${slipOnly ? "hidden" : "flex"} items-center gap-2 border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-4 py-3`}
      >
        <span className="sl-figure flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[13px] text-white [background:var(--sl-gradient)]">
          {day}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">
            A aposta do dia {day}
          </h2>
          <p className="sl-meta truncate text-[11px]">
            O quadro pede {eur.format(suggested)}
            {targetOdds > 1 ? ` a uma odd de ${targetOdds.toFixed(2)}` : ""}
          </p>
        </div>
      </div>

      {/* The slip comes first: once there is something in it, it is what the
          person is looking at, and burying it under the search would mean
          scrolling past the whole board to check the odd. */}
      {legs.length > 0 && (
        <div className="divide-y divide-border border-b border-border">
          {legs.map((leg, index) => (
            <div key={leg.key} className="px-4 py-2.5">
              <div className="flex items-center gap-2.5">
              <span className="font-mono-data w-4 flex-none text-[11px] text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {leg.homeTeam} vs {leg.awayTeam}
                </p>
                <p className="sl-meta truncate text-[11px]">
                  {MARKET_LABELS[leg.market] ?? leg.market}
                  {leg.fixtureId === null
                    ? " · à mão"
                    : ` · modelo ${leg.modelProb.toFixed(0)}%`}
                  {(() => {
                    // What the odd typed is paying for, against what the model
                    // thinks. The only number on this row that says whether
                    // backing it is a good idea.
                    const points = edgePoints(leg.modelProb, toOdds(leg.odds));
                    if (points === null) return null;
                    return (
                      <span
                        className={
                          points > 0
                            ? " font-semibold text-[hsl(var(--sl-green))]"
                            : " font-semibold text-destructive"
                        }
                      >
                        {` · ${points > 0 ? "+" : ""}${points} pts`}
                      </span>
                    );
                  })()}
                </p>
              </div>
              <input
                inputMode="decimal"
                value={leg.odds}
                onChange={(event) =>
                  setLegs((previous) =>
                    previous.map((entry) =>
                      entry.key === leg.key
                        ? { ...entry, odds: event.target.value }
                        : entry,
                    ),
                  )
                }
                placeholder="1.85"
                aria-label={`Odd de ${leg.homeTeam} vs ${leg.awayTeam}`}
                className="sl-figure h-10 w-[72px] flex-none rounded-xl border-0 bg-[hsl(var(--sl-surface))] px-2 text-center text-[15px] text-foreground ring-1 ring-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
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

              {/* The competition, the price and this person's own record, at
                  the one moment they could change what gets registered. */}
              <LegContextRow
                context={legContext({
                  market: leg.market,
                  odds: toOdds(leg.odds),
                  report: rates.get(leg.league),
                  style,
                })}
              />
            </div>
          ))}
        </div>
      )}

      {!slipOnly && (
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-3 text-xs font-semibold text-primary transition hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Inserir outro jogo
          </button>
        </div>
      )}

      <GamePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        access={access}
        memory={memory}
        chosenIds={chosenIds}
        onPick={addGame}
        footer={
          /* The slip itself lives behind this pop-up, so with the pop-up
             staying open there was nothing on screen to say a game had gone
             in. This is that, and the way out. */
          legs.length > 0 ? (
            <div className="sticky bottom-0 flex items-center gap-3 border-t border-border bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-foreground">
                  {legs.length === 1
                    ? "1 jogo no boletim"
                    : `${legs.length} jogos no boletim`}
                </p>
                <p className="sl-meta truncate text-[11px]">
                  {priced && combined > 1
                    ? `odd total ${combined.toFixed(2)}`
                    : "falta a odd de algum jogo"}
                </p>
              </div>
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

      {legs.length > 0 && (
        <div className="space-y-2 border-t border-border bg-[hsl(var(--sl-surface))] p-4">
          <div className="flex items-center justify-between rounded-2xl bg-card px-3.5 py-3 ring-1 ring-primary/25">
            <div className="min-w-0">
              <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                Odd total
              </p>
              <p className="sl-meta mt-0.5 truncate text-[11px]">
                {legs.length === 1
                  ? "1 jogo"
                  : `${legs.length} jogos multiplicados`}
              </p>
            </div>
            <div className="flex-none text-right">
              <span className="sl-figure text-[1.9rem] leading-8 text-foreground">
                {priced && combined > 1 ? combined.toFixed(2) : "—"}
              </span>
              {targetOdds > 1 && (
                <p className="sl-meta text-[10px]">
                  a apontar {targetOdds.toFixed(2)}
                </p>
              )}
            </div>
          </div>

          {/* Every other number here says what happens if it lands. This one
              says whether it is worth backing at the price, which is the only
              one that decides whether a season ends up or down. It blocks
              nothing: it puts the comparison on screen. */}
          {(() => {
            const value = slipValue(
              legs.map((leg) => ({
                modelProb: leg.modelProb,
                odds: toOdds(leg.odds),
              })),
            );

            if (!value) {
              const blind = legs.some(
                (leg) => leg.fixtureId === null && toOdds(leg.odds) > 1,
              );
              if (!blind) return null;
              return (
                <p className="sl-meta rounded-2xl bg-card px-3.5 py-2.5 text-[11px] leading-5 ring-1 ring-border">
                  Um jogo metido à mão não tem previsão do modelo, por isso não
                  dá para dizer se esta aposta vale a odd que estás a apanhar.
                </p>
              );
            }

            const good = value.edge > 0;
            return (
              <div
                className={`rounded-2xl px-3.5 py-2.5 ring-1 ${
                  good
                    ? "bg-[hsl(var(--sl-green))]/8 ring-[hsl(var(--sl-green))]/25"
                    : "bg-destructive/5 ring-destructive/25"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[12px] font-bold ${
                      good
                        ? "text-[hsl(var(--sl-green))]"
                        : "text-destructive"
                    }`}
                  >
                    {good ? "Tem valor" : "Sem valor"}
                  </span>
                  <span
                    className={`sl-figure text-sm ${
                      good
                        ? "text-[hsl(var(--sl-green))]"
                        : "text-destructive"
                    }`}
                  >
                    {value.edge > 0 ? "+" : ""}
                    {value.edge} pts
                  </span>
                </div>
                <p className="sl-meta mt-1 text-[11px] leading-5">
                  {describeValue(value)}
                </p>
              </div>
            );
          })()}

          {/* The app knew all of this already and only ever said it on a page
              nobody opens while deciding. Same numbers, at the one moment they
              could change something. */}
          {tips.length > 0 && (
            <div className="space-y-1 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-border">
              <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                O teu registo
              </p>
              {tips.map((tip) => (
                <p
                  key={tip.id}
                  className={`text-[11px] leading-5 ${
                    tip.tone === "good"
                      ? "text-[hsl(var(--sl-green))]"
                      : tip.tone === "bad"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {tip.text}
                </p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-2xl bg-card px-3 py-2 ring-1 ring-border">
              <span className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                A apostar
              </span>
              <div className="mt-0.5 flex items-baseline gap-1">
                <input
                  inputMode="decimal"
                  value={stakeInput ?? suggested.toFixed(2)}
                  onChange={(event) => setStakeInput(event.target.value)}
                  aria-label="Valor a apostar"
                  className="w-full min-w-0 bg-transparent font-mono-data text-sm font-bold text-foreground focus:outline-none"
                />
                <span className="font-mono-data flex-none text-sm font-bold text-muted-foreground">
                  €
                </span>
              </div>
            </label>
            <div className="rounded-2xl bg-[hsl(var(--sl-green))]/8 px-3 py-2 ring-1 ring-[hsl(var(--sl-green))]/20">
              <span className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                Se entrar
              </span>
              <p className="mt-0.5 font-mono-data text-sm font-bold text-[hsl(var(--sl-green))]">
                {ready ? eur.format(stake * combined) : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-card px-3 py-2 ring-1 ring-border">
            <span className="sl-meta text-[11px]">Banca depois, se entrar</span>
            <span className="sl-figure text-[15px] text-foreground">
              {ready ? eur.format(bankroll + stake * (combined - 1)) : "—"}
            </span>
          </div>

          {stakeInput !== null && Math.abs(stake - suggested) > 0.01 && (
            <button
              type="button"
              onClick={() => setStakeInput(null)}
              className="sl-meta text-[11px] underline"
            >
              Voltar ao valor do quadro ({eur.format(suggested)})
            </button>
          )}

          {!priced && (
            <p className="sl-meta text-[11px]">Falta a odd de algum jogo.</p>
          )}

          {violations.map((violation) => (
            <p
              key={violation.code}
              className={`text-[11px] leading-relaxed ${
                violation.severity === "breach" ? "text-destructive" : "sl-meta"
              }`}
            >
              {violation.message}
            </p>
          ))}

          <Button
            className="sl-btn-primary h-11 w-full text-sm disabled:opacity-40"
            disabled={!ready || saving}
            onClick={place}
          >
            <ListPlus className="mr-1.5 h-4 w-4" />
            {saving ? "A guardar..." : `Registar o dia ${day}`}
          </Button>
        </div>
      )}
    </section>
  );
}
