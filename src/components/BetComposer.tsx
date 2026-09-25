import { useMemo, useState } from "react";
import { Check, ListPlus, PenLine, Plus, Search, X } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  checkBet,
  plannedStake,
  stakePctForDay,
  type ChallengeRules,
} from "@/lib/challengeRules";
import { combineOdds, type PlanLeg } from "@/lib/planStore";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

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
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-primary/50"
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
  targetOdds,
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
  /** The odd the ladder pencils in for today, to aim the slip at. */
  targetOdds: number;
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

  const suggested = plannedStake(rules, bankroll, day);
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

  const matches = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const ranked = [...board].sort((a, b) => b.headline_pct - a.headline_pct);
    if (!needle) return ranked.slice(0, 12);
    return ranked
      .filter((match) =>
        `${match.home_name} ${match.away_name} ${match.league}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 20);
  }, [board, search]);

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

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/10 to-transparent px-4 py-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-primary font-mono-data text-xs font-bold text-white">
          {day}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-foreground">
            A aposta do dia {day}
          </h2>
          <p className="sl-meta truncate text-[11px]">
            {(stakePctForDay(rules, day) * 100).toFixed(0)}% da banca ={" "}
            {eur.format(suggested)}
            {targetOdds > 1 ? ` · odd a apontar ${targetOdds.toFixed(2)}` : ""}
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
                className="h-9 w-[68px] flex-none rounded-lg border border-primary/40 bg-card px-2 text-center font-mono-data text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
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

      {legs.length === 0 && (
        <p className="px-4 pt-3 text-xs leading-relaxed text-muted-foreground">
          Escolhe um jogo do quadro ou mete um à mão. Podem ser vários: as odds
          multiplicam-se e o valor a apostar sai do dia em que estás.
        </p>
      )}

      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-3 text-xs font-semibold text-primary transition hover:bg-primary/5"
        >
          <Plus className="h-4 w-4" />
          {legs.length === 0 ? "Inserir jogo" : "Inserir outro jogo"}
        </button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="text-sm font-bold">
              Inserir jogo
            </DialogTitle>
          </DialogHeader>

          <div className="px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Procurar equipa ou liga..."
                className={`${field} pl-9`}
              />
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
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left disabled:opacity-40"
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
          </div>
        </DialogContent>
      </Dialog>

      {legs.length > 0 && (
        <div className="space-y-2 border-t border-border bg-[hsl(var(--sl-surface))] p-4">
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-card px-3.5 py-3">
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
              <span className="font-mono-data text-2xl font-bold text-foreground">
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
            <label className="rounded-lg border border-border bg-card px-3 py-2">
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
            <div className="rounded-lg border border-[hsl(var(--sl-green))]/30 bg-[hsl(var(--sl-green))]/5 px-3 py-2">
              <span className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                Se entrar
              </span>
              <p className="mt-0.5 font-mono-data text-sm font-bold text-[hsl(var(--sl-green))]">
                {ready ? eur.format(stake * combined) : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
            <span className="sl-meta text-[11px]">Banca depois, se entrar</span>
            <span className="font-mono-data text-sm font-bold text-foreground">
              {ready ? eur.format(bankroll + stake * (combined - 1)) : "—"}
            </span>
          </div>

          {stakeInput !== null && Math.abs(stake - suggested) > 0.01 && (
            <button
              type="button"
              onClick={() => setStakeInput(null)}
              className="sl-meta text-[11px] underline"
            >
              Voltar ao valor do desafio ({eur.format(suggested)})
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
