import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Info, PenLine, Plus, RefreshCw, Search } from "lucide-react";
import { MarketField } from "@/components/MarketField";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { leagueCounts } from "@/lib/boardLeagues";
import { freshness } from "@/lib/freshness";
import {
  byUrgency,
  describeHealth,
  fetchLeagueHealth,
  fetchProviderCompetitions,
  type LeagueHealthReport,
  type ProviderCatalogue,
} from "@/lib/leagueHealth";
import type { BoardMatch } from "@/lib/probabilityBoardCache";
import type { TypingMemory } from "@/lib/typingMemory";

// The list scrolls, so this is a guard against a pathological board rather
// than a shortlist: with the league chips above it, anything on the board is
// reachable in one tap even on a heavy weekend.
const LIST_LIMIT = 60;

const field =
  "h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30";

/** A game chosen here, before whoever asked for it decides what to do with it. */
export interface PickedGame {
  fixtureId: number | null;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  modelProb: number;
  kickoff: string | null;
  /** As typed, so "1," on the way to "1,85" does not get eaten. Empty for a
   *  game off the board, whose price is asked for afterwards. */
  odds: string;
}

/** Everything the picker needs to know about the board of games. */
export interface BoardAccess {
  board: BoardMatch[];
  /** When the games on screen were fetched, so their age is visible. */
  boardAt: number | null;
  boardLoading: boolean;
  /** Fixtures the board fetched and dropped for want of history to forecast. */
  skipped: number;
  /** Competitions the provider did not answer for on the last board fetch. */
  unavailable: string[];
  /** Every fixture already spoken for by an open bet. */
  usedFixtures: Set<number>;
  onRefreshBoard: () => void;
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
 * Choosing a game, wherever a game needs choosing.
 *
 * Two ways in, on purpose: a game the site knows brings its own forecast, and
 * a game it does not know brings nothing but the price the bookmaker is
 * offering. It was built into the composer, which meant a bet already
 * registered could have a game taken out of it but never put in.
 */
export function GamePicker({
  open,
  onOpenChange,
  access,
  memory,
  chosenIds,
  onPick,
  title = "Inserir jogo",
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  access: BoardAccess;
  /** What has already been typed on these slips, to offer back. */
  memory: TypingMemory;
  /** Fixtures already on whatever is being built, to show as taken. */
  chosenIds: Set<number>;
  onPick: (game: PickedGame) => void;
  title?: string;
  /** The caller's own bar at the bottom: what has been picked, and the way out. */
  footer?: ReactNode;
}) {
  const {
    board,
    boardAt,
    boardLoading,
    skipped,
    unavailable,
    usedFixtures,
    onRefreshBoard,
  } = access;

  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState<number | null>(null);
  const [manual, setManual] = useState({
    home: "",
    away: "",
    market: "",
    odds: "",
  });
  const [manualOpen, setManualOpen] = useState(false);
  /** Which competition the list is narrowed to, or all of them. */
  const [league, setLeague] = useState<string | null>(null);
  const [health, setHealth] = useState<LeagueHealthReport | null>(null);
  const [healthOpen, setHealthOpen] = useState(false);
  const [healthError, setHealthError] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [catalogue, setCatalogue] = useState<ProviderCatalogue | null>(null);
  const [catalogueOpen, setCatalogueOpen] = useState(false);

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

  useEffect(() => {
    if (!catalogueOpen || catalogue) return;
    fetchProviderCompetitions()
      .then(setCatalogue)
      .catch(() => undefined);
  }, [catalogueOpen, catalogue]);

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

  const addFromBoard = (match: BoardMatch, market: string, prob: number) => {
    onPick({
      fixtureId: match.fixture_id,
      homeTeam: match.home_name,
      awayTeam: match.away_name,
      league: match.league,
      market,
      modelProb: prob,
      kickoff: match.kickoff,
      odds: "",
    });
    setPicking(null);
    setSearch("");
    // The pop-up stays open. A slip is two or three games, and closing after
    // each one meant reopening it for every single game of every single bet.
  };

  const addManual = () => {
    const home = manual.home.trim();
    const away = manual.away.trim();
    const market = manual.market.trim();
    if (!home || !away || !market) return;

    onPick({
      fixtureId: null,
      homeTeam: home,
      awayTeam: away,
      league: "Adicionado à mão",
      market,
      modelProb: 0,
      kickoff: null,
      odds: manual.odds,
    });
    // Empty and still open, ready for the next one: every game these two have
    // ever bet was typed in here by hand, two or three at a time.
    setManual({ home: "", away: "", market: "", odds: "" });
  };

  const manualReady =
    manual.home.trim().length > 0 &&
    manual.away.trim().length > 0 &&
    manual.market.trim().length > 0;

  return (
  <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-4 py-3 text-left">
          <DialogTitle className="text-sm font-bold">{title}</DialogTitle>
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

        <div className="px-4 pb-3">
          {manualOpen ? (
            <div className="space-y-2 rounded-lg border border-border bg-[hsl(var(--sl-surface))] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Jogo à mão
              </p>
              {/* The same side went in as "Gales" and "País de Gales",
                  "Chequia" and "Chéquia". Each spelling is a team of its own
                  to anything that counts them, so what was typed before is
                  offered back. */}
              <datalist id="sl-equipas">
                {memory.teams.map((team) => (
                  <option key={team} value={team} />
                ))}
              </datalist>

              <div className="grid grid-cols-2 gap-2">
                <input
                  list="sl-equipas"
                  value={manual.home}
                  onChange={(event) =>
                    setManual({ ...manual, home: event.target.value })
                  }
                  placeholder="Equipa casa"
                  aria-label="Equipa da casa"
                  className={field}
                />
                <input
                  list="sl-equipas"
                  value={manual.away}
                  onChange={(event) =>
                    setManual({ ...manual, away: event.target.value })
                  }
                  placeholder="Equipa fora"
                  aria-label="Equipa de fora"
                  className={field}
                />
              </div>

              <MarketField
                value={manual.market}
                onChange={(market) => setManual({ ...manual, market })}
                used={memory.markets}
              />

              <div>
                <p className="sl-meta mb-1 text-[10px] uppercase tracking-[0.12em]">
                  Odd
                </p>
                <input
                  inputMode="decimal"
                  value={manual.odds}
                  onChange={(event) =>
                    setManual({ ...manual, odds: event.target.value })
                  }
                  placeholder="Odd"
                  aria-label="Odd do jogo à mão"
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

        {/* One scrolling region, not two.
            A list with its own height and its own overflow, inside a fixed
            pop-up that also scrolls, is the arrangement iOS Safari is known to
            refuse to scroll with a finger — and it was never worth much
            anyway: two nested scrollers on a phone means the drag that works
            depends on where it starts. The pop-up scrolls; the list is just a
            list. */}
        <div className="divide-y divide-border border-y border-border">
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
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {search
                  ? "Nenhum jogo do quadro com esse nome. Podes adicioná-lo à mão."
                  : league
                    ? `Sem jogos do ${league} nos próximos dias. Vê "Que ligas estão a dar jogos?" para saber porquê.`
                    : "Sem jogos no quadro neste momento. Pode ser só a fonte de dados a não responder agora."}
              </p>

              {/* An empty list is the one moment the button is actually
                  needed, and the icon beside the search box is small and
                  easy to miss. Say it in words, here. */}
              {!search && (
                <Button
                  className="sl-btn-primary sl-tap mt-3 h-10 w-full text-xs"
                  disabled={boardLoading}
                  onClick={onRefreshBoard}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${boardLoading ? "animate-spin" : ""}`}
                  />
                  {boardLoading
                    ? "A procurar jogos..."
                    : "Procurar jogos outra vez"}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3">

          {/* A competition that fails is dropped from the board on purpose,
              so one outage cannot hide the other seven. Saying nothing about
              it is how a whole league goes missing for days. */}
          {/* Naming the competitions and stopping there left somebody
              thinking the source was broken. The usual cause is the ten
              requests a minute the free plan allows, which twelve
              competitions cannot fit into — so the ones that missed out come
              back on the next try, and the try is right here. */}
          {unavailable.length > 0 && (
            <div className="mt-2 rounded-lg bg-amber-500/8 p-2.5 ring-1 ring-amber-500/25">
              <p className="text-[11px] leading-relaxed text-amber-700">
                Ficaram de fora desta vez: {unavailable.join(", ")}. A fonte
                só deixa passar dez pedidos por minuto e o quadro pede doze
                competições, por isso as últimas não couberam.
              </p>
              <button
                type="button"
                onClick={onRefreshBoard}
                disabled={boardLoading}
                className="sl-tap mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-card text-[11px] font-semibold text-foreground ring-1 ring-amber-500/30 disabled:opacity-40"
              >
                <RefreshCw
                  className={`h-3 w-3 ${boardLoading ? "animate-spin" : ""}`}
                />
                {boardLoading ? "A procurar..." : "Tentar trazer as que faltam"}
              </button>
            </div>
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
              {health && (
                <>
                  <button
                    type="button"
                    onClick={() => setCatalogueOpen((open) => !open)}
                    className="sl-meta w-full text-left text-[10px] underline"
                  >
                    {catalogueOpen
                      ? "Esconder o que a fonte oferece"
                      : "O que mais a fonte oferece?"}
                  </button>

                  {catalogueOpen && (
                    <div className="space-y-1 rounded-lg bg-card p-2 ring-1 ring-border">
                      {!catalogue && (
                        <p className="sl-meta text-[10px]">A perguntar...</p>
                      )}
                      {catalogue?.competitions
                        .filter((row) => !row.wired)
                        .map((row) => (
                          <p
                            key={row.code ?? row.name}
                            className="sl-meta text-[10px] leading-4"
                          >
                            {row.name}
                            {row.area ? ` · ${row.area}` : ""} — fora do quadro
                          </p>
                        ))}
                      {catalogue &&
                        catalogue.competitions.every((row) => row.wired) && (
                          <p className="sl-meta text-[10px]">
                            O quadro já usa tudo o que a chave dá.
                          </p>
                        )}
                    </div>
                  )}
                </>
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

        {footer}
      </DialogContent>
  </Dialog>
  );
}
