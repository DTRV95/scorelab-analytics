import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Info,
  ListFilter,
  Loader2,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { SectionCard, FormField, SelectField } from "@/components/AnalysisFormControls";
import { TodayMatches, dayKey, dayLabels, timeLabel } from "@/components/TodayMatches";
import { LeagueCalibration } from "@/components/LeagueCalibration";
import {
  ProbabilityBreakdown,
  MARKET_LABELS,
  sampleTone,
  type ProbabilityResult,
} from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";
import { buildBetFromBoard, edgeFor, suggestStake } from "@/lib/betFromBoard";
import { calculateNextBankrollBefore, saveAnalysis } from "@/lib/analysisStorage";
import { fetchMatchPrefill } from "@/lib/matchPrefill";
import {
  DEFAULT_LEAGUE_KEY,
  LEAGUE_PRESETS,
  LEAGUE_PRESET_MAP,
} from "@/lib/leaguePresets";
import {
  readCachedBoard,
  writeCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";

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
 * Turns a forecast into a tracked bet without leaving the board: pick the
 * market, type the price your book is offering, done. The edge updates as you
 * type so you can see whether the price is worth taking before committing.
 */
function PlaceBetForm({ match }: { match: BoardMatch }) {
  // Same bankroll reading the manual analysis flow stakes against, so a bet
  // placed here and one placed there start from the same number.
  const bankroll = useMemo(() => calculateNextBankrollBefore(), []);

  const [market, setMarket] = useState(match.headline_market);
  const [odds, setOdds] = useState("");
  const [stake, setStake] = useState("");
  const [saved, setSaved] = useState(false);

  const modelProb =
    match.mercados.find((m) => m.mercado === market)?.probabilidade_pct ?? 0;
  const oddsValue = Number(odds.replace(",", "."));
  const hasOdds = Number.isFinite(oddsValue) && oddsValue > 1;
  const edge = hasOdds ? edgeFor(modelProb, oddsValue) : null;
  const suggested = hasOdds ? suggestStake(modelProb, oddsValue, bankroll) : 0;
  const stakeValue = Number(stake.replace(",", "."));
  const hasStake = Number.isFinite(stakeValue) && stakeValue > 0;

  const place = () => {
    if (!hasOdds || !hasStake) return;
    saveAnalysis(
      buildBetFromBoard({
        match,
        market,
        odds: oddsValue,
        stake: stakeValue,
        bankroll,
      })
    );
    setSaved(true);
  };

  if (saved) {
    return (
      <div className="rounded-xl border border-[hsl(var(--sl-green))]/30 bg-[hsl(var(--sl-green))]/5 p-3.5">
        <p className="text-sm font-semibold text-[hsl(var(--sl-green))]">
          Aposta registada.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Fica em "Apostas" como pendente. O resultado final é obtido pela API
          e a aposta é fechada como green ou red sem teres de fazer nada.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <p className="text-[13px] font-semibold text-foreground">
        Registar aposta neste jogo
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Escolhe o mercado e mete a odd da tua casa. O resultado é fechado
        automaticamente quando o jogo acabar.
      </p>

      <div className="mt-3 space-y-2">
        <select
          value={market}
          onChange={(e) => setMarket(e.target.value)}
          style={{ colorScheme: "light" }}
          className="h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {match.mercados.map((m) => (
            <option key={m.mercado} value={m.mercado}>
              {(MARKET_LABELS[m.mercado] ?? m.mercado) +
                ` — ${m.probabilidade_pct.toFixed(1)}%`}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="sl-meta text-[11px]">Odd</span>
            <input
              inputMode="decimal"
              value={odds}
              onChange={(e) => setOdds(e.target.value)}
              placeholder="1.85"
              className="mt-1 h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 font-mono-data text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="block">
            <span className="sl-meta text-[11px]">Stake (€)</span>
            <input
              inputMode="decimal"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              placeholder={suggested > 0 ? suggested.toFixed(2) : "10"}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 font-mono-data text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
        </div>

        {edge !== null && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
            <span className="sl-meta text-[11px]">
              Modelo {modelProb.toFixed(1)}% vs odd {(100 / oddsValue).toFixed(1)}%
            </span>
            <span
              className={`font-mono-data text-sm font-bold ${
                edge > 0 ? "text-[hsl(var(--sl-green))]" : "text-destructive"
              }`}
            >
              {edge > 0 ? "+" : ""}
              {edge.toFixed(1)}%
            </span>
          </div>
        )}

        {edge !== null && edge <= 0 && (
          <p className="text-xs leading-relaxed text-destructive">
            A esta odd o mercado está a pagar menos do que o modelo acha justo.
            Podes registar na mesma, mas sem valor a teu favor.
          </p>
        )}

        {suggested > 0 && (
          <button
            type="button"
            onClick={() => setStake(suggested.toFixed(2))}
            className="text-[12px] font-semibold text-primary"
          >
            Usar stake sugerida ({suggested.toFixed(2)} €)
          </button>
        )}

        <Button
          className="sl-btn-primary h-10 w-full text-xs disabled:opacity-40"
          disabled={!hasOdds || !hasStake}
          onClick={place}
        >
          Registar aposta
        </Button>
      </div>
    </div>
  );
}

function BoardMatchRow({
  match,
  isExpanded,
  onToggle,
  onContinue,
  continuing,
}: {
  match: BoardMatch;
  isExpanded: boolean;
  onToggle: () => void;
  onContinue: () => void;
  continuing: boolean;
}) {
  return (
    <article className="sl-card sl-card-interactive overflow-hidden">
      {/* One number per row on purpose. An earlier version also showed a
          1/X/2 strip, which left two different percentages competing for the
          same glance — the strongest outcome and the strongest market are
          rarely the same line. The full set is one tap away. */}
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

        <div className="max-w-[45%] flex-none text-right">
          <p className="sl-meta text-[11px] leading-snug">
            {MARKET_LABELS[match.headline_market] ?? match.headline_market}
          </p>
          <p className="font-mono-data text-lg font-bold text-[hsl(var(--sl-green))]">
            {match.headline_pct.toFixed(1)}%
          </p>
        </div>

        <span
          className={`flex-none rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ${sampleTone(
            match.amostra_label
          )}`}
          title="Quanto histórico sustenta esta previsão"
        >
          {match.amostra_label}
        </span>
      </button>

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
              <ProbabilityBreakdown data={match} />

              <PlaceBetForm match={match} />

              <div className="rounded-xl border border-border bg-card p-3.5">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Queres a análise completa antes de decidir? Continua para a
                  Análise de Valor para veres a classificação do mercado, o
                  risco e a stake sugerida com todo o detalhe.
                </p>
                <Button
                  className="sl-btn-primary mt-3 h-10 w-full gap-2 text-xs"
                  disabled={continuing}
                  onClick={onContinue}
                >
                  {continuing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      Continuar para Análise de Valor
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [continuingId, setContinuingId] = useState<number | null>(null);
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

    fetch(buildApiUrl("/data/status"), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data?.configured));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      })
      .finally(() => window.clearTimeout(timeout));

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

    fetch(buildApiUrl(`/data/probability-board?days=${BOARD_DAYS}`), {
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(body?.detail || "Falha ao calcular as probabilidades.");
        }
        return body;
      })
      .then((data) => {
        if (cancelled) return;
        const matches = data.matches ?? [];
        const unavailable = data.unavailable ?? [];
        const skipped = data.skipped ?? 0;
        setBoard(matches);
        setUnavailableLeagues(unavailable);
        setSkippedCount(skipped);
        writeCachedBoard({ days: BOARD_DAYS, matches, unavailable, skipped });
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

  const continueToValueAnalysis = async (match: BoardMatch) => {
    setContinuingId(match.fixture_id);
    setBoardError("");
    try {
      const { values, fixture } = await fetchMatchPrefill(
        match.league,
        match.fixture_id
      );
      navigate("/analysis", { state: { prefill: values, fixture } });
    } catch (err) {
      setBoardError((err as Error).message);
    } finally {
      setContinuingId(null);
    }
  };

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
            <h1 className="sl-section-title">Probabilidades</h1>
            <p className="sl-meta mt-1">
              O que o modelo espera que aconteça em cada jogo dos próximos 7
              dias — sem odds, sem stake.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-none rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Recalcular"
            disabled={boardLoading}
            onClick={() => setReloadToken((token) => token + 1)}
          >
            <RefreshCw className={`h-4 w-4 ${boardLoading ? "animate-spin" : ""}`} />
          </Button>
        </motion.div>

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

        {enabled === true && (
          <motion.div variants={fadeUp} className="space-y-4">
            {boardLoading && board.length === 0 && (
              <p className="sl-card flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> A calcular
                probabilidades para todos os jogos dos próximos 7 dias...
              </p>
            )}

            {boardError && (
              <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-xs font-medium text-destructive">
                {boardError}
              </p>
            )}

            {!boardLoading && !boardError && board.length === 0 && (
              <p className="sl-card px-4 py-4 text-sm text-muted-foreground">
                Sem jogos analisáveis nos próximos dias nas ligas com dados
                automáticos. Tenta a análise manual em baixo.
              </p>
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
                              isExpanded={expandedId === match.fixture_id}
                              onToggle={() =>
                                setExpandedId(
                                  expandedId === match.fixture_id
                                    ? null
                                    : match.fixture_id
                                )
                              }
                              onContinue={() => continueToValueAnalysis(match)}
                              continuing={continuingId === match.fixture_id}
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
