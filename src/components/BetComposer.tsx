import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
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

const oddsField =
  "sl-figure h-10 w-[72px] flex-none rounded-xl border-0 bg-[hsl(var(--sl-surface))] px-2 text-center text-[15px] text-foreground ring-1 ring-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/50";

/**
 * One game on the slip: what is being backed, and what it pays.
 *
 * The price is typed here, beside the game, the moment the game goes on —
 * which is the only reason a bet no longer needs the pop-up closed, the page
 * scrolled and every odd filled in afterwards from memory.
 */
function LegRow({
  leg,
  index,
  /** True for the strip inside the pop-up, where there is no room to explain. */
  compact,
  takeFocus,
  onOdds,
  onRemove,
  children,
}: {
  leg: Draft;
  index: number;
  compact?: boolean;
  takeFocus: boolean;
  onOdds: (value: string) => void;
  onRemove: () => void;
  children?: ReactNode;
}) {
  const points = edgePoints(leg.modelProb, toOdds(leg.odds));

  return (
    <div className={compact ? "px-4 py-1.5" : "px-4 py-2.5"}>
      <div className="flex items-center gap-2.5">
        {!compact && (
          <span className="font-mono-data w-4 flex-none text-[11px] text-muted-foreground">
            {index + 1}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {leg.homeTeam} vs {leg.awayTeam}
          </p>
          {/* Wraps rather than truncates: the market is the long part and the
              points are the part worth reading, so cutting the line at its end
              cut the only number on it that says whether the price is worth
              taking. */}
          <p className="sl-meta flex flex-wrap items-baseline gap-x-1 text-[11px]">
            <span className="min-w-0 break-words">
              {MARKET_LABELS[leg.market] ?? leg.market}
            </span>
            {!compact && (
              <span>
                ·{" "}
                {leg.fixtureId === null
                  ? "à mão"
                  : `modelo ${leg.modelProb.toFixed(0)}%`}
              </span>
            )}
            {points !== null && (
              // A chip rather than more text with a dot in front: it is the
              // piece most likely to end up on a line of its own, and a line
              // that opens with "·" reads as broken.
              <span
                className={`rounded px-1 py-px text-[10px] font-bold ${
                  points > 0
                    ? "bg-[hsl(var(--sl-green))]/10 text-[hsl(var(--sl-green))]"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {`${points > 0 ? "+" : ""}${points} pts`}
              </span>
            )}
          </p>
        </div>
        <input
          inputMode="decimal"
          // The keyboard lands on the game that just went in, so the price is
          // typed without reaching for anything.
          autoFocus={takeFocus}
          value={leg.odds}
          onChange={(event) => onOdds(event.target.value)}
          placeholder="1.85"
          aria-label={`Odd de ${leg.homeTeam} vs ${leg.awayTeam}`}
          className={oddsField}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Tirar ${leg.homeTeam} vs ${leg.awayTeam}`}
          className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {children}
    </div>
  );
}

/**
 * Building the day's bet.
 *
 * The slip is the bet: the games on it, their prices, the amount, and what the
 * rules make of the whole thing. It lives in two places at once — in the strip
 * at the bottom of the games pop-up while games are being chosen, and on the
 * page once the pop-up is shut — so a bet can be registered from either,
 * whichever one somebody happens to be looking at.
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
  /** The games pop-up, which carries the slip while it is open. */
  const [pickerOpen, setPickerOpen] = useState(false);
  /** The game that just went on, whose price is what gets typed next. */
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Only a bump after this card is on screen opens the picker. Reacting to
  // the value itself meant that changing challenge — which takes this card
  // down and puts a new one up while the other challenge loads — arrived at a
  // signal that was already non-zero and opened the pop-up on its own, in
  // front of somebody who had asked for nothing.
  const lastSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal === lastSignal.current) return;
    lastSignal.current = openSignal;
    setPickerOpen(true);
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
        ? betTips(style, legs, (market) => MARKET_LABELS[market] ?? market)
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

  const value = slipValue(
    legs.map((leg) => ({ modelProb: leg.modelProb, odds: toOdds(leg.odds) })),
  );

  /** A game chosen in the pop-up, onto the slip. */
  const addGame = (game: PickedGame) => {
    const key =
      game.fixtureId === null ? `m${Date.now()}` : `f${game.fixtureId}`;
    setLegs((previous) => [...previous, { ...game, key }]);
    setFocusKey(key);
  };

  const setOdds = (key: string, odds: string) =>
    setLegs((previous) =>
      previous.map((leg) => (leg.key === key ? { ...leg, odds } : leg)),
    );

  const remove = (key: string) =>
    setLegs((previous) => previous.filter((leg) => leg.key !== key));

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
    setFocusKey(null);
    // Registered from inside the pop-up, the pop-up has done its job.
    setPickerOpen(false);
  };

  /** The breach worth one line of space: the rest is on the rules card. */
  const breach = violations.find(
    (violation) => violation.severity === "breach",
  );

  /**
   * Odd, amount and return, on one line.
   *
   * These were three cards and a fourth saying what the bankroll would be
   * afterwards — four blocks of chrome for three numbers, one of which was the
   * other two multiplied.
   */
  const totals = (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
          Odd {legs.length > 1 ? `· ${legs.length} jogos` : ""}
        </p>
        <p className="sl-figure text-[1.35rem] leading-7 text-foreground">
          {priced && combined > 1 ? combined.toFixed(2) : "—"}
          {targetOdds > 1 && (
            <span className="sl-meta ml-1.5 text-[10px] font-normal">
              de {targetOdds.toFixed(2)}
            </span>
          )}
        </p>
      </div>

      <label className="flex-none rounded-xl bg-[hsl(var(--sl-surface))] px-2.5 py-1.5">
        <span className="sl-meta text-[10px] uppercase tracking-[0.13em]">
          A apostar
        </span>
        <div className="flex items-baseline gap-0.5">
          <input
            inputMode="decimal"
            value={stakeInput ?? suggested.toFixed(2)}
            onChange={(event) => setStakeInput(event.target.value)}
            aria-label="Valor a apostar"
            className="w-[58px] min-w-0 bg-transparent font-mono-data text-[15px] font-bold text-foreground focus:outline-none"
          />
          <span className="font-mono-data flex-none text-[13px] font-bold text-muted-foreground">
            €
          </span>
        </div>
      </label>

      <div className="flex-none text-right">
        <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
          Se entrar
        </p>
        <p className="font-mono-data text-[15px] font-bold text-[hsl(var(--sl-green))]">
          {ready ? eur.format(stake * combined) : "—"}
        </p>
      </div>
    </div>
  );

  const registerButton = (
    <Button
      className="sl-btn-primary h-11 w-full text-sm disabled:opacity-40"
      disabled={!ready || saving}
      onClick={place}
    >
      <ListPlus className="mr-1.5 h-4 w-4" />
      {saving ? "A guardar..." : `Registar o nível ${day}`}
    </Button>
  );

  // Empty, this card would repeat what the card at the top of the page already
  // says, and put a second button beside its button. So it stays out of the way
  // until there is a slip to show — but only while that other button exists:
  // when the top card is saying something else, this is the only way in.
  const slipOnly = legs.length === 0 && Boolean(entryElsewhere);
  /** While the pop-up is up it holds the slip, so the page does not repeat it. */
  const slipHere = !pickerOpen && legs.length > 0;

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
            A aposta do nível {day}
          </h2>
          <p className="sl-meta truncate text-[11px]">
            O quadro pede {eur.format(suggested)}
            {targetOdds > 1 ? ` a uma odd de ${targetOdds.toFixed(2)}` : ""}
          </p>
        </div>
      </div>

      {slipHere && (
        <div className="divide-y divide-border border-b border-border">
          {legs.map((leg, index) => (
            <LegRow
              key={leg.key}
              leg={leg}
              index={index}
              takeFocus={false}
              onOdds={(odds) => setOdds(leg.key, odds)}
              onRemove={() => remove(leg.key)}
            >
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
            </LegRow>
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
            {legs.length === 0 ? "Inserir jogos" : "Inserir outro jogo"}
          </button>
        </div>
      )}

      <GamePicker
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          // The slip moves to the page when the pop-up shuts, and a field that
          // grabs the keyboard there would scroll the page out from under
          // whoever just closed it.
          if (!open) setFocusKey(null);
        }}
        access={access}
        memory={memory}
        chosenIds={chosenIds}
        onPick={addGame}
        footer={
          /* The slip, inside the pop-up: the games chosen, their prices and
             the button that registers the bet. Everything a bet needs is on
             this strip, so choosing a game and backing it is one visit. */
          legs.length > 0 ? (
            <div className="sticky bottom-0 border-t border-border bg-card">
              <div className="max-h-[38vh] divide-y divide-border overflow-y-auto">
                {legs.map((leg, index) => (
                  <LegRow
                    key={leg.key}
                    leg={leg}
                    index={index}
                    compact
                    takeFocus={leg.key === focusKey}
                    onOdds={(odds) => setOdds(leg.key, odds)}
                    onRemove={() => remove(leg.key)}
                  />
                ))}
              </div>

              <div className="space-y-2 border-t border-border px-4 py-2.5">
                {totals}

                {/* Whether the price is worth taking, where the bet is now
                    being registered from. */}
                {value && (
                  <p
                    className={`flex items-center justify-between gap-2 text-[11px] font-bold ${
                      value.edge > 0
                        ? "text-[hsl(var(--sl-green))]"
                        : "text-destructive"
                    }`}
                  >
                    {value.edge > 0 ? "Tem valor" : "Sem valor"}
                    <span className="sl-figure text-[12px]">
                      {value.edge > 0 ? "+" : ""}
                      {value.edge} pts
                    </span>
                  </p>
                )}

                {!priced && (
                  <p className="sl-meta text-[11px]">
                    Falta a odd de algum jogo.
                  </p>
                )}
                {breach && (
                  <p className="text-[11px] leading-5 text-destructive">
                    {breach.message}
                  </p>
                )}

                {registerButton}

                {/* The way back to the page, where the slip carries what each
                    competition gives and what this person's own record says
                    about these markets. */}
                <button
                  type="button"
                  onClick={() => setPickerOpen(false)}
                  className="sl-meta w-full text-center text-[11px] underline"
                >
                  Fechar e ver o boletim
                </button>
              </div>
            </div>
          ) : null
        }
      />

      {slipHere && (
        <div className="space-y-2 border-t border-border bg-[hsl(var(--sl-surface))] p-4">
          <div className="rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-primary/25">
            {totals}
          </div>

          {/* Every other number here says what happens if it lands. This one
              says whether it is worth backing at the price, which is the only
              one that decides whether a season ends up or down. It blocks
              nothing: it puts the comparison on screen, in one line. */}
          {value && (
            <div
              className={`rounded-2xl px-3.5 py-2 ring-1 ${
                value.edge > 0
                  ? "bg-[hsl(var(--sl-green))]/8 ring-[hsl(var(--sl-green))]/25"
                  : "bg-destructive/5 ring-destructive/25"
              }`}
            >
              <p
                className={`flex items-center justify-between gap-2 text-[12px] font-bold ${
                  value.edge > 0
                    ? "text-[hsl(var(--sl-green))]"
                    : "text-destructive"
                }`}
              >
                {value.edge > 0 ? "Tem valor" : "Sem valor"}
                <span className="sl-figure text-[13px]">
                  {value.edge > 0 ? "+" : ""}
                  {value.edge} pts
                </span>
              </p>
              {/* The two percentages the verdict is made of. Without them it
                  is a word and a number nobody can check. */}
              <p className="sl-meta mt-0.5 text-[11px] leading-5">
                {describeValue(value)}
              </p>
            </div>
          )}

          {!value && legs.some((leg) => leg.fixtureId === null) && (
            <p className="sl-meta text-[11px] leading-5">
              Um jogo metido à mão não tem previsão do modelo, por isso não dá
              para dizer se vale a odd que estás a apanhar.
            </p>
          )}

          {/* The app knew all of this already and only ever said it on a page
              nobody opens while deciding. Same numbers, at the one moment they
              could change something. */}
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

          {stakeInput !== null && Math.abs(stake - suggested) > 0.01 && (
            <button
              type="button"
              onClick={() => setStakeInput(null)}
              className="sl-meta text-[11px] underline"
            >
              Voltar ao valor do quadro ({eur.format(suggested)})
            </button>
          )}

          {registerButton}
        </div>
      )}
    </section>
  );
}
