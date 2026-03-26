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

type RiskLevel = "Low" | "Medium" | "High";

interface BackendMarket {
  mercado: string;
  odd: number;
  prob_usada_pct: number;
  prob_implicita_pct: number;
  value_bet_pct: number;
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

function InputSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {label}
      </h3>
      <div className="space-y-3">{children}</div>
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
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-xl input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all duration-200"
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

function getOddsBand(odds: number): string {
  if (odds < 1.9) return "low";
  if (odds < 2.4) return "mid";
  return "high";
}

function getMarketFamily(market: string): string {
  const lower = market.toLowerCase();

  if (lower.includes("over")) return "totals-over";
  if (lower.includes("under")) return "totals-under";
  if (lower.includes("btts")) return "btts";
  if (lower === "home" || lower === "draw" || lower === "away") return "1x2";

  return "other";
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

    const positiveBets = results.filter((r) => r.valueBet > 0);
    if (!positiveBets.length) return null;

    return positiveBets.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
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

    return `${bestBet.market} shows the strongest edge with a ${bestBet.valueBet.toFixed(
      1
    )}% model advantage over the market. The model suggests ${bestBet.kelly.toFixed(
      1
    )}% Kelly exposure with a confidence score of ${
      bestBet.confidence
    }/10. Total expected goals are ${summary.totalXg.toFixed(
      2
    )}, supporting this recommendation.`;
  }, [bestBet, summary.totalXg]);

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
          valueBet: Number(m.value_bet_pct.toFixed(1)),
          kelly: Number(m.kelly_pct.toFixed(1)),
          stake: Number(m.stake_sugerida.toFixed(0)),
          risk: mapRisk(m.risco),
          confidence: Number(m.confianca.toFixed(0)),
          decision: mapDecision(m.decisao),
          expectedValue: getExpectedValue(Number(m.value_bet_pct.toFixed(1))),
          oddsBand: getOddsBand(m.odd),
          marketFamily: getMarketFamily(mappedMarket),
        };

        return decorateResult(baseResult);
      });

      const avgConfidence =
        mappedResults.length > 0
          ? mappedResults.reduce((acc, item) => acc + item.confidence, 0) /
            mappedResults.length
          : 0;

      const summaryData = {
        homeXg: data.lambda_casa,
        awayXg: data.lambda_fora,
        totalXg: data.total_golos_esperados,
        confidence: Number(avgConfidence.toFixed(1)),
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
            <p className="text-sm text-muted-foreground mt-1">
              Enter team statistics and market odds to detect value.
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Save className="w-4 h-4 mr-1" strokeWidth={1.5} /> Save
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-card ring-surface p-6 card-shadow overflow-y-auto max-h-[calc(100vh-180px)]">
            <InputSection label="Home Team">
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
                  onChange={(v) => updateField("golos_marcados_casa_rec", v)}
                  type="number"
                />
                <FormField
                  label="Recent Conceded"
                  value={formData.golos_sofridos_casa_rec}
                  onChange={(v) => updateField("golos_sofridos_casa_rec", v)}
                  type="number"
                />
              </div>
            </InputSection>

            <InputSection label="Away Team">
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
                  onChange={(v) => updateField("golos_marcados_fora_rec", v)}
                  type="number"
                />
                <FormField
                  label="Recent Conceded"
                  value={formData.golos_sofridos_fora_rec}
                  onChange={(v) => updateField("golos_sofridos_fora_rec", v)}
                  type="number"
                />
              </div>
            </InputSection>

            <InputSection label="Goals Markets Odds">
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
                  onChange={(v) => updateField("odd_ambas_nao_marcam", v)}
                  type="number"
                />
              </div>
            </InputSection>

            <InputSection label="1X2 Odds">
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
            </InputSection>

            <InputSection label="Bankroll">
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
            </InputSection>

            <Button
              variant="hero"
              className="w-full"
              size="lg"
              onClick={runAnalysis}
              disabled={isLoading}
            >
              <Play className="w-4 h-4 mr-1" strokeWidth={1.5} />
              {isLoading ? "Running..." : "Run Analysis"}
            </Button>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-4">
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
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary mx-auto mb-4"
                    />
                    <motion.p
                      key={loadingStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-medium text-foreground mb-2"
                    >
                      {loadingSteps[loadingStep]}
                    </motion.p>
                    <Progress value={loadingProgress} className="h-1.5 bg-white/5 mb-2" />
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                      className="rounded-2xl bg-card ring-surface p-4 card-shadow group hover:card-shadow-hover transition-all duration-300"
                    >
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">
                        {s.label}
                      </p>
                      <p className="text-2xl font-bold font-mono-data text-foreground mt-1">
                        {s.value}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-primary/5 ring-1 ring-primary/20 card-shadow overflow-hidden"
                >
                  <button
                    onClick={() => setWhyExpanded(!whyExpanded)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-primary/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Why This Bet?
                      </h3>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-primary transition-transform duration-300 ${
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
                        <div className="px-5 pb-5 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/[0.03] p-3">
                              <p className="text-xs text-muted-foreground">Expected Goals</p>
                              <p className="text-lg font-bold font-mono-data text-foreground">
                                {summary.totalXg.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Home {summary.homeXg.toFixed(2)} + Away {summary.awayXg.toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] p-3">
                              <p className="text-xs text-muted-foreground">
                                Probability Advantage
                              </p>
                              <p className="text-lg font-bold font-mono-data text-primary">
                                {bestBet ? `${bestBet.valueBet.toFixed(1)}%` : "--"}
                              </p>
                              <p className="text-xs text-muted-foreground">Model vs Market</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Betting Recommendation
                  </h3>
                  {bestBet ? (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        <span className="text-primary font-semibold">{bestBet.market}</span>{" "}
                        shows the strongest value edge at{" "}
                        <span className="font-mono-data text-primary font-bold">
                          {bestBet.valueBet.toFixed(1)}%
                        </span>
                        . With a confidence score of{" "}
                        <span className="font-mono-data font-bold text-foreground">
                          {bestBet.confidence}/10
                        </span>
                        , this is the best current opportunity. Suggested Kelly stake:{" "}
                        <span className="font-mono-data font-bold text-foreground">
                          €{bestBet.stake}
                        </span>
                        .
                      </p>

                      {bestBetStakeRecommendation && (
                        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                            Recommended Stake
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-lg font-bold font-mono-data text-foreground">
                                €{bestBetStakeRecommendation.recommendedAmount.toFixed(2)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {bestBetStakeRecommendation.recommendedPct.toFixed(2)}% of bankroll
                              </p>
                            </div>
                            {bestBetStakeRecommendation.capped && (
                              <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-400">
                                Capped
                              </span>
                            )}
                          </div>
                          {bestBetStakeRecommendation.reason && (
                            <p className="text-xs text-muted-foreground mt-2">
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

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-card ring-surface p-5 card-shadow"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
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
                  className="rounded-2xl bg-card ring-surface card-shadow overflow-hidden"
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
                              className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5"
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
                              className={`border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 ${
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
                                    <p className="text-[10px] uppercase tracking-widest text-yellow-400 mt-1">
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
                    className="rounded-2xl bg-primary/5 ring-1 ring-primary/20 p-5 card-glow"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Strongest Value Opportunity
                      </h3>
                    </div>
                    <p className="text-lg font-bold text-foreground">{bestBet.market}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Edge:{" "}
                      <span className="font-mono-data text-primary font-bold">
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
                className="rounded-2xl bg-card ring-surface p-16 card-shadow text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Ready to Analyze
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Fill in the match data on the left and click "Run Analysis" to detect
                  value opportunities.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}