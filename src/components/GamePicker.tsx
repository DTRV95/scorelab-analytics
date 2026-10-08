import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Info,
  PenLine,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
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

function stamp(kickoff: string | null): number {
  if (!kickoff) return Number.POSITIVE_INFINITY;
  const at = new Date(kickoff).getTime();
  return Number.isNaN(at) ? Number.POSITIVE_INFINITY : at;
}

/** Which day a kickoff falls on, as a key the list can group by. */
function dayKey(kickoff: string | null): string {
  if (!kickoff) return "sem-data";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "sem-data";
  return date.toDateString();
}

/**
 * The same day, short enough for a tab: "sáb, 04/10".
 *
 * The heading above a list has the room for "sábado, 04/10"; a row of tabs on
 * a phone does not, and a tab wide enough to need scrolling to read is a tab
 * nobody taps.
 */
function dayTabLabel(kickoff: string | null): string {
  const long = dayLabel(kickoff);
  if (long === "Hoje" || long === "Amanhã" || long === "Sem data") return long;

  const date = new Date(kickoff as string);
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
    .format(date)
    .replace(".", "");
}

/**
 * The day a game is played, named the way somebody would say it.
 *
 * "Hoje" and "Amanhã" rather than a date, because those are the two that
 * decide whether a game is still bettable this evening.
 */
function dayLabel(kickoff: string | null): string {
  if (!kickoff) return "Sem data";

  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "Sem data";

  const midnight = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((midnight(date) - midnight(new Date())) / 86400000);

  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";

  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

/** Just the hour: the heading above the run of games already said the day. */
function kickoffTime(kickoff: string | null) {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * The other markets of one board game.
 *
 * The market the model likes best goes in with the tap on the game itself — it
 * is what gets backed nine times out of ten, and asking "em que apostas?"
 * every single time cost a second tap per game on every bet ever registered.
 * This is for the tenth time, and it leaves out the one already on the row.
 */
function MarketPicker({
  match,
  onPick,
}: {
  match: BoardMatch;
  onPick: (market: string, prob: number) => void;
}) {
  const markets = [...(match.mercados ?? [])]
    .filter((market) => market.mercado !== match.headline_market)
    .sort((a, b) => b.probabilidade_pct - a.probabilidade_pct);

  return (
    <div className="border-t border-border bg-[hsl(var(--sl-surface))] px-4 py-3">
      <div className="grid grid-cols-2 gap-1.5">
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
            Este jogo não trouxe outros mercados.
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
  /**
   * Which day the list is showing: a day key, "todos" for every day at once,
   * or null for "nothing chosen yet", which the first board to arrive fills
   * in. The three are different on purpose — without the third, choosing
   * "todos" was indistinguishable from never having chosen, and the list
   * jumped straight back to the first day.
   */
  const [day, setDay] = useState<string | "todos" | null>(null);
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

  /** The games of the chosen competition, whatever day they fall on. */
  const inLeague = useMemo(() => {
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
      // In the order they are played, which is the order somebody picking
      // today's bet reads them in. Ranked by the model's confidence instead,
      // a game on Sunday sat above one kicking off in an hour, and nothing on
      // screen said why. The forecast only breaks a tie between two games
      // starting at the same minute; a fixture with no kickoff goes last,
      // because an unknown time cannot be put anywhere honestly.
      .sort((a, b) => {
        const left = stamp(a.kickoff);
        const right = stamp(b.kickoff);
        if (left !== right) return left - right;
        return b.headline_pct - a.headline_pct;
      });
  }, [board, league, search]);

  /** The days with games in them, in the order they are played. */
  const days = useMemo(() => {
    const rows: { key: string; label: string; count: number }[] = [];
    for (const match of inLeague) {
      const key = dayKey(match.kickoff);
      const found = rows.find((row) => row.key === key);
      if (found) found.count += 1;
      else rows.push({ key, label: dayTabLabel(match.kickoff), count: 1 });
    }
    return rows;
  }, [inLeague]);

  // Opens on the first day that has games, which is the one somebody
  // registering today's bet is looking at. A day that empties out — the games
  // played, or the competition changed — hands the list back to the next one
  // rather than showing nothing.
  useEffect(() => {
    if (days.length === 0) return;
    if (day === "todos") return;
    if (day !== null && days.some((row) => row.key === day)) return;
    setDay(days[0].key);
  }, [days, day]);

  // A search spans every day: hiding a match because it is on Sunday would be
  // answering a question nobody asked.
  const searching = search.trim().length > 0;

  /**
   * The list on screen: one day, by competition.
   *
   * Seven days of a dozen competitions at once was the wall. With a day
   * chosen the list is short enough to be grouped by competition, which is
   * the shape anybody who has opened a results site already knows. The
   * competitions keep the order of their first kickoff, so the one playing
   * next is still the one on top.
   *
   * Searching, or asking for every day, hands back the plain chronological
   * list: a search that hid Sunday would be answering a question nobody
   * asked.
   */
  const byLeague = !searching && day !== null && day !== "todos";

  const matches = useMemo(() => {
    const picked = inLeague.filter(
      (match) =>
        searching || !day || day === "todos" || dayKey(match.kickoff) === day,
    );

    if (!byLeague) return picked.slice(0, LIST_LIMIT);

    const order = new Map<string, number>();
    picked.forEach((match) => {
      if (!order.has(match.league)) order.set(match.league, order.size);
    });

    return [...picked]
      .sort(
        (a, b) =>
          (order.get(a.league) ?? 0) - (order.get(b.league) ?? 0) ||
          stamp(a.kickoff) - stamp(b.kickoff),
      )
      .slice(0, LIST_LIMIT);
  }, [inLeague, day, searching, byLeague]);

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

          {/* One day at a time, because seven days of a dozen competitions is
              a list nobody reads to the end. */}
          {days.length > 1 && (
            <div className="-mx-4 mt-1.5 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {days.map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setDay(row.key)}
                  aria-pressed={!searching && day === row.key}
                  className={`sl-tap flex-none rounded-full px-3 py-1 text-[11px] font-semibold ${
                    !searching && day === row.key
                      ? "bg-foreground text-background"
                      : "text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {row.label} {row.count}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDay("todos")}
                aria-pressed={!searching && day === "todos"}
                className={`sl-tap flex-none rounded-full px-3 py-1 text-[11px] font-semibold ${
                  !searching && day === "todos"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground ring-1 ring-border"
                }`}
              >
                Todos {inLeague.length}
              </button>
            </div>
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
          {matches.map((match, index) => {
            const already = chosenIds.has(match.fixture_id);
            const used = usedFixtures.has(match.fixture_id);
            // A heading whenever the group changes: the competition when a
            // day is chosen, the day itself when they are all on screen.
            const previous = matches[index - 1];
            const heading =
              byLeague
                ? index === 0 || previous.league !== match.league
                  ? match.league
                  : null
                : index === 0 || dayKey(previous.kickoff) !== dayKey(match.kickoff)
                  ? dayLabel(match.kickoff)
                  : null;

            return (
              <div key={match.fixture_id}>
                {heading && (
                  <p className="sl-meta bg-[hsl(var(--sl-surface))] px-4 py-1.5 text-[10px] uppercase tracking-[0.13em]">
                    {heading}
                  </p>
                )}
                <div className="flex items-stretch">
                  {/* The tap on the game is the whole choice: it goes onto the
                      slip with the market the model likes best, priced in the
                      strip at the bottom without this list moving. */}
                  <button
                    type="button"
                    disabled={already || used}
                    onClick={() =>
                      addFromBoard(
                        match,
                        match.headline_market,
                        match.headline_pct,
                      )
                    }
                    aria-label={`Juntar ${match.home_name} vs ${match.away_name} em ${
                      MARKET_LABELS[match.headline_market] ??
                      match.headline_market
                    }`}
                    className="sl-tap flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-[hsl(var(--sl-surface))] disabled:opacity-40"
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

                  {/* The other fourteen markets, for the bet that is not the
                      obvious one. */}
                  {!already && !used && (
                    <button
                      type="button"
                      onClick={() =>
                        setPicking((current) =>
                          current === match.fixture_id
                            ? null
                            : match.fixture_id,
                        )
                      }
                      aria-expanded={picking === match.fixture_id}
                      aria-label={`Outros mercados de ${match.home_name} vs ${match.away_name}`}
                      className="sl-tap flex w-10 flex-none items-center justify-center border-l border-border text-muted-foreground hover:bg-[hsl(var(--sl-surface))]"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          picking === match.fixture_id ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )}
                </div>

                {picking === match.fixture_id && (
                  <MarketPicker
                    match={match}
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
