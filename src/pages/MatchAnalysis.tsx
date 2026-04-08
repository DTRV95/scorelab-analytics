import {
  getBankrollStats,
  getAnalyses,
  saveAnalysis,
  createEmptyTracking,
  createAnalysisId,
  calculateNextBankrollBefore,
} from "@/lib/analysisStorage";
import {
  getOpenExposureSummary,
  getRecommendedStake,
} from "@/lib/portofolioEngine";
import { decorateResult } from "@/lib/eliteBetSystem";
import {
  getDecisionFromMetrics,
  getOddsBand,
  getMarketFamily,
} from "@/lib/analysisDecision";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  ValueBadge,
  DecisionBadge,
  RiskBadge,
  TierBadge,
} from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Play, Save, ChevronDown, Lightbulb, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Progress } from "@/components/ui/progress";
import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";
import { getHistoricalSignalsForResult } from "@/lib/edgeInteligence";

type RiskLevel = "Low" | "Medium" | "High";

interface BackendMarket {
  mercado: string;
  odd: number;
  prob_usada_pct: number;
  prob_implicita_pct: number;
  value_bet_pct: number;
  edge_lb_pct?: number;
  robustness_pct?: number;
  uncertainty_pct?: number;
  kelly_pct: number;
  stake_sugerida: number;
  risco: number;
  confianca: number;
  classificacao: string;
  decisao: string;
}

interface BackendResponse {
  lambda_casa: number;
  lambda_fora: number;
  total_golos_esperados: number;
  mercados: BackendMarket[];
}

interface FormData {
  equipa_casa: string;
  equipa_fora: string;

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

  odd_mais_25: string;
  odd_menos_25: string;
  odd_mais_35: string;
  odd_menos_35: string;
  odd_ambas_marcam: string;
  odd_ambas_nao_marcam: string;

  odd_casa: string;
  odd_empate: string;
  odd_fora: string;

  banca: string;
  fracao_kelly: string;
}

const initialFormData: FormData = {
  equipa_casa: "",
  equipa_fora: "",

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

  odd_mais_25: "0",
  odd_menos_25: "0",
  odd_mais_35: "0",
  odd_menos_35: "0",
  odd_ambas_marcam: "0",
  odd_ambas_nao_marcam: "0",

  odd_casa: "0",
  odd_empate: "0",
  odd_fora: "0",

  banca: "100",
  fracao_kelly: "1",
};

const loadingSteps = [
  "Running simulations...",
  "Calculating probabilities...",
  "Comparing market prices...",
  "Generating recommendations...",
];

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-xl input-surface px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all duration-200"
      />
    </div>
  );
}

function mapRisk(risco: number): RiskLevel {
  if (risco <= 2) return "Low";
  if (risco === 3) return "Medium";
  return "High";
}

function mapMarketName(name: string): string {
  const normalized = name.trim().toLowerCase();

  if (normalized.includes("mais de 2.5")) return "Over 2.5";
  if (normalized.includes("menos de 2.5")) return "Under 2.5";
  if (normalized.includes("mais de 3.5")) return "Over 3.5";
  if (normalized.includes("menos de 3.5")) return "Under 3.5";
  if (
    normalized.includes("ambas marcam") &&
    !normalized.includes("não") &&
    !normalized.includes("nao")
  ) {
    return "BTTS Yes";
  }
  if (
    normalized.includes("ambas não marcam") ||
    normalized.includes("ambas nao marcam")
  ) {
    return "BTTS No";
  }

  if (normalized === "casa") return "Home";
  if (normalized === "empate") return "Draw";
  if (normalized === "fora") return "Away";

  return name;
}

function mapDecision(decisao: string): "Bet" | "No Bet" | "Caution" {
  const normalized = decisao.trim().toLowerCase();

  if (normalized.includes("apostar")) return "Bet";
  if (normalized.includes("não") || normalized.includes("nao")) return "No Bet";
  return "Caution";
}

function getExpectedValue(valueBet: number): number {
  return Number(valueBet.toFixed(1));
}

export default function MatchAnalysis() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState({
    homeXg: 0,
    awayXg: 0,
    totalXg: 0,
    confidence: 0,
  });

  const bankrollStats = getBankrollStats();
  const existingAnalyses = getAnalyses();
  const exposureSummary = getOpenExposureSummary(
    existingAnalyses,
    bankrollStats.currentBankroll
  );

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const bestBet = useMemo(() => {
    if (!results.length) return null;

    const positiveBets = results.filter(
      (r) => (r.edgeLowerBound ?? r.valueBet) > 0
    );
    if (!positiveBets.length) return null;

    return positiveBets.reduce((a, b) =>
      (a.eliteScore ?? 0) > (b.eliteScore ?? 0) ? a : b
    );
  }, [results]);

  const bestBetStakeRecommendation = useMemo(() => {
    if (!bestBet) return null;

    return getRecommendedStake(
      bankrollStats.currentBankroll,
      bestBet.tier || "discard",
      exposureSummary.openExposurePct
    );
  }, [bestBet, bankrollStats.currentBankroll, exposureSummary.openExposurePct]);

  const chartData = useMemo(
    () =>
      results.map((r) => ({
        name: r.market,
        model: r.modelProb,
        implied: r.impliedProb,
      })),
    [results]
  );

  const whyThisBetText = useMemo(() => {
    if (!bestBet) return "";

    return `${bestBet.market} leads the card with a ${bestBet.valueBet.toFixed(
      1
    )}% raw edge and a ${(
      bestBet.edgeLowerBound ?? bestBet.valueBet
    ).toFixed(1)}% conservative edge floor. Robustness is ${(
      bestBet.robustness ?? 0
    ).toFixed(0)}%, uncertainty width is ${(
      bestBet.uncertainty ?? 0
    ).toFixed(1)}%, and adjusted Kelly is ${bestBet.kelly.toFixed(
      2
    )}%. Total expected goals are ${summary.totalXg.toFixed(2)}.`;
  }, [bestBet, summary.totalXg]);

  const historicalSignals = useMemo(() => {
    if (!bestBet) return [];
    return getHistoricalSignalsForResult(bestBet);
  }, [bestBet]);

  const runAnalysis = async () => {
    setIsLoading(true);
    setShowResults(false);
    setLoadingStep(0);
    setLoadingProgress(0);
    setErrorMessage("");

    const totalDuration = 2400;
    const stepDuration = totalDuration / loadingSteps.length;

    loadingSteps.forEach((_, i) => {
      setTimeout(() => {
        setLoadingStep(i);
        setLoadingProgress(((i + 1) / loadingSteps.length) * 100);
      }, i * stepDuration);
    });

    try {
      const payload = {
        equipa_casa: formData.equipa_casa,
        equipa_fora: formData.equipa_fora,

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

        odd_mais_25: Number(formData.odd_mais_25),
        odd_menos_25: Number(formData.odd_menos_25),
        odd_mais_35: Number(formData.odd_mais_35),
        odd_menos_35: Number(formData.odd_menos_35),
        odd_ambas_marcam: Number(formData.odd_ambas_marcam),
        odd_ambas_nao_marcam: Number(formData.odd_ambas_nao_marcam),

        odd_casa: Number(formData.odd_casa),
        odd_empate: Number(formData.odd_empate),
        odd_fora: Number(formData.odd_fora),

        banca: Number(formData.banca),
        fracao_kelly: Number(formData.fracao_kelly),
      };

      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze match.");
      }

      const data: BackendResponse = await response.json();

      const mappedResults: AnalysisResult[] = data.mercados.map((m) => {
        const mappedMarket = mapMarketName(m.mercado);

        const baseResult: AnalysisResult = {
          market: mappedMarket,
          odds: m.odd,
          modelProb: Number(m.prob_usada_pct.toFixed(1)),
          impliedProb: Number(m.prob_implicita_pct.toFixed(1)),
          fairProb: Number(m.prob_implicita_pct.toFixed(1)),
          valueBet: Number(m.value_bet_pct.toFixed(1)),
          edgeLowerBound: Number(
            (m.edge_lb_pct ?? m.value_bet_pct).toFixed(1)
          ),
          robustness: Number((m.robustness_pct ?? 0).toFixed(0)),
          uncertainty: Number((m.uncertainty_pct ?? 0).toFixed(1)),
          kelly: Number(m.kelly_pct.toFixed(2)),
          stake: Number(m.stake_sugerida.toFixed(2)),
          risk: mapRisk(m.risco),
          confidence: Number(m.confianca.toFixed(1)),
          decision: mapDecision(m.decisao),
          expectedValue: getExpectedValue(Number(m.value_bet_pct.toFixed(1))),
          oddsBand: getOddsBand(m.odd),
          marketFamily: getMarketFamily(mappedMarket),
          backendDecision: m.decisao,
          backendClassification: m.classificacao,
        };

        return decorateResult({
          ...baseResult,
          decision: getDecisionFromMetrics(baseResult),
        });
      });

      const bestResultForSummary = [...mappedResults].sort(
        (a, b) => (b.eliteScore ?? 0) - (a.eliteScore ?? 0)
      )[0];

      const summaryData = {
        homeXg: data.lambda_casa,
        awayXg: data.lambda_fora,
        totalXg: data.total_golos_esperados,
        confidence: Number((bestResultForSummary?.confidence ?? 0).toFixed(1)),
      };

      setResults(mappedResults);
      setSummary(summaryData);

      const bankrollBefore = calculateNextBankrollBefore();

      const analysisToSave: SavedAnalysis = {
        id: createAnalysisId(),
        createdAt: new Date().toISOString(),
        homeTeam: formData.equipa_casa,
        awayTeam: formData.equipa_fora,
        summary: summaryData,
        results: mappedResults,
        tracking: {
          ...createEmptyTracking(),
          bankrollBefore,
          bankrollAfter: bankrollBefore,
        },
      };

      saveAnalysis(analysisToSave);
      setShowResults(true);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Could not connect to the analysis engine. Make sure the backend API is running and updated."
      );
      setShowResults(false);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, totalDuration);
    }
  };

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Match Analysis</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter team statistics and market odds to detect value.
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Save className="mr-1 h-4 w-4" strokeWidth={1.5} /> Save
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 rounded-2xl bg-card ring-surface p-6 card-shadow overflow-y-auto max-h-[calc(100vh-180px)]">
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-1">
                <SectionCard title="Home Team">
                  <div className="space-y-4">
                    <FormField
                      label="Team Name"
                      value={formData.equipa_casa}
                      onChange={(v) => updateField("equipa_casa", v)}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        label="Total Matches"
                        value={formData.jogos_casa}
                        onChange={(v) => updateField("jogos_casa", v)}
                        type="number"
                      />
                      <FormField
                        label="Goals Scored (H)"
                        value={formData.golos_marcados_casa}
                        onChange={(v) => updateField("golos_marcados_casa", v)}
                        type="number"
                      />
                      <FormField
                        label="Goals Conceded (H)"
                        value={formData.golos_sofridos_casa}
                        onChange={(v) => updateField("golos_sofridos_casa", v)}
                        type="number"
                      />
                      <FormField
                        label="Recent Matches"
                        value={formData.jogos_casa_rec}
                        onChange={(v) => updateField("jogos_casa_rec", v)}
                        type="number"
                      />
                      <FormField
                        label="Recent Scored"
                        value={formData.golos_marcados_casa_rec}
                        onChange={(v) =>
                          updateField("golos_marcados_casa_rec", v)
                        }
                        type="number"
                      />
                      <FormField
                        label="Recent Conceded"
                        value={formData.golos_sofridos_casa_rec}
                        onChange={(v) =>
                          updateField("golos_sofridos_casa_rec", v)
                        }
                        type="number"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Away Team">
                  <div className="space-y-4">
                    <FormField
                      label="Team Name"
                      value={formData.equipa_fora}
                      onChange={(v) => updateField("equipa_fora", v)}
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <FormField
                        label="Total Matches"
                        value={formData.jogos_fora}
                        onChange={(v) => updateField("jogos_fora", v)}
                        type="number"
                      />
                      <FormField
                        label="Goals Scored (A)"
                        value={formData.golos_marcados_fora}
                        onChange={(v) => updateField("golos_marcados_fora", v)}
                        type="number"
                      />
                      <FormField
                        label="Goals Conceded (A)"
                        value={formData.golos_sofridos_fora}
                        onChange={(v) => updateField("golos_sofridos_fora", v)}
                        type="number"
                      />
                      <FormField
                        label="Recent Matches"
                        value={formData.jogos_fora_rec}
                        onChange={(v) => updateField("jogos_fora_rec", v)}
                        type="number"
                      />
                      <FormField
                        label="Recent Scored"
                        value={formData.golos_marcados_fora_rec}
                        onChange={(v) =>
                          updateField("golos_marcados_fora_rec", v)
                        }
                        type="number"
                      />
                      <FormField
                        label="Recent Conceded"
                        value={formData.golos_sofridos_fora_rec}
                        onChange={(v) =>
                          updateField("golos_sofridos_fora_rec", v)
                        }
                        type="number"
                      />
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Market Odds">
                  <div className="space-y-5">
                    <div>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Goals Markets
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          label="Over 2.5"
                          value={formData.odd_mais_25}
                          onChange={(v) => updateField("odd_mais_25", v)}
                          type="number"
                        />
                        <FormField
                          label="Under 2.5"
                          value={formData.odd_menos_25}
                          onChange={(v) => updateField("odd_menos_25", v)}
                          type="number"
                        />
                        <FormField
                          label="Over 3.5"
                          value={formData.odd_mais_35}
                          onChange={(v) => updateField("odd_mais_35", v)}
                          type="number"
                        />
                        <FormField
                          label="Under 3.5"
                          value={formData.odd_menos_35}
                          onChange={(v) => updateField("odd_menos_35", v)}
                          type="number"
                        />
                        <FormField
                          label="BTTS Yes"
                          value={formData.odd_ambas_marcam}
                          onChange={(v) => updateField("odd_ambas_marcam", v)}
                          type="number"
                        />
                        <FormField
                          label="BTTS No"
                          value={formData.odd_ambas_nao_marcam}
                          onChange={(v) =>
                            updateField("odd_ambas_nao_marcam", v)
                          }
                          type="number"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        1X2
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        <FormField
                          label="Home"
                          value={formData.odd_casa}
                          onChange={(v) => updateField("odd_casa", v)}
                          type="number"
                        />
                        <FormField
                          label="Draw"
                          value={formData.odd_empate}
                          onChange={(v) => updateField("odd_empate", v)}
                          type="number"
                        />
                        <FormField
                          label="Away"
                          value={formData.odd_fora}
                          onChange={(v) => updateField("odd_fora", v)}
                          type="number"
                        />
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Bankroll Settings">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      label="Bankroll (€)"
                      value={formData.banca}
                      onChange={(v) => updateField("banca", v)}
                      type="number"
                    />
                    <FormField
                      label="Kelly Fraction"
                      value={formData.fracao_kelly}
                      onChange={(v) => updateField("fracao_kelly", v)}
                      type="number"
                    />
                  </div>
                </SectionCard>
              </div>

              <Button
                variant="hero"
                className="w-full"
                size="lg"
                onClick={runAnalysis}
                disabled={isLoading}
              >
                <Play className="mr-1 h-4 w-4" strokeWidth={1.5} />
                {isLoading ? "Running..." : "Run Analysis"}
              </Button>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 lg:col-span-3">
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-2xl bg-card ring-surface p-8 card-shadow"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="mx-auto mb-4 h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary"
                    />
                    <motion.p
                      key={loadingStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-2 text-sm font-medium text-foreground"
                    >
                      {loadingSteps[loadingStep]}
                    </motion.p>
                    <Progress
                      value={loadingProgress}
                      className="mb-2 h-1.5 bg-white/5"
                    />
                    <p className="text-xs text-muted-foreground">
                      {Math.round(loadingProgress)}% complete
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showResults && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: "Home xG", value: summary.homeXg.toFixed(2) },
                    { label: "Away xG", value: summary.awayXg.toFixed(2) },
                    { label: "Total xG", value: summary.totalXg.toFixed(2) },
                    { label: "Confidence", value: summary.confidence.toFixed(1) },
                  ].map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-2xl bg-card ring-surface p-4 card-shadow group transition-all duration-300 hover:card-shadow-hover"
                    >
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {s.label}
                      </p>
                      <p className="mt-1 text-2xl font-bold font-mono-data text-foreground">
                        {s.value}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="overflow-hidden rounded-2xl bg-primary/5 ring-1 ring-primary/20 card-shadow"
                >
                  <button
                    onClick={() => setWhyExpanded(!whyExpanded)}
                    className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-primary/[0.03]"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" strokeWidth={1.5} />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Why This Bet?
                      </h3>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-primary transition-transform duration-300 ${
                        whyExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <AnimatePresence>
                    {whyExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 px-5 pb-5">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/[0.03] p-3">
                              <p className="text-xs text-muted-foreground">
                                Expected Goals
                              </p>
                              <p className="text-lg font-bold font-mono-data text-foreground">
                                {summary.totalXg.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Home {summary.homeXg.toFixed(2)} + Away{" "}
                                {summary.awayXg.toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] p-3">
                              <p className="text-xs text-muted-foreground">
                                Probability Advantage
                              </p>
                              <p className="text-lg font-bold font-mono-data text-primary">
                                {bestBet ? `${bestBet.valueBet.toFixed(1)}%` : "--"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Model vs Market
                              </p>
                            </div>
                          </div>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {whyThisBetText ||
                              "Run an analysis to understand the strongest opportunity."}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-card ring-surface p-5 card-shadow"
                >
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Betting Recommendation
                  </h3>
                  {bestBet ? (
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-primary">
                          {bestBet.market}
                        </span>{" "}
                        shows the strongest value edge at{" "}
                        <span className="font-mono-data font-bold text-primary">
                          {bestBet.valueBet.toFixed(1)}%
                        </span>
                        . With a confidence score of{" "}
                        <span className="font-mono-data font-bold text-foreground">
                          {bestBet.confidence}/10
                        </span>
                        , this is the best current opportunity. Suggested Kelly
                        stake:{" "}
                        <span className="font-mono-data font-bold text-foreground">
                          €{bestBet.stake}
                        </span>
                        .
                      </p>

                      {bestBetStakeRecommendation && (
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                          <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                            Recommended Stake
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-lg font-bold font-mono-data text-foreground">
                                €{bestBetStakeRecommendation.recommendedAmount.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {bestBetStakeRecommendation.recommendedPct.toFixed(
                                  2
                                )}
                                % of bankroll
                              </p>
                            </div>
                            {bestBetStakeRecommendation.capped && (
                              <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-[10px] uppercase tracking-widest text-yellow-400">
                                Capped
                              </span>
                            )}
                          </div>
                          {bestBetStakeRecommendation.reason && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {bestBetStakeRecommendation.reason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No recommendation available.
                    </p>
                  )}
                </motion.div>

                {bestBet && historicalSignals.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.38 }}
                    className="rounded-2xl bg-card ring-surface p-5 card-shadow"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-300" />
                      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Historical Signals
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {historicalSignals.map((signal) => (
                        <div
                          key={signal.label}
                          className="rounded-xl border border-white/8 bg-white/[0.03] p-3"
                        >
                          <p className="text-xs uppercase tracking-wider text-muted-foreground">
                            {signal.label}
                          </p>
                          <p
                            className={`mt-1 text-sm leading-relaxed ${
                              signal.tone === "positive"
                                ? "text-emerald-300"
                                : signal.tone === "negative"
                                ? "text-red-300"
                                : "text-white/70"
                            }`}
                          >
                            {signal.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-card ring-surface p-5 card-shadow"
                >
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Model vs Market Probability
                  </h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} layout="vertical">
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                        width={85}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(222, 47%, 7%)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="model"
                        fill="hsl(142, 71%, 45%)"
                        radius={[0, 6, 6, 0]}
                        barSize={12}
                        name="Model"
                      />
                      <Bar
                        dataKey="implied"
                        fill="hsl(222, 30%, 25%)"
                        radius={[0, 6, 6, 0]}
                        barSize={12}
                        name="Market"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="overflow-hidden rounded-2xl bg-card ring-surface card-shadow"
                >
                  <div className="p-5 pb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Detailed Results
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-white/5">
                          {[
                            "Market",
                            "Odds",
                            "Model %",
                            "Implied %",
                            "Edge",
                            "Kelly",
                            "Stake",
                            "Risk",
                            "Tier",
                            "Conf.",
                            "Recommended",
                            "Decision",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => {
                          const stakeRecommendation = getRecommendedStake(
                            bankrollStats.currentBankroll,
                            r.tier || "discard",
                            exposureSummary.openExposurePct
                          );

                          return (
                            <motion.tr
                              key={r.market}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.5 + i * 0.05 }}
                              className={`border-t border-white/5 transition-all duration-200 hover:bg-white/[0.03] ${
                                bestBet && r.market === bestBet.market
                                  ? "bg-primary/[0.03]"
                                  : ""
                              }`}
                            >
                              <td className="px-4 py-3 font-medium text-foreground">
                                {r.market}
                              </td>
                              <td className="px-4 py-3 font-mono-data text-muted-foreground">
                                {r.odds.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 font-mono-data text-foreground">
                                {r.modelProb.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 font-mono-data text-muted-foreground">
                                {r.impliedProb.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3">
                                <ValueBadge value={r.valueBet} />
                              </td>
                              <td className="px-4 py-3 font-mono-data text-muted-foreground">
                                {r.kelly.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 font-mono-data text-foreground">
                                €{r.stake}
                              </td>
                              <td className="px-4 py-3">
                                <RiskBadge risk={r.risk} />
                              </td>
                              <td className="px-4 py-3">
                                {r.tier ? <TierBadge tier={r.tier} /> : null}
                              </td>
                              <td className="px-4 py-3">
                                <ConfidenceMeter score={r.confidence} className="w-16" />
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-mono-data text-foreground">
                                    €{stakeRecommendation.recommendedAmount.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {stakeRecommendation.recommendedPct.toFixed(2)}%
                                  </p>
                                  {stakeRecommendation.capped && (
                                    <p className="mt-1 text-[10px] uppercase tracking-widest text-yellow-400">
                                      Capped
                                    </p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <DecisionBadge decision={r.decision} />
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {bestBet && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                    className="rounded-2xl bg-primary/5 p-5 ring-1 ring-primary/20 card-glow"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Strongest Value Opportunity
                      </h3>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {bestBet.market}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Edge:{" "}
                      <span className="font-mono-data font-bold text-primary">
                        {bestBet.valueBet.toFixed(1)}%
                      </span>{" "}
                      · Kelly:{" "}
                      <span className="font-mono-data font-bold">
                        {bestBet.kelly.toFixed(1)}%
                      </span>{" "}
                      · Confidence:{" "}
                      <span className="font-mono-data font-bold">
                        {bestBet.confidence}/10
                      </span>
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {!showResults && !isLoading && !errorMessage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl bg-card ring-surface p-16 text-center card-shadow"
              >
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                  <Target className="h-8 w-8 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Ready to Analyze
                </h3>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Fill in the match data on the left and click "Run Analysis" to
                  detect value opportunities.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}