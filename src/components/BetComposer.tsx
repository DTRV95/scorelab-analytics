import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Info,
  ListPlus,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { leagueCounts } from "@/lib/boardLeagues";
import { checkBet, type ChallengeRules } from "@/lib/challengeRules";
import { freshness } from "@/lib/freshness";
import {
  byUrgency,
  describeHealth,
  fetchLeagueHealth,
  type LeagueHealthReport,
} from "@/lib/leagueHealth";
import { combineOdds, type PlanLeg } from "@/lib/planStore";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

// The list scrolls, so this is a guard against a pathological board rather
// than a shortlist: with the league chips above it, anything on the board is
// reachable in one tap even on a heavy weekend.
const LIST_LIMIT = 60;

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

function kickoffTime(kickoff: string | null) {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

/** The markets of one board game, to pick which one is being backed. */
function MarketPicker({
  match,
  onPick,
  onClose,
}: {
  match: BoardMatch;
  onPick: (market: string, prob: number) => void;
  onClose: () => void;
}) {
  const markets = [...(match.mercados ?? [])].sort(
    (a, b) => b.probabilidade_pct - a.probabilidade_pct,
  );

  return (
    <div className="border-t border-border bg-[hsl(var(--sl-surface))] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Em que apostas?
        </p>
        <button
          type="button"
          onClick={onClose}
          className="sl-meta text-[11px]"
          aria-label="Fechar mercados"
        >
          Fechar
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {markets.map((market) => (
          <button
            key={market.mercado}
            type="button"
            onClick={() => onPick(market.mercado, market.probabilidade_pct)}
            aria-label={`Apostar em ${MARKET_LABELS[market.mercado] ?? market.mercado}`}
            className="sl-tap flex items-center justify-between gap-2 rounded-xl bg-card px-2.5 py-2.5 text-left ring-1 ring-border hover:ring-primary/50"
          >
            <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
              {MARKET_LABELS[market.mercado] ?? market.mercado}
            </span>
            <span className="font-mono-data flex-none text-[11px] font-bold text-[hsl(var(--sl-green))]">
              {market.probabilidade_pct.toFixed(0)}%
            </span>
          </button>
        ))}
        {markets.length === 0 && (
          <p className="sl-meta col-span-2 text-[11px]">
            Este jogo não trouxe mercados. Adiciona-o à mão com a tua aposta.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Building the day's bet.
 *
 * Two ways in, on purpose: a game the site knows brings its own forecast, and a
 * game it does not know brings nothing but the price the bookmaker is offering.
 * Both end up as the same thing — a list of games whose odds multiply — because
 * that is what a bookmaker does with them.
 */
export function BetComposer({
  board,
  rules,
  day,
  bankroll,
  betsToday,
  lossStreak,
  openBets,
  unavailable,
  boardAt,
  boardLoading,
  skipped,
  onRefreshBoard,
  openSignal,
  entryElsewhere,
  targetOdds,
  plannedStake,
  usedFixtures,
  saving,
  onPlace,
}: {
  board: BoardMatch[];
  rules: ChallengeRules;
  day: number;
  bankroll: number;
  betsToday: number;
  lossStreak: number;
  openBets: number;
  /** Competitions the provider did not answer for on the last board fetch. */
  unavailable: string[];
  /** When the games on screen were fetched, so their age is visible. */
  boardAt: number | null;
  boardLoading: boolean;
  /** Fixtures the board fetched and dropped for want of history to forecast. */
  skipped: number;
  onRefreshBoard: () => void;
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
  usedFixtures: Set<number>;
  saving: boolean;
  onPlace: (legs: PlanLeg[], odds: number, stake: number) => void;
}) {
  const [legs, setLegs] = useState<Draft[]>([]);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  const [manual, setManual] = useState({
    home: "",
    away: "",
    market: "",
    odds: "",
  });
  const [manualOpen, setManualOpen] = useState(false);
  const [stakeInput, setStakeInput] = useState<string | null>(null);
  /** The picker lives in a pop-up: the slip is what the page is for. */
  const [pickerOpen, setPickerOpen] = useState(false);
  /** Which competition the list is narrowed to, or all of them. */
  const [league, setLeague] = useState<string | null>(null);
  const [health, setHealth] = useState<LeagueHealthReport | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    if (openSignal) setPickerOpen(true);
  }, [openSignal]);

  const askHealth = useCallback(() => {
    setHealthLoading(true);
    setHealthError(false);
    fetchLeagueHealth()
      .then(setHealth)
      .catch(() => setHealthError(true))
      .finally(() => setHealthLoading(false));
  }, []);

  // Asking is driven by "the panel is open and has no answer", not by the tap
  // that opened it. Tying it to the tap meant that clearing the answer — which
  // is exactly what the refresh button does — left the panel open on "A
  // perguntar..." with nothing on its way, and that a failed ask was never
  // retried for as long as the page stayed loaded.
  useEffect(() => {
    if (healthOpen && !health && !healthError && !healthLoading) askHealth();
  }, [healthOpen, health, healthError, healthLoading, askHealth]);

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

  const counts = useMemo(() => leagueCounts(board), [board]);

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...board]
      .filter((match) => !league || match.league === league)
      .filter(
        (match) =>
          !needle ||
          `${match.home_name} ${match.away_name} ${match.league}`
            .toLowerCase()
            .includes(needle),
      )
      .sort((a, b) => b.headline_pct - a.headline_pct)
      .slice(0, LIST_LIMIT);
  }, [board, league, search]);

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

  const addFromBoard = (match: BoardMatch, market: string, prob: number) => {
    setLegs((previous) => [
      ...previous,
      {
        key: `f${match.fixture_id}`,
        fixtureId: match.fixture_id,
        homeTeam: match.home_name,
        awayTeam: match.away_name,
        league: match.league,
        market,
        modelProb: prob,
        kickoff: match.kickoff,
        odds: "",
      },
    ]);
    setPicking(null);
    setSearch("");
    setPickerOpen(false);
  };

  const addManual = () => {
    const home = manual.home.trim();
    const away = manual.away.trim();
    const market = manual.market.trim();
    if (!home || !away || !market) return;

    setLegs((previous) => [
      ...previous,
      {
        key: `m${Date.now()}`,
        fixtureId: null,
        homeTeam: home,
        awayTeam: away,
        league: "Adicionado à mão",
        market,
        modelProb: 0,
        kickoff: null,
        odds: manual.odds,
      },
    ]);
    setManual({ home: "", away: "", market: "", odds: "" });
    setManualOpen(false);
    setPickerOpen(false);
  };

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

  const manualReady =
    manual.home.trim().length > 0 &&
    manual.away.trim().length > 0 &&
    manual.market.trim().length > 0;

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
            <div
              key={leg.key}
              className="flex items-center gap-2.5 px-4 py-2.5"
            >
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

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="text-sm font-bold">
              Inserir jogo
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Procurar equipa ou liga..."
                  className={`${field} pl-9`}
                />
              </div>

              {/* A competition can go missing for a minute — the provider
                  allows ten requests a minute and the board asks for eight.
                  Waiting out a cache to find out whether it came back is not
                  something anybody should have to do. */}
              <button
                type="button"
                onClick={() => {
                  setHealth(null);
                  setHealthError(false);
                  onRefreshBoard();
                }}
                disabled={boardLoading}
                aria-label="Procurar jogos novos"
                title="Procurar jogos novos"
                className="sl-tap flex h-10 w-10 flex-none items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${boardLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            <p className="sl-meta mt-1.5 text-[11px]">
              {boardLoading
                ? "A procurar jogos..."
                : `${board.length} jogos${
                    boardAt ? ` · atualizado ${freshness(boardAt)}` : ""
                  }${
                    skipped > 0
                      ? ` · ${skipped} sem histórico para prever`
                      : ""
                  }`}
            </p>

            {/* Every covered competition, zeroes included. The list below is
                ranked by probability, so a league could be on the board and
                never once appear on screen — from the outside, identical to
                the provider not sending it. This says which leagues are
                actually there, and gets to them in one tap. */}
            <div className="-mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => setLeague(null)}
                aria-pressed={league === null}
                className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[11px] font-semibold ${
                  league === null
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground ring-1 ring-border"
                }`}
              >
                Todas {board.length}
              </button>

              {counts.map((row) => (
                <button
                  key={row.league}
                  type="button"
                  disabled={row.count === 0}
                  onClick={() =>
                    setLeague((current) =>
                      current === row.league ? null : row.league,
                    )
                  }
                  aria-pressed={league === row.league}
                  aria-label={`${row.league}, ${row.count} ${
                    row.count === 1 ? "jogo" : "jogos"
                  }`}
                  className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-40 ${
                    league === row.league
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {row.league} {row.count}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[42vh] divide-y divide-border overflow-y-auto border-y border-border">
            {matches.map((match) => {
              const already = chosenIds.has(match.fixture_id);
              const used = usedFixtures.has(match.fixture_id);

              return (
                <div key={match.fixture_id}>
                  <button
                    type="button"
                    disabled={already || used}
                    onClick={() =>
                      setPicking((current) =>
                        current === match.fixture_id ? null : match.fixture_id,
                      )
                    }
                    className="sl-tap flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[hsl(var(--sl-surface))] disabled:opacity-40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-foreground">
                        {match.home_name} vs {match.away_name}
                      </p>
                      <p className="sl-meta truncate text-[11px]">
                        {MARKET_LABELS[match.headline_market] ??
                          match.headline_market}{" "}
                        {match.headline_pct.toFixed(0)}% ·{" "}
                        {kickoffTime(match.kickoff)}
                      </p>
                    </div>
                    <span
                      className={`flex h-7 w-7 flex-none items-center justify-center rounded-lg ${
                        already || used
                          ? "text-[hsl(var(--sl-green))]"
                          : "border border-primary/40 text-primary"
                      }`}
                    >
                      {already || used ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>

                  {picking === match.fixture_id && (
                    <MarketPicker
                      match={match}
                      onClose={() => setPicking(null)}
                      onPick={(market, prob) =>
                        addFromBoard(match, market, prob)
                      }
                    />
                  )}
                </div>
              );
            })}

            {matches.length === 0 && (
              <p className="px-4 py-3 text-xs text-muted-foreground">
                {search
                  ? "Nenhum jogo do quadro com esse nome. Podes adicioná-lo à mão."
                  : league
                    ? `Sem jogos do ${league} nos próximos dias. Vê "Que ligas estão a dar jogos?" para saber porquê.`
                    : "Sem jogos no quadro neste momento. Adiciona à mão o que apostaste."}
              </p>
            )}
          </div>

          <div className="px-4 py-3">
            {manualOpen ? (
              <div className="space-y-2 rounded-lg border border-border bg-[hsl(var(--sl-surface))] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Jogo à mão
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={manual.home}
                    onChange={(event) =>
                      setManual({ ...manual, home: event.target.value })
                    }
                    placeholder="Equipa casa"
                    className={field}
                  />
                  <input
                    value={manual.away}
                    onChange={(event) =>
                      setManual({ ...manual, away: event.target.value })
                    }
                    placeholder="Equipa fora"
                    className={field}
                  />
                </div>
                <div className="grid grid-cols-[1fr_88px] gap-2">
                  <input
                    value={manual.market}
                    onChange={(event) =>
                      setManual({ ...manual, market: event.target.value })
                    }
                    placeholder="A tua aposta (ex: Casa, Mais de 1.5)"
                    className={field}
                  />
                  <input
                    inputMode="decimal"
                    value={manual.odds}
                    onChange={(event) =>
                      setManual({ ...manual, odds: event.target.value })
                    }
                    placeholder="Odd"
                    className={`${field} text-center font-mono-data`}
                  />
                </div>
                <p className="sl-meta text-[11px] leading-relaxed">
                  Um jogo que o site não conhece não tem resultado para ir
                  buscar: és tu que dizes depois se entrou.
                </p>
                <div className="flex gap-2">
                  <Button
                    className="sl-btn-primary h-9 flex-1 text-xs disabled:opacity-40"
                    disabled={!manualReady}
                    onClick={addManual}
                  >
                    Juntar ao boletim
                  </Button>
                  <button
                    type="button"
                    onClick={() => setManualOpen(false)}
                    className="h-9 flex-none rounded-lg border border-border px-3 text-xs font-semibold text-muted-foreground"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-primary"
              >
                <PenLine className="h-3.5 w-3.5" />
                Adicionar um jogo à mão
              </button>
            )}

            {/* A competition that fails is dropped from the board on purpose,
                so one outage cannot hide the other seven. Saying nothing about
                it is how a whole league goes missing for days. */}
            {unavailable.length > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-700">
                Sem resposta da fonte de dados para: {unavailable.join(", ")}.
                Esses jogos não estão aqui.
              </p>
            )}

            <button
              type="button"
              onClick={() => setHealthOpen((open) => !open)}
              className="sl-meta mt-2 flex w-full items-center justify-center gap-1.5 text-[11px] underline"
            >
              <Info className="h-3 w-3" />
              Que ligas estão a dar jogos?
            </button>

            {healthOpen && (
              <div className="mt-2 space-y-1.5 rounded-lg border border-border bg-[hsl(var(--sl-surface))] p-2.5">
                {healthError && (
                  <div className="space-y-1.5">
                    <p className="sl-meta text-[11px]">
                      Não foi possível perguntar à fonte de dados agora.
                    </p>
                    <button
                      type="button"
                      onClick={askHealth}
                      className="sl-tap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-primary ring-1 ring-border"
                    >
                      Tentar outra vez
                    </button>
                  </div>
                )}
                {healthLoading && (
                  <p className="sl-meta text-[11px]">A perguntar...</p>
                )}
                {health &&
                  byUrgency(health.leagues).map((row) => (
                    <div key={row.league} className="flex items-start gap-2">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${
                          !row.ok
                            ? "bg-destructive"
                            : row.within_days > 0
                              ? "bg-[hsl(var(--sl-green))]"
                              : "bg-muted-foreground/40"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-foreground">
                          {row.league}
                        </p>
                        <p className="sl-meta text-[10px] leading-4">
                          {describeHealth(row)}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
