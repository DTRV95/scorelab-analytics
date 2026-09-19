import { useEffect, useState } from "react";
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
import { TodayMatches, dayLabels, timeLabel } from "@/components/TodayMatches";
import { LeagueCalibration } from "@/components/LeagueCalibration";
import {
  ProbabilityBreakdown,
  MARKET_LABELS,
  sampleTone,
  type ProbabilityResult,
} from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";
import { fetchMatchPrefill } from "@/lib/matchPrefill";
import {
  DEFAULT_LEAGUE_KEY,
  LEAGUE_PRESETS,
  LEAGUE_PRESET_MAP,
} from "@/lib/leaguePresets";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface BoardMatch extends ProbabilityResult {
  fixture_id: number;
  league: string;
  home_name: string;
  away_name: string;
  kickoff: string | null;
  headline_market: string;
  headline_pct: number;
}

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

function kickoffLabel(kickoff: string | null) {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return `${dayLabels(date).short} · ${timeLabel(date)}`;
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

  // The manual path: kept for leagues or matchups the auto board can't cover.
  const [manualOpen, setManualOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [manualResult, setManualResult] = useState<ProbabilityResult | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState("");

  useEffect(() => {
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
  }, [reloadToken]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setBoardLoading(true);
    setBoardError("");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 90_000);

    fetch(buildApiUrl("/data/probability-board?days=7"), {
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
        setBoard(data.matches ?? []);
        setUnavailableLeagues(data.unavailable ?? []);
        setSkippedCount(data.skipped ?? 0);
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
  }, [enabled, reloadToken]);

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
        className="space-y-6 p-4 sm:p-5 md:p-6"
      >
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.32)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_28%)]" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
                Probabilidade
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Os jogos com maior probabilidade, já calculados
              </h1>
              <p className="mt-2 text-sm leading-7 text-white/60">
                Sem odds, sem valor, sem stake — só o que o modelo espera que
                aconteça, ordenado do sinal mais forte para o mais fraco. Abre
                um jogo para veres todas as probabilidades.
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-none rounded-xl text-white/50 hover:text-white"
              title="Recalcular"
              disabled={boardLoading}
              onClick={() => setReloadToken((token) => token + 1)}
            >
              <RefreshCw className={`h-4 w-4 ${boardLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4"
        >
          <Info className="mt-0.5 h-4 w-4 flex-none text-cyan-300" strokeWidth={1.7} />
          <div className="text-xs leading-relaxed text-white/55">
            <p className="font-semibold text-white/75">Como usar isto de forma profissional</p>
            <p className="mt-1">
              1. Olha primeiro para a probabilidade, nunca para a odd. 2. Compara com o preço do
              bookmaker — só há valor quando a tua probabilidade é claramente maior do que a implícita
              na odd. 3. Aposta pouco por jogo e só em mercados onde a amostra é sólida (evita os
              marcados como "Baixa").
            </p>
          </div>
        </motion.div>

        {enabled === null && (
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/55"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            A ligar ao motor de dados... pode demorar até um minuto se estiver
            parado há algum tempo.
          </motion.div>
        )}

        {enabled === true && (
          <motion.div variants={fadeUp}>
            <SectionCard title="Jogos Analisáveis">
              {boardLoading && board.length === 0 && (
                <p className="flex items-center gap-2 text-sm text-white/55">
                  <Loader2 className="h-4 w-4 animate-spin" /> A calcular
                  probabilidades para todos os jogos dos próximos 7 dias...
                </p>
              )}

              {boardError && (
                <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                  {boardError}
                </p>
              )}

              {!boardLoading && !boardError && board.length === 0 && (
                <p className="text-sm text-white/45">
                  Sem jogos analisáveis nos próximos dias nas ligas com dados
                  automáticos. Tenta a análise manual em baixo.
                </p>
              )}

              {board.length > 0 && (
                <div className="space-y-2">
                  {board.map((match) => {
                    const isExpanded = expandedId === match.fixture_id;
                    return (
                      <div
                        key={match.fixture_id}
                        className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : match.fixture_id)
                          }
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 flex-none text-white/40" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-none text-white/40" />
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {match.home_name} vs {match.away_name}
                            </p>
                            <p className="truncate text-[11px] text-white/45">
                              {match.league}
                              {match.kickoff ? ` · ${kickoffLabel(match.kickoff)}` : ""}
                            </p>
                          </div>

                          <div className="flex-none text-right">
                            <p className="text-[11px] text-white/50">
                              {MARKET_LABELS[match.headline_market] ?? match.headline_market}
                            </p>
                            <p className="font-mono text-lg font-semibold text-white">
                              {match.headline_pct.toFixed(1)}%
                            </p>
                          </div>

                          <span
                            className={`flex-none rounded-full px-2 py-1 text-[10px] font-medium ring-1 ${sampleTone(
                              match.amostra_label
                            )}`}
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
                              <div className="space-y-4 border-t border-white/8 px-4 py-4">
                                <ProbabilityBreakdown data={match} />

                                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                                  <p className="text-xs leading-relaxed text-white/60">
                                    Tens as odds do teu bookmaker para este jogo?
                                    Continua para a Análise de Valor para veres o
                                    edge, a classificação do mercado e a stake
                                    sugerida.
                                  </p>
                                  <Button
                                    variant="outline"
                                    className="mt-3 h-10 w-full gap-2 rounded-xl border-cyan-400/30 text-xs text-cyan-100 hover:bg-cyan-400/10"
                                    disabled={continuingId === match.fixture_id}
                                    onClick={() => continueToValueAnalysis(match)}
                                  >
                                    {continuingId === match.fixture_id ? (
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
                      </div>
                    );
                  })}
                </div>
              )}

              {(skippedCount > 0 || unavailableLeagues.length > 0) && (
                <p className="mt-3 flex items-start gap-2 text-[11px] text-white/35">
                  <ListFilter className="mt-0.5 h-3 w-3 flex-none" />
                  <span>
                    {skippedCount > 0 &&
                      `${skippedCount} jogo${skippedCount === 1 ? "" : "s"} sem histórico suficiente ficaram de fora. `}
                    {unavailableLeagues.length > 0 &&
                      `Sem resposta de: ${unavailableLeagues.join(", ")}.`}
                  </span>
                </p>
              )}
            </SectionCard>
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <button
            type="button"
            onClick={() => setManualOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-left text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            <span className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-white/40" />
              Análise manual — para jogos ou ligas fora da lista automática
            </span>
            <ChevronDown
              className={`h-4 w-4 text-white/40 transition-transform ${manualOpen ? "rotate-180" : ""}`}
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
                    <p className="-mt-3 text-center text-[11px] text-white/40">
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
                          <p className="text-xs leading-relaxed text-white/60">
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
                      <p className="text-sm text-white/45">
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
