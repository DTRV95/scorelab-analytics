import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  Layers3,
  ListFilter,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SectionCard, FormField, SelectField } from "@/components/AnalysisFormControls";
import { TodayMatches, dayKey, dayLabels, timeLabel } from "@/components/TodayMatches";
import { LeagueCalibration } from "@/components/LeagueCalibration";
import {
  ProbabilityBreakdown,
  MARKET_LABELS,
  type ProbabilityResult,
} from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  DEFAULT_LEAGUE_KEY,
  LEAGUE_PRESETS,
  LEAGUE_PRESET_MAP,
} from "@/lib/leaguePresets";
import {
  fetchPrefill,
  MatchForm,
  type PrefillForm,
} from "@/components/MatchForm";
import { loadBoard } from "@/lib/boardSource";
import {
  readCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";
import { matchTips, type MatchTip } from "@/lib/matchTips";
import { useLeagueRates } from "@/hooks/useLeagueRates";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const BOARD_DAYS = 7;

interface FormData {
  equipa_casa: string;
  equipa_fora: string;
  liga: string;

  jogos_casa: string;
  golos_marcados_casa: string;
  golos_sofridos_casa: string;
  jogos_casa_rec: string;
  golos_marcados_casa_rec: string;
  golos_sofridos_casa_rec: string;

  jogos_fora: string;
  golos_marcados_fora: string;
  golos_sofridos_fora: string;
  jogos_fora_rec: string;
  golos_marcados_fora_rec: string;
  golos_sofridos_fora_rec: string;

  league_home_goals_avg: string;
  league_away_goals_avg: string;
  dixon_coles_rho: string;
  shrinkage_matches: string;
}

const initialFormData: FormData = {
  equipa_casa: "",
  equipa_fora: "",
  liga: DEFAULT_LEAGUE_KEY,

  jogos_casa: "0",
  golos_marcados_casa: "0",
  golos_sofridos_casa: "0",
  jogos_casa_rec: "0",
  golos_marcados_casa_rec: "0",
  golos_sofridos_casa_rec: "0",

  jogos_fora: "0",
  golos_marcados_fora: "0",
  golos_sofridos_fora: "0",
  jogos_fora_rec: "0",
  golos_marcados_fora_rec: "0",
  golos_sofridos_fora_rec: "0",

  ...LEAGUE_PRESET_MAP[DEFAULT_LEAGUE_KEY],
};

function kickoffTime(kickoff: string | null) {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return timeLabel(date);
}

/**
 * What this game has that an ordinary game of its league does not.
 *
 * Read while browsing, not while betting: the forecast was already on the row
 * and the league's own rate was on another page, so a 62% had no scale to be
 * read against.
 */
function Tips({ tips, league }: { tips: MatchTip[]; league: string }) {
  if (tips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-[hsl(var(--sl-green))]/5 px-4 py-2">
      <Sparkles className="h-3 w-3 flex-none text-[hsl(var(--sl-green))]" />
      {tips.map((tip) => (
        <span
          key={tip.market}
          className="text-[11px] leading-5 text-foreground"
          title={`${league}: ${tip.leaguePct}% dos jogos`}
        >
          <span className="font-semibold">
            {MARKET_LABELS[tip.market] ?? tip.market}
          </span>{" "}
          <span className="sl-figure">{tip.modelPct}%</span>
          <span className="sl-meta"> · a liga dá {tip.leaguePct}%</span>
        </span>
      ))}
    </div>
  );
}

function BoardMatchRow({
  match,
  tips,
  isExpanded,
  onToggle,
  onContinue,
}: {
  match: BoardMatch;
  /** Where this game stands out from its own competition. */
  tips: MatchTip[];
  isExpanded: boolean;
  onToggle: () => void;
  onContinue: () => void;
}) {
  const [prefill, setPrefill] = useState<PrefillForm | null>(null);
  const [asking, setAsking] = useState(false);

  // Asked for the moment the row opens, and only then: fifteen rows on screen
  // are fifteen requests nobody wanted. Held for the session afterwards, so
  // closing and reopening is instant.
  useEffect(() => {
    if (!isExpanded || prefill) return;

    let cancelled = false;
    setAsking(true);
    fetchPrefill(match.league, match.fixture_id)
      .then((data) => {
        if (!cancelled && data) setPrefill(data);
      })
      .finally(() => {
        if (!cancelled) setAsking(false);
      });

    return () => {
      cancelled = true;
    };
    // Deliberately not watching `asking`: it is set inside this effect, and
    // reacting to it re-ran the effect, whose cleanup then cancelled the
    // request it had just made. The row sat on "A ler a época..." for ever.
  }, [isExpanded, prefill, match.league, match.fixture_id]);

  return (
    <article className="sl-card sl-card-interactive overflow-hidden">
      {/* One number per row on purpose. An earlier version also showed a
          1/X/2 strip, which left two different percentages competing for the
          same glance — the strongest outcome and the strongest market are
          rarely the same line. The full set is one tap away, and so is how
          much history backs it: the sample badge used to sit here too, a
          second verdict on a line that only has room for one. */}
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {match.home_name} vs {match.away_name}
          </p>
          <p className="sl-meta truncate text-[11px]">
            {kickoffTime(match.kickoff)}
          </p>
        </div>

        <div className="max-w-[52%] flex-none text-right">
          <p className="sl-meta text-[11px] leading-snug">
            {MARKET_LABELS[match.headline_market] ?? match.headline_market}
          </p>
          <p className="font-mono-data text-lg font-bold text-[hsl(var(--sl-green))]">
            {match.headline_pct.toFixed(1)}%
          </p>
        </div>
      </button>

      <Tips tips={tips} league={match.league} />

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border bg-[hsl(var(--sl-surface))] px-3.5 py-4 sm:px-4">
              {/* What the forecast was built from, before the forecast
                  itself. A probability nobody can look behind is a number to
                  be believed, and this was two taps and a page away. */}
              <section>
                <p className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
                  <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                  A forma por trás do número
                </p>
                <p className="sl-meta mt-0.5 text-[11px] leading-5">
                  Golos por jogo, por lado, na época e nos últimos jogos.
                </p>

                <div className="mt-2.5">
                  {prefill ? (
                    <MatchForm prefill={prefill} match={match} />
                  ) : (
                    <p className="sl-meta flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3 text-[11px]">
                      {asking ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />A ler a
                          época destas equipas...
                        </>
                      ) : (
                        "A época destas equipas não veio desta vez."
                      )}
                    </p>
                  )}
                </div>
              </section>

              <ProbabilityBreakdown data={match} />

              <div className="rounded-xl border border-border bg-card p-3.5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Queres ver o jogo todo? A análise avançada abre-o numa página
                  só dele, com as tuas odds em cada mercado para dizer onde
                  está o valor, e como o modelo se tem portado nestes mercados.
                </p>
                <Button
                  className="sl-btn-primary mt-3 h-10 w-full gap-2 text-xs"
                  onClick={onContinue}
                >
                  Análise avançada
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

/** Go and ask the provider again, now, ignoring anything already stored. */
function SearchAgain({
  loading,
  onClick,
}: {
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      className="sl-btn-primary sl-tap mt-3 h-10 w-full text-xs sm:w-auto sm:px-5"
      disabled={loading}
      onClick={onClick}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "A procurar jogos..." : "Procurar jogos outra vez"}
    </Button>
  );
}

/**
 * The odds-free half of an analysis: what the model thinks will happen,
 * before ever looking at a bookmaker's price. This never becomes a bet on
 * its own — for value, stake and a decision, the same data continues into
 * Match Analysis once real odds are on the table.
 */
export default function ProbabilityRadar() {
  const navigate = useNavigate();

  // The auto-ranked board: the primary view, no match-picking required.
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [board, setBoard] = useState<BoardMatch[]>([]);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [unavailableLeagues, setUnavailableLeagues] = useState<string[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  // What each competition has given this season, to read every forecast on
  // this page against. One request for all of them, held for the session.
  const rates = useLeagueRates();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeDay, setActiveDay] = useState(0);
  // Closed by default on phones so the actual board — the reason someone
  // opens this page — isn't pushed below the fold by an explainer paragraph.
  const [infoOpen, setInfoOpen] = useState(
    () => typeof window === "undefined" || window.innerWidth >= 768
  );

  // The manual path: kept for leagues or matchups the auto board can't cover.
  const [manualOpen, setManualOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [manualResult, setManualResult] = useState<ProbabilityResult | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  // reloadToken only advances when the user hits refresh — a plain remount
  // (navigating away and back) always leaves it at 0.
  const isManualRefresh = reloadToken > 0;

  /** Ask the provider again now, whatever is stored. */
  const searchAgain = () => setReloadToken((token) => token + 1);

  useEffect(() => {
    // A fresh cached board proves the backend answered recently — skip the
    // status round trip entirely and let the board effect serve the cache.
    if (!isManualRefresh && readCachedBoard(BOARD_DAYS)) {
      setEnabled(true);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);

    // Last night's board, from the database, settles the question without
    // waking anything: a board that exists is proof enough that the engine
    // is set up, and asking it to confirm that cost the page a minute of
    // "A ligar ao motor de dados..." every time it had been left alone.
    if (!isManualRefresh) {
      void loadBoard(BOARD_DAYS)
        .then((data) => {
          if (cancelled) return;
          if (data.matches.length > 0) {
            setEnabled(true);
            window.clearTimeout(timeout);
            return;
          }
          probeStatus();
        })
        .catch(() => {
          if (!cancelled) probeStatus();
        });
    } else {
      probeStatus();
    }

    function probeStatus() {
      if (cancelled) return;
      fetch(buildApiUrl("/data/status"), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data?.configured));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      })
      .finally(() => window.clearTimeout(timeout));
    }

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [reloadToken, isManualRefresh]);

  useEffect(() => {
    if (!enabled) return;

    // Once loaded for these days, stay loaded: reopening the tab (or the
    // whole browser, within the cache window) shows the same board
    // instantly instead of recomputing it. Only an explicit refresh, or the
    // cache going stale, triggers a real fetch again.
    // The stored copy is read on the spot, not through a promise: reopening
    // the tab should paint the board in the same breath, with no frame of
    // emptiness in between.
    if (!isManualRefresh) {
      const cached = readCachedBoard(BOARD_DAYS);
      if (cached) {
        setBoard(cached.matches);
        setUnavailableLeagues(cached.unavailable);
        setSkippedCount(cached.skipped);
        setBoardLoading(false);
        setBoardError("");
        return;
      }
    }

    let cancelled = false;
    setBoardLoading(true);
    setBoardError("");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);

    // Then the board last night's job left in the database, and only then
    // the engine — which sleeps, takes a minute to wake, and is what this
    // page used to wait for every single day.
    loadBoard(BOARD_DAYS, { force: isManualRefresh, signal: controller.signal })
      .then((data) => {
        if (cancelled) return;
        setBoard(data.matches);
        setUnavailableLeagues(data.unavailable);
        setSkippedCount(data.skipped);
      })
      .catch((err: Error) => {
        if (!cancelled) setBoardError(err.message);
      })
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
        window.clearTimeout(timeout);
      });

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [enabled, reloadToken, isManualRefresh]);

  // Grouped by day first, then by league — matches inside each league stay in
  // the order the board already sorted them, chronologically by kickoff.
  const dayGroups = useMemo(() => {
    const groups = new Map<
      string,
      { short: string; long: string; items: BoardMatch[] }
    >();

    board.forEach((match) => {
      if (!match.kickoff) return;
      const date = new Date(match.kickoff);
      if (Number.isNaN(date.getTime())) return;
      const key = dayKey(date);
      if (!groups.has(key)) groups.set(key, { ...dayLabels(date), items: [] });
      groups.get(key)!.items.push(match);
    });

    return [...groups.values()];
  }, [board]);

  const currentDay = dayGroups[Math.min(activeDay, Math.max(dayGroups.length - 1, 0))];

  const leagueGroups = useMemo(() => {
    if (!currentDay) return [];

    const groups = new Map<string, BoardMatch[]>();
    currentDay.items.forEach((match) => {
      if (!groups.has(match.league)) groups.set(match.league, []);
      groups.get(match.league)!.push(match);
    });

    return [...groups.entries()].map(([league, items]) => ({ league, items }));
  }, [currentDay]);

  // Straight to the match's own page: the board already holds everything it
  // needs, so there is nothing to fetch and prefill on the way out.
  const openDeepDive = (match: BoardMatch) =>
    navigate(`/match/${match.fixture_id}`);

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleLeagueChange = (league: string) => {
    const preset = LEAGUE_PRESET_MAP[league];
    setFormData((prev) => ({ ...prev, liga: league, ...(preset ?? {}) }));
  };

  const readyForStats =
    Number(formData.jogos_casa) > 0 && Number(formData.jogos_fora) > 0;

  const runManualProbability = async () => {
    setManualLoading(true);
    setManualError("");
    setManualResult(null);

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 90_000);

      const response = await fetch(buildApiUrl("/analyze/probabilities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          equipa_casa: formData.equipa_casa || "Casa",
          equipa_fora: formData.equipa_fora || "Fora",
          liga: formData.liga,
          jogos_casa: Number(formData.jogos_casa),
          golos_marcados_casa: Number(formData.golos_marcados_casa),
          golos_sofridos_casa: Number(formData.golos_sofridos_casa),
          jogos_casa_rec: Number(formData.jogos_casa_rec),
          golos_marcados_casa_rec: Number(formData.golos_marcados_casa_rec),
          golos_sofridos_casa_rec: Number(formData.golos_sofridos_casa_rec),
          jogos_fora: Number(formData.jogos_fora),
          golos_marcados_fora: Number(formData.golos_marcados_fora),
          golos_sofridos_fora: Number(formData.golos_sofridos_fora),
          jogos_fora_rec: Number(formData.jogos_fora_rec),
          golos_marcados_fora_rec: Number(formData.golos_marcados_fora_rec),
          golos_sofridos_fora_rec: Number(formData.golos_sofridos_fora_rec),
          league_home_goals_avg: Number(formData.league_home_goals_avg),
          league_away_goals_avg: Number(formData.league_away_goals_avg),
          dixon_coles_rho: Number(formData.dixon_coles_rho),
          shrinkage_matches: Number(formData.shrinkage_matches),
        }),
      });
      window.clearTimeout(timeout);

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.detail?.[0]?.msg || data?.detail || "Falha ao calcular a probabilidade.");
      }

      setManualResult(data as ProbabilityResult);
    } catch (error) {
      console.error(error);
      setManualError(
        "Não foi possível contactar o motor de análise. Se estiver parado há algum tempo, pode demorar até um minuto a acordar — tenta novamente daqui a instantes."
      );
    } finally {
      setManualLoading(false);
    }
  };

  const continueManualToValueAnalysis = () => {
    navigate("/analysis", {
      state: {
        prefill: {
          liga: formData.liga,
          equipa_casa: formData.equipa_casa,
          equipa_fora: formData.equipa_fora,
          jogos_casa: formData.jogos_casa,
          golos_marcados_casa: formData.golos_marcados_casa,
          golos_sofridos_casa: formData.golos_sofridos_casa,
          jogos_casa_rec: formData.jogos_casa_rec,
          golos_marcados_casa_rec: formData.golos_marcados_casa_rec,
          golos_sofridos_casa_rec: formData.golos_sofridos_casa_rec,
          jogos_fora: formData.jogos_fora,
          golos_marcados_fora: formData.golos_marcados_fora,
          golos_sofridos_fora: formData.golos_sofridos_fora,
          jogos_fora_rec: formData.jogos_fora_rec,
          golos_marcados_fora_rec: formData.golos_marcados_fora_rec,
          golos_sofridos_fora_rec: formData.golos_sofridos_fora_rec,
          league_home_goals_avg: formData.league_home_goals_avg,
          league_away_goals_avg: formData.league_away_goals_avg,
        },
      },
    });
  };

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-4 p-4 sm:space-y-6 sm:p-5 md:p-6"
      >
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {/* Fourteen wide letters at 21px do not fit beside a button on a
                phone: the word ran under the refresh icon. */}
            <h1 className="sl-section-title text-[17px] sm:text-[21px]">
              Probabilidades
            </h1>
            {/* One line, so the first game is on screen without scrolling.
                The two-line version plus the how-to card put four hundred
                pixels of explanation above the thing being explained. */}
            <p className="sl-meta mt-1">Os próximos 7 dias, sem odds nem stake.</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-none rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Procurar jogos outra vez"
            aria-label="Procurar jogos outra vez"
            disabled={boardLoading}
            onClick={searchAgain}
          >
            <RefreshCw className={`h-4 w-4 ${boardLoading ? "animate-spin" : ""}`} />
          </Button>
        </motion.div>

        {enabled === null && (
          <motion.div
            variants={fadeUp}
            className="sl-card flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            A ligar ao motor de dados... pode demorar até um minuto se estiver
            parado há algum tempo.
          </motion.div>
        )}

        {/* Without this the page went silent when the engine did not answer:
            no board, no message, nothing to press. */}
        {enabled === false && (
          <motion.div variants={fadeUp} className="sl-card px-4 py-4">
            <p className="text-sm text-muted-foreground">
              O motor de dados não respondeu. Pode estar a arrancar — costuma
              demorar até um minuto quando esteve parado.
            </p>
            <SearchAgain loading={boardLoading} onClick={searchAgain} />
          </motion.div>
        )}

        {enabled === true && (
          <motion.div variants={fadeUp} className="space-y-4">
            {boardLoading && board.length === 0 && (
              <p className="sl-card flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> A calcular
                probabilidades para todos os jogos dos próximos 7 dias...
              </p>
            )}

            {boardError && (
              <div className="rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-3">
                <p className="text-xs font-medium text-destructive">
                  {boardError}
                </p>
                <SearchAgain loading={boardLoading} onClick={searchAgain} />
              </div>
            )}

            {/* The button belongs here, next to the sentence that sends
                someone looking for it. The icon up in the header is easy to
                miss and a long way from the only place on the page that says
                anything went wrong. */}
            {!boardLoading && !boardError && board.length === 0 && (
              <div className="sl-card px-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Sem jogos analisáveis nos próximos dias nas ligas com dados
                  automáticos. Pode ser só a fonte de dados a não responder
                  agora — procura outra vez.
                </p>
                <SearchAgain loading={boardLoading} onClick={searchAgain} />
              </div>
            )}

            {dayGroups.length > 0 && (
                <>
                  <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                    {dayGroups.map((day, index) => {
                      const isActive = index === Math.min(activeDay, dayGroups.length - 1);
                      return (
                        <button
                          key={day.long}
                          type="button"
                          data-active={isActive}
                          onClick={() => setActiveDay(index)}
                          className="sl-chip flex-none capitalize"
                        >
                          {day.short}
                          <span className="text-[11px] opacity-65">
                            {day.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 space-y-5">
                    {leagueGroups.map(({ league, items }) => (
                      <div key={league} className="space-y-2">
                        <p className="flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[-0.01em] text-foreground">
                          {league}
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold normal-case tracking-normal text-muted-foreground">
                            {items.length}
                          </span>
                        </p>
                        <div className="space-y-2">
                          {items.map((match) => (
                            <BoardMatchRow
                              key={match.fixture_id}
                              match={match}
                              tips={matchTips(
                                match.mercados,
                                rates.get(match.league),
                              )}
                              isExpanded={expandedId === match.fixture_id}
                              onToggle={() =>
                                setExpandedId(
                                  expandedId === match.fixture_id
                                    ? null
                                    : match.fixture_id
                                )
                              }
                              onContinue={() => openDeepDive(match)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {(skippedCount > 0 || unavailableLeagues.length > 0) && (
                <p className="mt-3 flex items-start gap-2 text-[11px] text-muted-foreground">
                  <ListFilter className="mt-0.5 h-3 w-3 flex-none" />
                  <span>
                    {skippedCount > 0 &&
                      `${skippedCount} jogo${skippedCount === 1 ? "" : "s"} sem histórico suficiente ficaram de fora. `}
                    {unavailableLeagues.length > 0 &&
                      `Sem resposta de: ${unavailableLeagues.join(", ")}.`}
                  </span>
                </p>
              )}
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="sl-card">
          <button
            type="button"
            onClick={() => setInfoOpen((open) => !open)}
            className="flex w-full items-center gap-3 p-4 text-left"
          >
            <Info className="h-4 w-4 flex-none text-primary" strokeWidth={2} />
            <p className="flex-1 text-[13px] font-semibold text-foreground">
              Como usar isto de forma profissional
            </p>
            <ChevronDown
              className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${infoOpen ? "rotate-180" : ""}`}
            />
          </button>
          <AnimatePresence initial={false}>
            {infoOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <p className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">
                  1. Olha primeiro para a probabilidade, nunca para a odd. 2. Compara com o preço do
                  bookmaker — só há valor quando a tua probabilidade é claramente maior do que a implícita
                  na odd. 3. Aposta pouco por jogo e só em mercados onde a amostra é sólida (evita os
                  marcados como "Baixa").
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div variants={fadeUp}>
          <button
            type="button"
            onClick={() => setManualOpen((open) => !open)}
            className="sl-card flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-muted-foreground" />
              Análise manual — para jogos ou ligas fora da lista automática
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${manualOpen ? "rotate-180" : ""}`}
            />
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {manualOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_1fr]">
                <div className="space-y-6">
                  <SectionCard title="Jogo">
                    <div className="space-y-4">
                      <TodayMatches
                        onSelect={(league, values) => {
                          setFormData((prev) => ({
                            ...prev,
                            liga: league,
                            ...(LEAGUE_PRESET_MAP[league] ?? {}),
                            ...values,
                          }));
                        }}
                      />

                      <SelectField
                        label="Competição"
                        value={formData.liga}
                        onChange={handleLeagueChange}
                        options={[...LEAGUE_PRESETS]
                          .sort((a, b) => `${a.country} ${a.label}`.localeCompare(`${b.country} ${b.label}`))
                          .map((preset) => ({
                            value: preset.key,
                            label: `${preset.country} · ${preset.label}`,
                          }))}
                      />

                      <LeagueCalibration
                        league={formData.liga}
                        onCalibrate={(values) =>
                          setFormData((prev) => ({ ...prev, ...values }))
                        }
                      />

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormField
                          label="Equipa da Casa"
                          value={formData.equipa_casa}
                          onChange={(v) => updateField("equipa_casa", v)}
                        />
                        <FormField
                          label="Equipa de Fora"
                          value={formData.equipa_fora}
                          onChange={(v) => updateField("equipa_fora", v)}
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title="Estatísticas — Casa">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <FormField label="Jogos" value={formData.jogos_casa} onChange={(v) => updateField("jogos_casa", v)} type="number" />
                      <FormField label="Golos Marcados" value={formData.golos_marcados_casa} onChange={(v) => updateField("golos_marcados_casa", v)} type="number" />
                      <FormField label="Golos Sofridos" value={formData.golos_sofridos_casa} onChange={(v) => updateField("golos_sofridos_casa", v)} type="number" />
                      <FormField label="Jogos Recentes" value={formData.jogos_casa_rec} onChange={(v) => updateField("jogos_casa_rec", v)} type="number" />
                      <FormField label="Marcados (Rec.)" value={formData.golos_marcados_casa_rec} onChange={(v) => updateField("golos_marcados_casa_rec", v)} type="number" />
                      <FormField label="Sofridos (Rec.)" value={formData.golos_sofridos_casa_rec} onChange={(v) => updateField("golos_sofridos_casa_rec", v)} type="number" />
                    </div>
                  </SectionCard>

                  <SectionCard title="Estatísticas — Fora">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <FormField label="Jogos" value={formData.jogos_fora} onChange={(v) => updateField("jogos_fora", v)} type="number" />
                      <FormField label="Golos Marcados" value={formData.golos_marcados_fora} onChange={(v) => updateField("golos_marcados_fora", v)} type="number" />
                      <FormField label="Golos Sofridos" value={formData.golos_sofridos_fora} onChange={(v) => updateField("golos_sofridos_fora", v)} type="number" />
                      <FormField label="Jogos Recentes" value={formData.jogos_fora_rec} onChange={(v) => updateField("jogos_fora_rec", v)} type="number" />
                      <FormField label="Marcados (Rec.)" value={formData.golos_marcados_fora_rec} onChange={(v) => updateField("golos_marcados_fora_rec", v)} type="number" />
                      <FormField label="Sofridos (Rec.)" value={formData.golos_sofridos_fora_rec} onChange={(v) => updateField("golos_sofridos_fora_rec", v)} type="number" />
                    </div>
                  </SectionCard>

                  <Button
                    size="lg"
                    className="h-12 w-full rounded-2xl text-sm font-semibold"
                    disabled={manualLoading || !readyForStats}
                    onClick={runManualProbability}
                  >
                    {manualLoading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> A calcular...
                      </span>
                    ) : (
                      "Ver Probabilidade"
                    )}
                  </Button>
                  {!readyForStats && (
                    <p className="-mt-3 text-center text-[11px] text-muted-foreground">
                      Escolhe um jogo em "Jogos do Dia" ou preenche os jogos disputados de cada equipa.
                    </p>
                  )}
                  {manualError && (
                    <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                      {manualError}
                    </p>
                  )}
                </div>

                <div className="lg:sticky lg:top-6 lg:self-start">
                  <SectionCard title={manualResult ? `${formData.equipa_casa || "Casa"} vs ${formData.equipa_fora || "Fora"}` : "Resultado"}>
                    {manualResult ? (
                      <div className="space-y-5">
                        <ProbabilityBreakdown data={manualResult} />
                        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Tens as odds do teu bookmaker? Continua para a Análise de
                            Valor para veres o edge, a classificação do mercado e a
                            stake sugerida pelo critério de Kelly.
                          </p>
                          <Button
                            variant="outline"
                            className="mt-3 h-10 w-full gap-2 rounded-xl border-cyan-400/30 text-xs text-cyan-100 hover:bg-cyan-400/10"
                            onClick={continueManualToValueAnalysis}
                          >
                            Continuar para Análise de Valor
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Preenche as estatísticas das duas equipas e carrega em "Ver
                        Probabilidade" para veres a leitura do modelo, sem precisares
                        de nenhuma odd.
                      </p>
                    )}
                  </SectionCard>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AppLayout>
  );
}
