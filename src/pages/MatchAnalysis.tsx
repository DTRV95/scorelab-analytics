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
import { buildApiUrl } from "@/lib/apiConfig";
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
import {
  Play,
  Save,
  ChevronDown,
  Lightbulb,
  Target,
  Database,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
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
import {
  applyCalibrationToResult,
  buildCalibrationModel,
} from "@/lib/calibrationEngine";
import { getSimilarMatchMemory } from "@/lib/similarMatchMemory";
import {
  DEFAULT_LEAGUE_KEY,
  LEAGUE_PRESETS,
  LEAGUE_PRESET_MAP,
} from "@/lib/leaguePresets";

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

  odd_mais_25: string;
  odd_menos_25: string;
  odd_mais_35: string;
  odd_menos_35: string;
  odd_ambas_marcam: string;
  odd_ambas_nao_marcam: string;

  odd_casa: string;
  odd_empate: string;
  odd_fora: string;
  odd_1x: string;
  odd_2x: string;
  odd_1x_menos_35: string;
  odd_2x_menos_35: string;
  odd_1x_mais_15: string;
  odd_2x_mais_15: string;

  banca: string;
  fracao_kelly: string;
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

  odd_mais_25: "0",
  odd_menos_25: "0",
  odd_mais_35: "0",
  odd_menos_35: "0",
  odd_ambas_marcam: "0",
  odd_ambas_nao_marcam: "0",

  odd_casa: "0",
  odd_empate: "0",
  odd_fora: "0",
  odd_1x: "0",
  odd_2x: "0",
  odd_1x_menos_35: "0",
  odd_2x_menos_35: "0",
  odd_1x_mais_15: "0",
  odd_2x_mais_15: "0",

  banca: "100",
  fracao_kelly: "1",
  ...LEAGUE_PRESET_MAP[DEFAULT_LEAGUE_KEY],
};

function formatBankrollForInput(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0";
  return Number(value.toFixed(2)).toString();
}

const loadingSteps = [
  "Running simulations...",
  "Calculating probabilities...",
  "Comparing market prices...",
  "Generating recommendations...",
];

const SCORE_MATRIX_MAX_GOALS = 10;

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scorelab-stage-3d scorelab-board-3d scorelab-analytics-panel relative overflow-hidden rounded-[28px] border border-white/8 p-5">
      <div className="relative z-10 mb-5 flex items-center justify-between gap-3 border-b border-white/6 pb-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white/58">
          {title}
        </h3>
        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_18px_var(--scorelab-accent-b)]" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  description?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/56">
        {label}
      </label>
      <input
        type={type}
        step={type === "number" ? "any" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="scorelab-premium-input h-10 w-full rounded-xl border px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
      />
      {description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  description,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  description?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.13em] text-white/56">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="scorelab-premium-input h-10 w-full rounded-xl border px-3 text-sm text-white focus:outline-none"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-background text-foreground"
          >
            {option.label}
          </option>
        ))}
      </select>
      {description ? (
        <p className="mt-1 text-[11px] leading-relaxed text-white/45">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function InsightTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="scorelab-board-3d scorelab-tilt-3d scorelab-metric-object rounded-2xl border border-white/8 p-4">
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
      <p className="mt-1 text-xs text-white/45">{hint}</p>
    </div>
  );
}

function StepChip({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition-colors ${
        active
          ? "bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/25"
          : "bg-white/[0.05] text-white/45 ring-1 ring-white/10"
      }`}
    >
      {label}
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

  if (
    normalized.includes("1x") &&
    (normalized.includes("mais de 1.5") || normalized.includes("+1,5") || normalized.includes("+1.5") || normalized.includes("over 1.5"))
  ) {
    return "1X + Over 1.5";
  }
  if (
    normalized.includes("2x") &&
    (normalized.includes("mais de 1.5") || normalized.includes("+ de 1,5") || normalized.includes("+1,5") || normalized.includes("+1.5") || normalized.includes("over 1.5"))
  ) {
    return "2X + Over 1.5";
  }
  if (
    normalized.includes("1x") &&
    (normalized.includes("menos de 3.5") || normalized.includes("under 3.5"))
  ) {
    return "1X + Under 3.5";
  }
  if (
    normalized.includes("2x") &&
    (normalized.includes("menos de 3.5") || normalized.includes("under 3.5"))
  ) {
    return "2X + Under 3.5";
  }
  if (normalized.includes("mais de 2.5")) return "Over 2.5";
  if (normalized.includes("menos de 2.5")) return "Under 2.5";
  if (normalized.includes("mais de 3.5")) return "Over 3.5";
  if (normalized.includes("menos de 3.5")) return "Under 3.5";
  if (
    normalized.includes("ambas marcam") &&
    !normalized.includes("nÃ£o") &&
    !normalized.includes("nao")
  ) {
    return "BTTS Yes";
  }
  if (
    normalized.includes("ambas nÃ£o marcam") ||
    normalized.includes("ambas nao marcam")
  ) {
    return "BTTS No";
  }

  if (normalized === "casa") return "Home";
  if (normalized === "empate") return "Draw";
  if (normalized === "fora") return "Away";
  if (normalized === "1x") return "1X";
  if (normalized === "2x") return "2X";

  return name;
}

function mapDecision(decisao: string): "Bet" | "No Bet" | "Caution" {
  const normalized = decisao.trim().toLowerCase();

  if (normalized.includes("apostar")) return "Bet";
  if (normalized.includes("nÃ£o") || normalized.includes("nao")) return "No Bet";
  return "Caution";
}

function getExpectedValue(valueBet: number): number {
  return Number(valueBet.toFixed(1));
}

function toPercent(value: number): number {
  return Number(value.toFixed(1));
}

function getImpliedProbFromOdds(odds: number): number {
  return odds > 1 ? toPercent(100 / odds) : 0;
}

function getFallbackKellyPct(modelProb: number, odds: number): number {
  if (odds <= 1) return 0;

  const probability = modelProb / 100;
  const kelly = (odds * probability - 1) / (odds - 1);

  return Number(Math.max(0, kelly * 25).toFixed(2));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function factorial(value: number): number {
  let result = 1;
  for (let i = 2; i <= value; i += 1) result *= i;
  return result;
}

function poissonProbability(lambda: number, goals: number): number {
  return (Math.exp(-lambda) * lambda ** goals) / factorial(goals);
}

function dixonColesTau(
  homeGoals: number,
  awayGoals: number,
  homeLambda: number,
  awayLambda: number,
  rho: number
): number {
  if (homeGoals === 0 && awayGoals === 0) return 1 - homeLambda * awayLambda * rho;
  if (homeGoals === 0 && awayGoals === 1) return 1 + homeLambda * rho;
  if (homeGoals === 1 && awayGoals === 0) return 1 + awayLambda * rho;
  if (homeGoals === 1 && awayGoals === 1) return 1 - rho;
  return 1;
}

function getHybridMarketProbability({
  market,
  homeLambda,
  awayLambda,
  rho,
}: {
  market: "1X + Under 3.5" | "2X + Under 3.5" | "1X + Over 1.5" | "2X + Over 1.5";
  homeLambda: number;
  awayLambda: number;
  rho: number;
}): number {
  const matrix: number[][] = [];
  let total = 0;

  for (let homeGoals = 0; homeGoals <= SCORE_MATRIX_MAX_GOALS; homeGoals += 1) {
    matrix[homeGoals] = [];
    for (let awayGoals = 0; awayGoals <= SCORE_MATRIX_MAX_GOALS; awayGoals += 1) {
      const base =
        poissonProbability(homeLambda, homeGoals) *
        poissonProbability(awayLambda, awayGoals);
      const adjusted = Math.max(
        base * dixonColesTau(homeGoals, awayGoals, homeLambda, awayLambda, rho),
        0
      );
      matrix[homeGoals][awayGoals] = adjusted;
      total += adjusted;
    }
  }

  if (total <= 0) return 0;

  let probability = 0;
  for (let homeGoals = 0; homeGoals <= SCORE_MATRIX_MAX_GOALS; homeGoals += 1) {
    for (let awayGoals = 0; awayGoals <= SCORE_MATRIX_MAX_GOALS; awayGoals += 1) {
      const totalGoals = homeGoals + awayGoals;
      const normalizedProbability = matrix[homeGoals][awayGoals] / total;
      const isUnder35 = totalGoals <= 3;
      const isOver15 = totalGoals >= 2;
      const is1x = homeGoals >= awayGoals;
      const is2x = awayGoals >= homeGoals;

      if (market === "1X + Under 3.5" && is1x && isUnder35) {
        probability += normalizedProbability;
      }

      if (market === "2X + Under 3.5" && is2x && isUnder35) {
        probability += normalizedProbability;
      }

      if (market === "1X + Over 1.5" && is1x && isOver15) {
        probability += normalizedProbability;
      }

      if (market === "2X + Over 1.5" && is2x && isOver15) {
        probability += normalizedProbability;
      }
    }
  }

  return probability;
}

function buildDoubleChanceFallbackResult({
  market,
  odds,
  first,
  second,
  bankroll,
  kellyFraction,
}: {
  market: "1X" | "2X";
  odds: number;
  first: AnalysisResult;
  second: AnalysisResult;
  bankroll: number;
  kellyFraction: number;
}): AnalysisResult {
  const modelProb = toPercent(Math.min(99, first.modelProb + second.modelProb));
  const hasMarketOdds = odds > 1;
  const impliedProb = hasMarketOdds ? getImpliedProbFromOdds(odds) : 0;
  const valueBet = hasMarketOdds ? toPercent(modelProb - impliedProb) : 0;
  const kelly = hasMarketOdds ? getFallbackKellyPct(modelProb, odds) : 0;
  const confidence = toPercent((first.confidence + second.confidence) / 2);
  const edgeLowerBound = hasMarketOdds ? valueBet : -999;
  const robustness =
    hasMarketOdds && valueBet > 0
      ? Math.min(first.robustness ?? 0, second.robustness ?? 0)
      : 0;

  const baseResult: AnalysisResult = {
    market,
    odds: hasMarketOdds ? odds : 0,
    modelProb,
    impliedProb,
    fairProb: impliedProb,
    valueBet,
    edgeLowerBound,
    robustness,
    uncertainty: Math.max(first.uncertainty ?? 0, second.uncertainty ?? 0),
    kelly,
    stake: hasMarketOdds
      ? Number((bankroll * (kelly / 100) * Math.max(0, kellyFraction)).toFixed(2))
      : 0,
    risk: odds < 1.5 ? "Low" : "Medium",
    confidence,
    decision: "No Bet",
    expectedValue: getExpectedValue(valueBet),
    oddsBand: getOddsBand(odds),
    marketFamily: getMarketFamily(market),
    backendDecision: "Frontend fallback",
    backendClassification: hasMarketOdds ? "Derived" : "Needs odds",
  };

  return decorateResult({
    ...baseResult,
    decision: getDecisionFromMetrics(baseResult),
  });
}

function ensureDoubleChanceResults(
  mappedResults: AnalysisResult[],
  currentFormData: FormData
): AnalysisResult[] {
  const has1x = mappedResults.some((result) => result.market === "1X");
  const has2x = mappedResults.some((result) => result.market === "2X");
  const home = mappedResults.find((result) => result.market === "Home");
  const draw = mappedResults.find((result) => result.market === "Draw");
  const away = mappedResults.find((result) => result.market === "Away");

  if ((!home || !draw || !away) || (has1x && has2x)) {
    return mappedResults;
  }

  const nextResults = [...mappedResults];
  const bankroll = Number(currentFormData.banca);
  const kellyFraction = Number(currentFormData.fracao_kelly);

  if (!has1x) {
    nextResults.push(
      buildDoubleChanceFallbackResult({
        market: "1X",
        odds: Number(currentFormData.odd_1x),
        first: home,
        second: draw,
        bankroll,
        kellyFraction,
      })
    );
  }

  if (!has2x) {
    nextResults.push(
      buildDoubleChanceFallbackResult({
        market: "2X",
        odds: Number(currentFormData.odd_2x),
        first: away,
        second: draw,
        bankroll,
        kellyFraction,
      })
    );
  }

  return nextResults;
}

function buildHybridMarketFallbackResult({
  market,
  odds,
  homeLambda,
  awayLambda,
  rho,
  bankroll,
  kellyFraction,
}: {
  market: "1X + Under 3.5" | "2X + Under 3.5" | "1X + Over 1.5" | "2X + Over 1.5";
  odds: number;
  homeLambda: number;
  awayLambda: number;
  rho: number;
  bankroll: number;
  kellyFraction: number;
}): AnalysisResult {
  const modelProb = toPercent(
    getHybridMarketProbability({
      market,
      homeLambda,
      awayLambda,
      rho,
    }) * 100
  );
  const hasMarketOdds = odds > 1;
  const impliedProb = hasMarketOdds ? getImpliedProbFromOdds(odds) : 0;
  const valueBet = hasMarketOdds ? toPercent(modelProb - impliedProb) : 0;
  const kelly = hasMarketOdds ? getFallbackKellyPct(modelProb, odds) : 0;
  const edgeLowerBound = hasMarketOdds ? valueBet : -999;
  const robustness = hasMarketOdds && valueBet > 0 ? 100 : 0;
  const confidence = clampNumber(
    4.8 + Math.max(0, valueBet) * 0.08 + (robustness / 100) * 1.4,
    0,
    8
  );

  const baseResult: AnalysisResult = {
    market,
    odds: hasMarketOdds ? odds : 0,
    modelProb,
    impliedProb,
    fairProb: impliedProb,
    valueBet,
    edgeLowerBound,
    robustness,
    uncertainty: 0,
    kelly,
    stake: hasMarketOdds
      ? Number((bankroll * (kelly / 100) * Math.max(0, kellyFraction)).toFixed(2))
      : 0,
    risk: odds < 1.7 ? "Low" : "Medium",
    confidence: toPercent(confidence),
    decision: "No Bet",
    expectedValue: getExpectedValue(valueBet),
    oddsBand: getOddsBand(odds),
    marketFamily: getMarketFamily(market),
    backendDecision: "Frontend exact score-matrix fallback",
    backendClassification: hasMarketOdds ? "Matrix derived" : "Needs odds",
  };

  return decorateResult({
    ...baseResult,
    decision: getDecisionFromMetrics(baseResult),
  });
}

function ensureHybridMarketResults({
  mappedResults,
  currentFormData,
  homeLambda,
  awayLambda,
}: {
  mappedResults: AnalysisResult[];
  currentFormData: FormData;
  homeLambda: number;
  awayLambda: number;
}): AnalysisResult[] {
  const has1xUnder35 = mappedResults.some(
    (result) => result.market === "1X + Under 3.5"
  );
  const has2xUnder35 = mappedResults.some(
    (result) => result.market === "2X + Under 3.5"
  );
  const has1xOver15 = mappedResults.some(
    (result) => result.market === "1X + Over 1.5"
  );
  const has2xOver15 = mappedResults.some(
    (result) => result.market === "2X + Over 1.5"
  );

  if (has1xUnder35 && has2xUnder35 && has1xOver15 && has2xOver15) return mappedResults;

  const nextResults = [...mappedResults];
  const bankroll = Number(currentFormData.banca);
  const kellyFraction = Number(currentFormData.fracao_kelly);
  const rho = Number(currentFormData.dixon_coles_rho);

  if (!has1xUnder35) {
    nextResults.push(
      buildHybridMarketFallbackResult({
        market: "1X + Under 3.5",
        odds: Number(currentFormData.odd_1x_menos_35),
        homeLambda,
        awayLambda,
        rho: Number.isFinite(rho) ? rho : -0.08,
        bankroll,
        kellyFraction,
      })
    );
  }

  if (!has2xUnder35) {
    nextResults.push(
      buildHybridMarketFallbackResult({
        market: "2X + Under 3.5",
        odds: Number(currentFormData.odd_2x_menos_35),
        homeLambda,
        awayLambda,
        rho: Number.isFinite(rho) ? rho : -0.08,
        bankroll,
        kellyFraction,
      })
    );
  }

  if (!has1xOver15) {
    nextResults.push(
      buildHybridMarketFallbackResult({
        market: "1X + Over 1.5",
        odds: Number(currentFormData.odd_1x_mais_15),
        homeLambda,
        awayLambda,
        rho: Number.isFinite(rho) ? rho : -0.08,
        bankroll,
        kellyFraction,
      })
    );
  }

  if (!has2xOver15) {
    nextResults.push(
      buildHybridMarketFallbackResult({
        market: "2X + Over 1.5",
        odds: Number(currentFormData.odd_2x_mais_15),
        homeLambda,
        awayLambda,
        rho: Number.isFinite(rho) ? rho : -0.08,
        bankroll,
        kellyFraction,
      })
    );
  }

  return nextResults;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function MatchAnalysis() {
  const initialBankrollStats = getBankrollStats();
  const [formData, setFormData] = useState<FormData>(() => ({
    ...initialFormData,
    banca: formatBankrollForInput(initialBankrollStats.currentBankroll),
  }));
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [showLeagueAdvanced, setShowLeagueAdvanced] = useState(false);
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

  const handleLeagueChange = (league: string) => {
    const preset = LEAGUE_PRESET_MAP[league];

    setFormData((prev) => ({
      ...prev,
      liga: league,
      ...(preset ?? {}),
    }));
  };

  const selectedLeaguePreset =
    LEAGUE_PRESET_MAP[formData.liga] ?? LEAGUE_PRESET_MAP[DEFAULT_LEAGUE_KEY];

  const setupProgress = useMemo(() => {
    const leagueReady = Boolean(formData.liga);
    const teamsReady = Boolean(formData.equipa_casa && formData.equipa_fora);
    const statsReady =
      Number(formData.jogos_casa) > 0 &&
      Number(formData.jogos_fora) > 0 &&
      Number(formData.golos_marcados_casa) >= 0 &&
      Number(formData.golos_marcados_fora) >= 0;
    const oddsReady =
      Number(formData.odd_casa) > 1 &&
      Number(formData.odd_empate) > 1 &&
      Number(formData.odd_fora) > 1 &&
      Number(formData.odd_1x) > 1 &&
      Number(formData.odd_2x) > 1 &&
      Number(formData.odd_1x_menos_35) > 1 &&
      Number(formData.odd_2x_menos_35) > 1 &&
      Number(formData.odd_1x_mais_15) > 1 &&
      Number(formData.odd_2x_mais_15) > 1 &&
      Number(formData.odd_mais_25) > 1 &&
      Number(formData.odd_menos_25) > 1;
    const bankrollReady =
      Number(formData.banca) > 0 && Number(formData.fracao_kelly) > 0;

    const completed = [
      leagueReady,
      teamsReady,
      statsReady,
      oddsReady,
      bankrollReady,
    ].filter(Boolean).length;

    return {
      leagueReady,
      teamsReady,
      statsReady,
      oddsReady,
      bankrollReady,
      completed,
      pct: (completed / 5) * 100,
    };
  }, [formData]);

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

  const bettingRecommendations = useMemo(() => {
    return results
      .filter((result) => result.tier && result.tier !== "discard")
      .sort((a, b) => {
        const scoreDiff = (b.eliteScore ?? 0) - (a.eliteScore ?? 0);
        if (scoreDiff !== 0) return scoreDiff;

        return (b.edgeLowerBound ?? b.valueBet) - (a.edgeLowerBound ?? a.valueBet);
      })
      .slice(0, 5)
      .map((result) => ({
        result,
        stakeRecommendation: getRecommendedStake(
          bankrollStats.currentBankroll,
          result.tier || "discard",
          exposureSummary.openExposurePct
        ),
      }));
  }, [bankrollStats.currentBankroll, exposureSummary.openExposurePct, results]);

  const chartData = useMemo(
    () =>
      results.map((r) => ({
        name: r.market,
        model: r.modelProb,
        implied: r.impliedProb,
      })),
    [results]
  );
  const chartHeight = Math.max(280, chartData.length * 30);

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

  const similarMatchMemory = useMemo(() => {
    if (!bestBet) return null;

    return getSimilarMatchMemory({
      analyses: existingAnalyses,
      currentResult: bestBet,
      currentLeague: formData.liga || "Unspecified",
      currentTotalXg: summary.totalXg,
    });
  }, [bestBet, existingAnalyses, formData.liga, summary.totalXg]);

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

        odd_mais_25: Number(formData.odd_mais_25),
        odd_menos_25: Number(formData.odd_menos_25),
        odd_mais_35: Number(formData.odd_mais_35),
        odd_menos_35: Number(formData.odd_menos_35),
        odd_ambas_marcam: Number(formData.odd_ambas_marcam),
        odd_ambas_nao_marcam: Number(formData.odd_ambas_nao_marcam),

        odd_casa: Number(formData.odd_casa),
        odd_empate: Number(formData.odd_empate),
        odd_fora: Number(formData.odd_fora),
        odd_1x: Number(formData.odd_1x),
        odd_2x: Number(formData.odd_2x),
        odd_1x_menos_35: Number(formData.odd_1x_menos_35),
        odd_2x_menos_35: Number(formData.odd_2x_menos_35),
        odd_1x_mais_15: Number(formData.odd_1x_mais_15),
        odd_2x_mais_15: Number(formData.odd_2x_mais_15),

        banca: Number(formData.banca),
        fracao_kelly: Number(formData.fracao_kelly),
        league_home_goals_avg: Number(formData.league_home_goals_avg),
        league_away_goals_avg: Number(formData.league_away_goals_avg),
        dixon_coles_rho: Number(formData.dixon_coles_rho),
        shrinkage_matches: Number(formData.shrinkage_matches),
      };

      const response = await fetch(buildApiUrl("/analyze"), {
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

      const backendResults: AnalysisResult[] = data.mercados.map((m) => {
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
      const doubleChanceResults = ensureDoubleChanceResults(backendResults, formData);
      const mappedResults = ensureHybridMarketResults({
        mappedResults: doubleChanceResults,
        currentFormData: formData,
        homeLambda: data.lambda_casa,
        awayLambda: data.lambda_fora,
      });
      const calibrationModel = buildCalibrationModel(existingAnalyses);
      const calibratedResults = mappedResults.map((result) => {
        const calibrated = applyCalibrationToResult(
          result,
          formData.liga || "Unspecified",
          calibrationModel
        );

        return decorateResult({
          ...calibrated,
          decision: getDecisionFromMetrics(calibrated),
        });
      });

      const bestResultForSummary = [...calibratedResults].sort(
        (a, b) => (b.eliteScore ?? 0) - (a.eliteScore ?? 0)
      )[0];

      const summaryData = {
        homeXg: data.lambda_casa,
        awayXg: data.lambda_fora,
        totalXg: data.total_golos_esperados,
        confidence: Number((bestResultForSummary?.confidence ?? 0).toFixed(1)),
      };

      setResults(calibratedResults);
      setSummary(summaryData);

      const bankrollBefore = calculateNextBankrollBefore();

      const analysisToSave: SavedAnalysis = {
        id: createAnalysisId(),
        createdAt: new Date().toISOString(),
        homeTeam: formData.equipa_casa,
        awayTeam: formData.equipa_fora,
        league: formData.liga,
        summary: summaryData,
        results: calibratedResults,
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
        <div className="mb-8 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={1.7} />
              Guided Analysis Flow
            </div>
            <h1 className="mt-3 text-2xl font-bold text-foreground">
              Match Analysis
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the competition, add team stats, and compare your model against the market.
            </p>
          </div>
          <div className="flex items-center gap-3">
              <div className="scorelab-board-3d scorelab-tilt-3d hidden rounded-2xl bg-card ring-surface px-4 py-3 card-shadow md:block">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Setup Progress
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                {Math.round(setupProgress.pct)}%
              </p>
            </div>
            <Button variant="outline" size="sm">
              <Save className="mr-1 h-4 w-4" strokeWidth={1.5} /> Save
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="scorelab-stage-3d scorelab-board-3d rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <div className="scorelab-depth-grid pointer-events-none absolute inset-x-10 bottom-0 h-32 opacity-35" />
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                      Analysis Setup
                    </p>
                    <h2 className="mt-2 text-lg font-semibold text-white">
                      Fill the model in the order you think
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">
                      Competition first, then team sample, then market odds. This
                      keeps the analysis grounded before the model makes a call.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                      Ready
                    </p>
                    <p className="mt-1 text-xl font-semibold text-white">
                      {setupProgress.completed}/5
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <Progress value={setupProgress.pct} className="h-2 bg-white/5" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StepChip label="League" active={setupProgress.leagueReady} />
                    <StepChip label="Teams" active={setupProgress.teamsReady} />
                    <StepChip label="Stats" active={setupProgress.statsReady} />
                    <StepChip label="Odds" active={setupProgress.oddsReady} />
                    <StepChip label="Bankroll" active={setupProgress.bankrollReady} />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <SectionCard title="League Setup">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Start with the competition
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            We auto-fill real 2025/26 scoring averages for the selected league,
                            then suggest safe model defaults for low-score adjustment and
                            small-sample protection.
                          </p>
                        </div>
                        <div className="rounded-full bg-white/[0.03] ring-1 ring-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          Auto-fill
                        </div>
                      </div>
                    </div>

                    <SelectField
                      label="Competition"
                      value={formData.liga}
                      onChange={handleLeagueChange}
                      options={[...LEAGUE_PRESETS]
                        .sort((a, b) =>
                          `${a.country} ${a.label}`.localeCompare(
                            `${b.country} ${b.label}`
                          )
                        )
                        .map((preset) => ({
                          value: preset.key,
                          label: `${preset.country} · ${preset.label}`,
                        }))}
                      description="Pick the league first so the model starts from the right scoring baseline."
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <InsightTile
                        label="Country"
                        value={selectedLeaguePreset.country}
                        hint={selectedLeaguePreset.tier}
                      />
                      <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-4">
                        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                          <Database className="h-3.5 w-3.5" strokeWidth={1.7} />
                          Data Source
                        </p>
                        <a
                          href={selectedLeaguePreset.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 block text-sm font-medium text-foreground underline decoration-white/20 underline-offset-4"
                        >
                          {selectedLeaguePreset.sourceLabel}
                        </a>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedLeaguePreset.sourceNote}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Model defaults loaded
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Keep these collapsed unless you want to fine-tune the league baseline.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowLeagueAdvanced((prev) => !prev)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/60 transition hover:bg-white/[0.08]"
                        >
                          {showLeagueAdvanced ? "Hide Advanced" : "Show Advanced"}
                          <ChevronDown
                            className={`h-3.5 w-3.5 transition-transform duration-300 ${
                              showLeagueAdvanced ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                          </div>

                      <AnimatePresence initial={false}>
                        {showLeagueAdvanced && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                              <FormField
                                label="Home Goals Baseline"
                                value={formData.league_home_goals_avg}
                                onChange={(v) => updateField("league_home_goals_avg", v)}
                                type="number"
                                description="Average goals scored by home teams in this league."
                              />
                              <FormField
                                label="Away Goals Baseline"
                                value={formData.league_away_goals_avg}
                                onChange={(v) => updateField("league_away_goals_avg", v)}
                                type="number"
                                description="Average goals scored by away teams in this league."
                              />
                              <FormField
                                label="Tight-Score Tuning"
                                value={formData.dixon_coles_rho}
                                onChange={(v) => updateField("dixon_coles_rho", v)}
                                type="number"
                                description="Adjusts how much the model respects very common scores like 0-0, 1-0 and 1-1."
                              />
                              <FormField
                                label="Safety For Limited Data"
                                value={formData.shrinkage_matches}
                                onChange={(v) => updateField("shrinkage_matches", v)}
                                type="number"
                                description="Higher values make the model trust league averages more when team samples are small."
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </SectionCard>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SectionCard title="Home Team">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] ring-1 ring-white/5 px-4 py-2.5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                          Home Side
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Use home-only performance and recent home form.
                        </p>
                      </div>
                      <Target className="h-4 w-4 text-emerald-300" strokeWidth={1.7} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <FormField
                          label="Team Name"
                          value={formData.equipa_casa}
                          onChange={(v) => updateField("equipa_casa", v)}
                        />
                      </div>
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
                    <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] ring-1 ring-white/5 px-4 py-2.5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
                          Away Side
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Use away-only performance and recent away form.
                        </p>
                      </div>
                      <ShieldCheck className="h-4 w-4 text-sky-300" strokeWidth={1.7} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <FormField
                          label="Team Name"
                          value={formData.equipa_fora}
                          onChange={(v) => updateField("equipa_fora", v)}
                        />
                      </div>
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
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <SectionCard title="Market Odds">
                  <div className="space-y-5">
                    <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Market Snapshot
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Add the prices exactly as offered by the bookmaker. Cleaner
                        inputs here produce cleaner implied probabilities and a more
                        trustworthy value comparison.
                      </p>
                    </div>
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

                    <div>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                        Double Chance
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <FormField
                          label="1X"
                          value={formData.odd_1x}
                          onChange={(v) => updateField("odd_1x", v)}
                          type="number"
                          description="Home or draw."
                        />
                        <FormField
                          label="2X"
                          value={formData.odd_2x}
                          onChange={(v) => updateField("odd_2x", v)}
                          type="number"
                          description="Away or draw."
                        />
                        <FormField
                          label="1X + Under 3.5"
                          value={formData.odd_1x_menos_35}
                          onChange={(v) => updateField("odd_1x_menos_35", v)}
                          type="number"
                          description="Home or draw, with 3 goals or fewer."
                        />
                        <FormField
                          label="2X + Under 3.5"
                          value={formData.odd_2x_menos_35}
                          onChange={(v) => updateField("odd_2x_menos_35", v)}
                          type="number"
                          description="Away or draw, with 3 goals or fewer."
                        />
                        <FormField
                          label="1X + Over 1.5"
                          value={formData.odd_1x_mais_15}
                          onChange={(v) => updateField("odd_1x_mais_15", v)}
                          type="number"
                          description="Home or draw, with at least 2 goals."
                        />
                        <FormField
                          label="2X + Over 1.5"
                          value={formData.odd_2x_mais_15}
                          onChange={(v) => updateField("odd_2x_mais_15", v)}
                          type="number"
                          description="Away or draw, with at least 2 goals."
                        />
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <div className="space-y-6">
                  <SectionCard title="Bankroll Settings">
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          Risk Control
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          These settings control how aggressive the final stake can be.
                          Keep them conservative if you want smaller recommended exposure.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <FormField
                          label="Bankroll (EUR)"
                          value={formData.banca}
                          onChange={(v) => updateField("banca", v)}
                          type="number"
                        />
                        <FormField
                          label="Kelly Fraction"
                          value={formData.fracao_kelly}
                          onChange={(v) => updateField("fracao_kelly", v)}
                          type="number"
                          description="Lower values make staking calmer and more protective."
                        />
                      </div>
                    </div>
                  </SectionCard>

                  <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                          Ready To Analyze
                        </p>
                        <p className="mt-1 text-sm text-white">
                          {setupProgress.completed >= 4
                            ? "The setup looks strong enough to run."
                            : "Finish the core inputs for a more trustworthy output."}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">
                          {Math.round(setupProgress.pct)}%
                        </p>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">
                          Complete
                        </p>
                      </div>
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
                  </div>
                </div>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
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
                      className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                    >
                      <p className="text-xs uppercase tracking-wider text-white/45">
                        {s.label}
                      </p>
                      <p className="mt-1 text-2xl font-bold font-mono-data text-white">
                        {s.value}
                      </p>
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="overflow-hidden rounded-3xl border border-primary/20 bg-[linear-gradient(180deg,rgba(20,83,45,0.22)_0%,rgba(8,18,40,0.98)_100%)] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
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
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-xl border border-white/8 bg-white/[0.04] p-3">
                              <p className="text-xs text-white/45">
                                Expected Goals
                              </p>
                              <p className="text-lg font-bold font-mono-data text-white">
                                {summary.totalXg.toFixed(2)}
                              </p>
                              <p className="text-xs text-white/45">
                                Home {summary.homeXg.toFixed(2)} + Away{" "}
                                {summary.awayXg.toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-xl border border-white/8 bg-white/[0.04] p-3">
                              <p className="text-xs text-white/45">
                                Probability Advantage
                              </p>
                              <p className="text-lg font-bold font-mono-data text-primary">
                                {bestBet ? `${bestBet.valueBet.toFixed(1)}%` : "--"}
                              </p>
                              <p className="text-xs text-white/45">
                                Model vs Market
                              </p>
                            </div>
                          </div>
                          <p className="text-sm leading-relaxed text-white/65">
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
                  className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                >
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/45">
                    Betting Recommendation
                  </h3>
                  {bestBet ? (
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed text-white/65">
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
                          {formatCurrency(bestBet.stake)}
                        </span>
                        .
                      </p>

                      {bestBetStakeRecommendation && (
                        <div className="rounded-xl border border-white/8 bg-white/[0.04] p-3">
                          <p className="mb-1 text-xs uppercase tracking-wider text-white/45">
                            Recommended Stake
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-lg font-bold font-mono-data text-white">
                                {formatCurrency(
                                  bestBetStakeRecommendation.recommendedAmount
                                )}
                              </p>
                              <p className="text-xs text-white/45">
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
                            <p className="mt-2 text-xs text-white/45">
                              {bestBetStakeRecommendation.reason}
                            </p>
                          )}
                        </div>
                      )}

                      {bettingRecommendations.length > 0 && (
                        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                          <p className="mb-3 text-xs uppercase tracking-wider text-white/45">
                            Recommendation Queue
                          </p>
                          <div className="space-y-2">
                            {bettingRecommendations.map(({ result, stakeRecommendation }) => (
                              <div
                                key={result.market}
                                className="flex flex-col gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-foreground">
                                      {result.market}
                                    </p>
                                    {result.tier ? <TierBadge tier={result.tier} /> : null}
                                  </div>
                                  <p className="mt-1 text-xs text-white/45">
                                    Edge floor{" "}
                                    <span className="font-mono-data text-white/70">
                                      {(result.edgeLowerBound ?? result.valueBet).toFixed(1)}%
                                    </span>{" "}
                                    · Model{" "}
                                    <span className="font-mono-data text-white/70">
                                      {result.modelProb.toFixed(1)}%
                                    </span>{" "}
                                    · Odds{" "}
                                    <span className="font-mono-data text-white/70">
                                      {result.odds.toFixed(2)}
                                    </span>
                                  </p>
                                </div>
                                <div className="text-left sm:text-right">
                                  <p className="font-mono-data text-sm font-semibold text-white">
                                    {formatCurrency(stakeRecommendation.recommendedAmount)}
                                  </p>
                                  <p className="text-xs text-white/45">
                                    {stakeRecommendation.recommendedPct.toFixed(2)}%
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-white/60">
                      No recommendation available.
                    </p>
                  )}
                </motion.div>

                {bestBet && historicalSignals.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.38 }}
                    className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-300" />
                      <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                        Historical Signals
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {historicalSignals.map((signal) => (
                        <div
                          key={signal.label}
                          className="rounded-xl border border-white/8 bg-white/[0.04] p-3"
                        >
                          <p className="text-xs uppercase tracking-wider text-white/45">
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

                {bestBet && similarMatchMemory && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.39 }}
                    className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                          Similar Match Memory
                        </p>
                        <h3 className="mt-1 text-lg font-semibold text-white">
                          {similarMatchMemory.verdict}
                        </h3>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                          similarMatchMemory.tone === "positive"
                            ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200"
                            : similarMatchMemory.tone === "negative"
                            ? "border-red-300/20 bg-red-300/[0.08] text-red-200"
                            : "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200"
                        }`}
                      >
                        Real Audits Only
                      </span>
                    </div>

                    <p className="text-sm leading-relaxed text-white/65">
                      {similarMatchMemory.summary}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                          Samples
                        </p>
                        <p className="mt-1 font-mono-data text-lg font-semibold text-white">
                          {similarMatchMemory.samples}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                          Actual
                        </p>
                        <p className="mt-1 font-mono-data text-lg font-semibold text-white">
                          {similarMatchMemory.hitRate.toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                          Expected
                        </p>
                        <p className="mt-1 font-mono-data text-lg font-semibold text-white">
                          {similarMatchMemory.expectedHitRate.toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                          Avg Similarity
                        </p>
                        <p className="mt-1 font-mono-data text-lg font-semibold text-white">
                          {similarMatchMemory.avgSimilarity.toFixed(0)}
                        </p>
                      </div>
                    </div>

                    {similarMatchMemory.examples.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {similarMatchMemory.examples.map((example) => (
                          <div
                            key={`${example.match}-${example.market}-${example.similarity}`}
                            className="rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-medium text-white">
                                {example.match}
                              </p>
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                  example.outcome === "green"
                                    ? "bg-emerald-300/[0.09] text-emerald-200"
                                    : "bg-red-300/[0.09] text-red-200"
                                }`}
                              >
                                {example.outcome}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-white/45">
                              {example.league} · Odds {example.odds.toFixed(2)} · Model{" "}
                              {example.modelProb.toFixed(1)}% · Similarity{" "}
                              {example.similarity.toFixed(0)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                >
                  <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/45">
                    Model vs Market Probability
                  </h3>
                  <ResponsiveContainer width="100%" height={chartHeight}>
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
                        width={132}
                      />
                      <Tooltip
                        contentStyle={{
                          background:
                            "linear-gradient(180deg, rgba(8,21,36,0.98), rgba(3,9,20,0.995))",
                          border: "1px solid rgba(190,255,246,0.16)",
                          borderRadius: 16,
                          boxShadow:
                            "0 22px 58px -28px rgba(0,0,0,0.78)",
                          color: "rgba(255,255,255,0.88)",
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "rgba(226,255,251,0.62)" }}
                        itemStyle={{ color: "rgba(255,255,255,0.86)" }}
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
                  className="overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                >
                  <div className="p-5 pb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-white/45">
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
                              className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-white/45"
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
                              <td className="px-4 py-3 font-mono-data text-white/65">
                                {r.odds.toFixed(2)}
                              </td>
                              <td className="px-4 py-3 font-mono-data text-foreground">
                                {r.modelProb.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 font-mono-data text-white/65">
                                {r.impliedProb.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3">
                                <ValueBadge value={r.valueBet} />
                              </td>
                              <td className="px-4 py-3 font-mono-data text-white/65">
                                {r.kelly.toFixed(1)}%
                              </td>
                              <td className="px-4 py-3 font-mono-data text-foreground">
                                {formatCurrency(r.stake)}
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
                                    {formatCurrency(
                                      stakeRecommendation.recommendedAmount
                                    )}
                                  </p>
                                  <p className="text-xs text-white/45">
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
                    className="rounded-3xl border border-primary/20 bg-[linear-gradient(180deg,rgba(20,83,45,0.22)_0%,rgba(8,18,40,0.98)_100%)] p-5 ring-1 ring-primary/20 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Strongest Value Opportunity
                      </h3>
                    </div>
                    <p className="text-lg font-bold text-white">
                      {bestBet.market}
                    </p>
                    <p className="mt-1 text-sm text-white/65">
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
                className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-16 text-center shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
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
