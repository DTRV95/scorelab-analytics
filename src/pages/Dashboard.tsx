import { AppLayout } from "@/components/layout/AppLayout";
import {
  LayoutCustomizeButton,
  LayoutSection,
  useSectionLayout,
  type SectionDef,
} from "@/components/LayoutCustomizer";
import { MatchResultsPanel } from "@/components/MatchResultsPanel";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { SystemPulse3D } from "@/components/SystemPulse3D";
import { HudStateIcon, HudStatusPill } from "@/components/HudLayer";
import { PulseOnChange } from "@/components/MotionIntelligence";
import { MiniHeatmap } from "@/components/DataObjects";
import { StadiumLightSweep } from "@/components/ArenaEffects";
import { motion, AnimatePresence, animate } from "framer-motion";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Crosshair,
  Gauge,
  Inbox,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Line,
  CartesianGrid,
  Area,
  ComposedChart,
  Bar,
} from "recharts";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMultipleMarketPerformance,
} from "@/lib/multipleStorage";
import { getAdvancedPerformanceBreakdown } from "@/lib/performanceAnalytics";
import type { SavedAnalysis, AnalysisResult } from "@/types/analysis";
import type { MarketPerformance } from "@/lib/portofolioEngine";
import { getDashboardAutoInsights } from "@/lib/edgeInteligence";
import { buildCalibrationModel, calibrateOpportunity } from "@/lib/calibrationEngine";
import {
  buildLeagueIntelligenceRows,
  getLeagueIntelligenceTone,
  type LeagueIntelligenceRow,
} from "@/lib/leagueIntelligence";
import { useScoreLabData } from "@/hooks/useScoreLabData";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const collapse = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1, transition: { duration: 0.2 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type ChartRow = Record<string, string | number | null | undefined>;

type LeaguePerformanceRow = LeagueIntelligenceRow;

function AnimatedNumber({ value }: { value: string | number }) {
  const match = String(value).match(/^(\D*)(-?[\d.,]*\d)(\D*)$/);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!match || !ref.current) return;
    const target = Number(match[2].replace(/,/g, ""));
    if (Number.isNaN(target)) return;
    const decimals = match[2].includes(".") ? match[2].split(".")[1].length : 0;
    const node = ref.current;
    const controls = animate(0, target, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (latest) => {
        node.textContent = latest.toFixed(decimals);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [String(value)]);

  if (!match) return <>{value}</>;

  return (
    <>
      {match[1]}
      <span ref={ref}>0</span>
      {match[3]}
    </>
  );
}

const STAT_TONE_CLASS = {
  positive: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
  negative: "border-red-300/25 bg-red-300/10 text-red-200",
  neutral: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
};

function CompactStatCard({
  label,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: typeof Activity;
}) {
  return (
    <PulseOnChange value={`${value}-${change ?? ""}`}>
      <StadiumLightSweep trigger={`${value}-${change ?? ""}`}>
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
        className="scorelab-board-3d scorelab-tilt-3d scorelab-metric-object relative overflow-hidden rounded-[20px] border border-white/8 px-4 py-3.5"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_20%)] opacity-80" />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-white/38">
              {label}
            </p>
            {Icon ? (
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border ${STAT_TONE_CLASS[changeType]}`}
              >
                <Icon className="h-3 w-3" strokeWidth={2} />
              </span>
            ) : null}
          </div>
          <div className="mt-2 h-1 w-8 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.88),rgba(34,197,94,0.82))]" />
          <p className="mt-3 font-mono-data text-[1.28rem] font-semibold tracking-[-0.03em] text-white md:text-[1.46rem]">
            <AnimatedNumber value={value} />
          </p>
          {change ? (
            <p
              className={`mt-2.5 text-[9.5px] font-semibold uppercase tracking-[0.11em] leading-4 ${
                changeType === "positive"
                  ? "text-emerald-300"
                  : changeType === "negative"
                  ? "text-red-300"
                  : "text-white/42"
              }`}
            >
              {change}
            </p>
          ) : null}
        </div>
      </motion.div>
      </StadiumLightSweep>
    </PulseOnChange>
  );
}

function AutoInsightCard({
  title,
  detail,
  tone,
}: {
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? {
          glow: "from-emerald-300/20 via-emerald-300/6 to-transparent",
          dot: "bg-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.75)]",
          text: "text-emerald-200",
        }
      : tone === "negative"
      ? {
          glow: "from-red-300/18 via-red-300/6 to-transparent",
          dot: "bg-red-300 shadow-[0_0_18px_rgba(248,113,113,0.7)]",
          text: "text-red-200",
        }
      : {
          glow: "from-cyan-300/18 via-cyan-300/6 to-transparent",
          dot: "bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.7)]",
          text: "text-white/72",
        };

  return (
    <StadiumLightSweep trigger={`${title}-${detail}`}>
      <motion.div
        whileHover={{ y: -3, scale: 1.005 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        className="scorelab-board-3d relative min-h-[108px] overflow-hidden rounded-[24px] border border-white/8 p-4"
      >
        <div className={`pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,var(--tw-gradient-stops))] ${toneClass.glow}`} />
        <div className="relative flex h-full gap-3">
          <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${toneClass.dot}`} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
              {title}
            </p>
            <p className={`mt-3 text-sm leading-7 ${toneClass.text}`}>
              {detail}
            </p>
          </div>
        </div>
      </motion.div>
    </StadiumLightSweep>
  );
}

function SectionCard({
  title,
  description,
  badge,
  children,
  className = "",
}: {
  title: string;
  description: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={fadeUp}
      className={`scorelab-board-3d scorelab-analytics-panel overflow-hidden rounded-[26px] border border-white/8 ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-white md:text-[15px]">{title}</h2>
          <p className="mt-1 text-xs leading-6 text-white/58 md:text-[13px]">{description}</p>
        </div>
        {badge ? (
          <span className="scorelab-analytics-badge rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">
      {children}
      </div>
    </motion.section>
  );
}

function DecisionAction({
  label,
  detail,
  icon: Icon,
  onClick,
  tone = "cyan",
}: {
  label: string;
  detail: string;
  icon: typeof Activity;
  onClick: () => void;
  tone?: "cyan" | "emerald" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "from-emerald-300/16 text-emerald-100"
      : tone === "amber"
      ? "from-amber-300/16 text-amber-100"
      : "from-cyan-300/16 text-cyan-100";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-h-[64px] overflow-hidden rounded-xl border border-white/8 bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${toneClass} via-white/[0.035] to-white/[0.015] p-3 text-left transition hover:-translate-y-0.5 hover:border-white/16`}
    >
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-current/35 to-transparent" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-current/15 bg-black/20">
          <Icon className="h-4 w-4" strokeWidth={1.6} />
        </span>
        <ArrowRight className="mt-1.5 h-4 w-4 flex-none text-white/28 transition group-hover:translate-x-0.5 group-hover:text-white/70" strokeWidth={1.6} />
      </div>
      <p className="relative mt-2.5 text-sm font-semibold text-white">{label}</p>
      <p className="relative mt-1 text-xs leading-5 text-white/52">{detail}</p>
    </button>
  );
}

function getBestBet(results: AnalysisResult[]) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const positiveBets = results.filter((r) => r.valueBet > 0);
  if (!positiveBets.length) return null;

  return positiveBets.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
}

function getLeagueStatusTone(status: LeaguePerformanceRow["intelligenceStatus"]) {
  return getLeagueIntelligenceTone(status);
}

function mergeMarketPerformanceRows(
  singles: MarketPerformance[],
  multiples: ReturnType<typeof getMultipleMarketPerformance>
): MarketPerformance[] {
  const merged = new Map<
    string,
    {
      market: string;
      marketGroup: string;
      bets: number;
      wins: number;
      losses: number;
      voids: number;
      avgOddsWeighted: number;
      avgConfidenceWeighted: number;
      avgEdgeWeighted: number;
      avgEdgeLowerBoundWeighted: number;
      avgRobustnessWeighted: number;
      totalStake: number;
      profitLoss: number;
    }
  >();

  const upsert = (
    market: string,
    marketGroup: string,
    bets: number,
    wins: number,
    losses: number,
    voids: number,
    avgOdds: number,
    avgConfidence: number,
    avgEdge: number,
    avgEdgeLowerBound: number,
    avgRobustness: number,
    totalStake: number,
    profitLoss: number
  ) => {
    const current = merged.get(market) || {
      market,
      marketGroup,
      bets: 0,
      wins: 0,
      losses: 0,
      voids: 0,
      avgOddsWeighted: 0,
      avgConfidenceWeighted: 0,
      avgEdgeWeighted: 0,
      avgEdgeLowerBoundWeighted: 0,
      avgRobustnessWeighted: 0,
      totalStake: 0,
      profitLoss: 0,
    };

    current.bets += bets;
    current.wins += wins;
    current.losses += losses;
    current.voids += voids;
    current.avgOddsWeighted += avgOdds * bets;
    current.avgConfidenceWeighted += avgConfidence * bets;
    current.avgEdgeWeighted += avgEdge * bets;
    current.avgEdgeLowerBoundWeighted += avgEdgeLowerBound * bets;
    current.avgRobustnessWeighted += avgRobustness * bets;
    current.totalStake += totalStake;
    current.profitLoss += profitLoss;

    merged.set(market, current);
  };

  singles.forEach((row) => {
    upsert(
      row.market,
      row.marketGroup,
      row.bets,
      row.wins,
      row.losses,
      row.voids,
      row.avgOdds,
      row.avgConfidence,
      row.avgEdge,
      row.avgEdgeLowerBound,
      row.avgRobustness,
      row.totalStake,
      row.profitLoss
    );
  });

  multiples.forEach((row) => {
    upsert(
      row.market,
      row.marketGroup,
      row.bets,
      row.greens,
      row.reds,
      row.voids,
      row.avgOdds,
      row.avgConfidence,
      row.avgEdge,
      0,
      0,
      row.totalStake,
      row.profitLoss
    );
  });

  return Array.from(merged.values())
    .map((row) => ({
      market: row.market,
      marketGroup: row.marketGroup,
      bets: row.bets,
      wins: row.wins,
      losses: row.losses,
      voids: row.voids,
      hitRate:
        row.wins + row.losses > 0
          ? Number(((row.wins / (row.wins + row.losses)) * 100).toFixed(1))
          : 0,
      avgOdds:
        row.bets > 0 ? Number((row.avgOddsWeighted / row.bets).toFixed(2)) : 0,
      avgConfidence:
        row.bets > 0
          ? Number((row.avgConfidenceWeighted / row.bets).toFixed(2))
          : 0,
      avgEdge:
        row.bets > 0 ? Number((row.avgEdgeWeighted / row.bets).toFixed(2)) : 0,
      avgEdgeLowerBound:
        row.bets > 0
          ? Number((row.avgEdgeLowerBoundWeighted / row.bets).toFixed(2))
          : 0,
      avgRobustness:
        row.bets > 0
          ? Number((row.avgRobustnessWeighted / row.bets).toFixed(2))
          : 0,
      totalStake: Number(row.totalStake.toFixed(2)),
      profitLoss: Number(row.profitLoss.toFixed(2)),
      roi:
        row.totalStake > 0
          ? Number(((row.profitLoss / row.totalStake) * 100).toFixed(1))
          : 0,
    }))
    .sort((a, b) => b.hitRate - a.hitRate);
}

function isSameDay(dateA: Date, dateB: Date) {
  return (
    dateA.getDate() === dateB.getDate() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getFullYear() === dateB.getFullYear()
  );
}

function CustomTooltip({
  active,
  payload,
  label,
  valueLabel = "Value",
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string; name?: string }>;
  label?: string;
  valueLabel?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0]?.value;

  return (
    <div className="scorelab-chart-tooltip rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl">
      <p className="mb-1 text-xs uppercase tracking-wider text-white/50">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <p className="text-sm text-white/70">{valueLabel}</p>
      </div>
      <p className="mt-1 text-lg font-semibold text-white">
        {typeof value === "number" ? value.toFixed(1) : value}
      </p>
    </div>
  );
}

type BucketChartOption = {
  key: string;
  label: string;
  data: ChartRow[];
  xKey: string;
};

function MultiBucketChart({ options }: { options: BucketChartOption[] }) {
  const firstWithData = options.find((option) => option.data.length > 0);
  const [activeKey, setActiveKey] = useState(
    (firstWithData ?? options[0])?.key
  );
  const active = options.find((option) => option.key === activeKey) ?? options[0];
  const safeData: ChartRow[] = Array.isArray(active?.data) ? active.data : [];

  return (
    <SectionCard
      title="ROI por Segmento"
      description="Confirma se o edge, a confiança e o risco se estão mesmo a traduzir em lucro."
      badge="ROI"
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setActiveKey(option.key)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              option.key === activeKey
                ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
                : "border-white/8 bg-white/[0.03] text-white/50 hover:text-white/75"
            }`}
          >
            {option.label}
            {option.data.length === 0 ? (
              <span className="ml-1.5 text-white/30">·</span>
            ) : null}
          </button>
        ))}
      </div>

      {safeData.length > 0 ? (
        <div className="scorelab-chart-cinematic relative h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={safeData}
              margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
              barCategoryGap="28%"
            >
              <CartesianGrid
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey={active.xKey}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                tickMargin={10}
                tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }}
              />

              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                content={<CustomTooltip valueLabel="ROI" />}
              />

              <Area
                type="monotone"
                dataKey="roi"
                stroke="none"
                fill="rgba(125,245,238,0.045)"
                isAnimationActive
                animationDuration={850}
              />

              <Bar
                dataKey="roi"
                radius={[12, 12, 12, 12]}
                maxBarSize={72}
                isAnimationActive
                animationDuration={780}
              >
                {safeData.map((entry, index) => {
                  const value = Number(entry.roi ?? 0);
                  return (
                    <Cell
                      key={index}
                      fill={
                        value >= 0
                          ? "rgba(34,197,94,0.95)"
                          : "rgba(239,68,68,0.95)"
                      }
                    />
                  );
                })}
              </Bar>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-white/40">
            <Inbox className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <p className="text-sm text-white/50">
            Ainda sem amostra suficiente para este segmento.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

const DASHBOARD_SECTIONS: SectionDef[] = [
  { id: "quick", label: "Indicadores rápidos" },
  { id: "summary", label: "Resumo executivo" },
  { id: "signals", label: "Sinais automáticos" },
  { id: "predictions", label: "Quadro de prognósticos" },
  { id: "charts", label: "Gráficos de desempenho" },
  { id: "validation", label: "Núcleo de validação" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { analyses, multiples, financialSnapshot, dataVersion } = useScoreLabData();
  const bankrollStats = financialSnapshot.stats;

  const dashboardData = useMemo(() => {
    const now = new Date();

    const validAnalyses = analyses.filter(
      (analysis) =>
        analysis &&
        Array.isArray(analysis.results) &&
        analysis.results.length > 0
    );

    const analysesToday = validAnalyses.filter((analysis) =>
      isSameDay(new Date(analysis.createdAt), now)
    ).length;

    const allResults = validAnalyses.flatMap((analysis) => analysis.results);

    const valueBetsFound = allResults.filter(
      (result) => result.valueBet > 0
    ).length;

    const avgConfidence =
      allResults.length > 0
        ? allResults.reduce((acc, result) => acc + result.confidence, 0) /
          allResults.length
        : 0;

    const avgXg =
      validAnalyses.length > 0
        ? validAnalyses.reduce(
            (acc, analysis) => acc + analysis.summary.totalXg,
            0
          ) / validAnalyses.length
        : 0;

    const todaysAnalyses = validAnalyses.filter((analysis) =>
      isSameDay(new Date(analysis.createdAt), now)
    );

    const allTodayBestBets = todaysAnalyses
      .map((analysis) => {
        const bestBet = getBestBet(analysis.results);
        if (!bestBet) return null;

        return {
          analysis,
          bestBet,
        };
      })
      .filter(Boolean) as { analysis: SavedAnalysis; bestBet: AnalysisResult }[];

    const topValueTodayEntry =
      allTodayBestBets.length > 0
        ? allTodayBestBets.reduce((a, b) =>
            a.bestBet.valueBet > b.bestBet.valueBet ? a : b
          )
        : null;

    const openExposure = financialSnapshot.openExposure;
    const openExposurePct =
      bankrollStats.currentBankroll > 0
        ? (openExposure / bankrollStats.currentBankroll) * 100
        : 0;

    const riskLevel =
      openExposurePct <= 3
        ? "Low"
        : openExposurePct <= 8
        ? "Moderate"
        : "High";

    const performance = getAdvancedPerformanceBreakdown(validAnalyses, multiples);
    const autoInsights = getDashboardAutoInsights();
    

    return {
      analysesToday,
      valueBetsFound,
      avgConfidence,
      avgXg,
      topValueTodayEntry,
      openExposure,
      openExposurePct,
      riskLevel,
      performance,
      autoInsights,
    };
  }, [analyses, multiples, bankrollStats.currentBankroll, financialSnapshot]);

  const topValueToday = dashboardData.topValueTodayEntry;
  const calibrationModel = useMemo(() => buildCalibrationModel(analyses), [analyses]);

  const openAnalysisInSimpleBet = (analysis: SavedAnalysis, result: AnalysisResult) => {
    const calibration = calibrateOpportunity(
      {
        league: analysis.league || "Unspecified",
        market: result.market,
        odds: result.odds,
        confidence: result.confidence,
        modelProb: result.modelProb,
      },
      calibrationModel
    );
    const params = new URLSearchParams({
      analysisId: analysis.id,
      prepareBet: "1",
      market: result.market,
      stake: String(Number((result.stake * calibration.stakeMultiplier).toFixed(2))),
      odd: String(Number(result.odds.toFixed(2))),
    });

    navigate(`/history?${params.toString()}`);
  };

  const oddsBucketChartData: ChartRow[] =
    dashboardData.performance?.oddsBucketPerformance?.map((item) => ({
      ...item,
    })) ?? [];

  const edgeBucketChartData: ChartRow[] =
    dashboardData.performance?.edgeBucketPerformance?.map((item) => ({
      ...item,
    })) ?? [];

  const confidenceBucketChartData: ChartRow[] =
    dashboardData.performance?.confidenceBucketPerformance?.map((item) => ({
      ...item,
    })) ?? [];

  const edgeLowerBoundChartData: ChartRow[] =
    dashboardData.performance?.edgeLowerBoundBucketPerformance?.map((item) => ({
      ...item,
    })) ?? [];

  const robustnessChartData: ChartRow[] =
    dashboardData.performance?.robustnessBucketPerformance?.map((item) => ({
      ...item,
    })) ?? [];

  const multipleMarketPerformance = useMemo(
    () => {
      void dataVersion;
      return getMultipleMarketPerformance({ excludeDuplicateSingles: true });
    },
    [dataVersion]
  );

  const marketPerformanceRows = useMemo(
    () =>
      mergeMarketPerformanceRows(
        dashboardData.performance?.marketPerformance ?? [],
        multipleMarketPerformance
      ),
    [dashboardData.performance?.marketPerformance, multipleMarketPerformance]
  );

  const leadingMarket = marketPerformanceRows[0] ?? null;

  const leaguePerformanceRows = useMemo<LeaguePerformanceRow[]>(
    () => buildLeagueIntelligenceRows(analyses),
    [analyses]
  );

  const leadingLeague =
    leaguePerformanceRows.find((row) => row.intelligenceStatus !== "Needs Data") ??
    leaguePerformanceRows[0] ??
    null;

  const riskChartData: ChartRow[] =
    dashboardData.performance?.riskPerformance?.map((item) => ({
      ...item,
    })) ?? [];

  const dashboardPulseTone =
    dashboardData.riskLevel === "High"
      ? "red"
      : dashboardData.riskLevel === "Moderate"
      ? "amber"
      : bankrollStats.roi >= 0
      ? "emerald"
      : "cyan";

  const layout = useSectionLayout("dashboard", DASHBOARD_SECTIONS);
  const [validationOpen, setValidationOpen] = useState(false);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="scorelab-dashboard-flow flex flex-col gap-7 p-4 sm:p-5 md:p-6"
      >
        <div className="-mb-4 flex justify-end">
          <LayoutCustomizeButton layout={layout} />
        </div>
        <motion.section
          variants={fadeUp}
          className="scorelab-board-3d relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(8,23,42,0.96)_0%,rgba(4,12,24,0.98)_58%,rgba(3,25,27,0.94)_100%)] p-4 shadow-[0_18px_70px_-46px_rgba(34,211,238,0.55)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(125,245,238,0.055)_0_1px,transparent_1px_96px),linear-gradient(180deg,rgba(255,255,255,0.025)_0_1px,transparent_1px_72px)] opacity-30" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/35 to-transparent" />

          <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <div className="min-w-0">
              <div className="hidden flex-wrap items-center gap-2 sm:flex">
                <HudStatusPill
                  label="Decision OS"
                  tone="cyan"
                  pulse={false}
                  icon={<HudStateIcon state="online" />}
                />
                <HudStatusPill
                  label={`${dashboardData.riskLevel} Exposure`}
                  tone={dashboardData.riskLevel === "High" ? "red" : "cyan"}
                  icon={<HudStateIcon state={dashboardData.riskLevel === "High" ? "risk" : "online"} />}
                />
                <HudStatusPill
                  label={`${bankrollStats.totalPending} Pending`}
                  tone={bankrollStats.totalPending > 0 ? "amber" : "emerald"}
                  icon={<HudStateIcon state={bankrollStats.totalPending > 0 ? "scanning" : "online"} />}
                />
              </div>

              <div className="mt-5 max-w-4xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/48">
                  ScoreLab Dashboard
                </p>
                <h1 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight tracking-normal text-white sm:text-[1.9rem] lg:text-[2.35rem]">
                  Keep the model, bankroll and value signals in one place.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
                  A simple overview of performance, risk and the next analysis to check.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-3">
                <DecisionAction
                  label="Analyze Match"
                  detail="Run a fresh market read through the model."
                  icon={Crosshair}
                  onClick={() => navigate("/analysis")}
                />
                <DecisionAction
                  label="Value Radar"
                  detail="Scan saved opportunities by edge and confidence."
                  icon={Zap}
                  onClick={() => navigate("/radar")}
                  tone="emerald"
                />
                <DecisionAction
                  label="Model Lab"
                  detail="Inspect trust, drift and similar-match memory."
                  icon={BrainCircuit}
                  onClick={() => navigate("/model-lab")}
                  tone="amber"
                />
              </div>
            </div>

            <div className="grid gap-2.5">
              <SystemPulse3D
                label="System Pulse"
                value={`${bankrollStats.roi.toFixed(1)}% ROI`}
                detail={`${dashboardData.riskLevel} risk with EUR ${dashboardData.openExposure.toFixed(2)} open.`}
                tone={dashboardPulseTone}
                size="compact"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                  <Gauge className="h-4 w-4 text-cyan-200" strokeWidth={1.6} />
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                    Markets
                  </p>
                  <p className="mt-1 font-mono-data text-xl font-semibold text-white">
                    {marketPerformanceRows.length}
                  </p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                  <ShieldCheck className="h-4 w-4 text-emerald-200" strokeWidth={1.6} />
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.18em] text-white/38">
                    Confidence
                  </p>
                  <p className="mt-1 font-mono-data text-xl font-semibold text-white">
                    {dashboardData.avgConfidence.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Outside the customizer on purpose: keeping the history truthful is
            not a panel the user should be able to hide. */}
        <motion.div variants={fadeUp}>
          <MatchResultsPanel analyses={analyses} />
        </motion.div>

        <LayoutSection id="quick" layout={layout}>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-3 rounded-[28px] border border-white/8 bg-[linear-gradient(90deg,rgba(255,255,255,0.035),rgba(125,245,238,0.045),rgba(255,255,255,0.025))] p-3 sm:grid-cols-2"
        >
          {[
            {
              label: "Market Lead",
              value: leadingMarket?.market ?? "Needs data",
              detail: leadingMarket
                ? `${leadingMarket.roi}% ROI across ${leadingMarket.bets} bets`
                : "Track more settled bets",
              icon: Activity,
            },
            {
              label: "League Lead",
              value: leadingLeague?.league ?? "Needs data",
              detail: leadingLeague
                ? `${leadingLeague.roi}% ROI · ${leadingLeague.bestMarket}`
                : "No reliable league signal yet",
              icon: Sparkles,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="min-w-0 rounded-2xl border border-white/8 bg-black/15 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <item.icon className="h-3.5 w-3.5 flex-none text-cyan-100/70" strokeWidth={1.6} />
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-white/42">
                  {item.label}
                </p>
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-white">{item.value}</p>
              <p className="mt-1 truncate text-xs text-white/48">{item.detail}</p>
            </div>
          ))}
        </motion.div>

        </LayoutSection>

        <LayoutSection id="summary" layout={layout}>
        <div className="scorelab-section-kicker">
          <span>Executive Summary</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CompactStatCard
            label="Settled Bets"
            value={
              bankrollStats.totalGreens +
              bankrollStats.totalReds +
              bankrollStats.totalVoids
            }
            change={`${bankrollStats.hitRate.toFixed(1)}% hit rate`}
            icon={CheckCircle2}
          />
          <CompactStatCard
            label="ROI"
            value={`${bankrollStats.roi.toFixed(2)}%`}
            change={`P/L €${bankrollStats.totalProfitLoss.toFixed(2)}`}
            changeType={bankrollStats.roi >= 0 ? "positive" : "negative"}
            icon={TrendingUp}
          />
          <CompactStatCard
            label="Win Rate"
            value={`${bankrollStats.hitRate.toFixed(2)}%`}
            change={`${bankrollStats.totalGreens} green · ${bankrollStats.totalReds} red`}
            changeType={bankrollStats.hitRate >= 50 ? "positive" : "negative"}
            icon={Target}
          />
          <CompactStatCard
            label="Avg Confidence"
            value={dashboardData.avgConfidence.toFixed(1)}
            change={`${dashboardData.valueBetsFound} value bets found`}
            icon={Gauge}
          />
        </div>

        </LayoutSection>

        <LayoutSection id="signals" layout={layout}>
        {(dashboardData.autoInsights ?? []).length > 0 && (
          <>
          <div className="scorelab-section-kicker">
            <span>AI Signals</span>
          </div>
          <motion.div
            variants={fadeUp}
            className="grid grid-cols-1 gap-4 xl:grid-cols-2"
          >
            {dashboardData.autoInsights.map((insight) => (
              <AutoInsightCard
                key={insight.title}
                title={insight.title}
                detail={insight.detail}
                tone={insight.tone}
              />
            ))}
          </motion.div>
          </>
        )}

        </LayoutSection>

        <LayoutSection id="predictions" layout={layout}>
        <div className="scorelab-section-kicker">
          <span>Prediction Board</span>
        </div>

          {topValueToday ? (
            <motion.div
              variants={fadeUp}
              className="scorelab-board-3d scorelab-top-value-card relative overflow-hidden rounded-[30px] border border-white/8 p-5"
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_0%,var(--scorelab-accent-a-soft),transparent_32%),radial-gradient(circle_at_12%_100%,var(--scorelab-accent-b-soft),transparent_28%)]" />
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--scorelab-control-border-hover),transparent)]" />
              <div className="relative space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--scorelab-control-border)] bg-[var(--scorelab-control-bg)] px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_var(--scorelab-accent-b-soft)]" />
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/58">
                        Top Value Today
                      </p>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-white md:text-[1.55rem]">
                      {topValueToday.analysis.homeTeam} vs {topValueToday.analysis.awayTeam}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Strongest calibrated live angle on today's board.
                    </p>
                  </div>
                  <span className="scorelab-chrome-control rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
                    {topValueToday.bestBet.market}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <ValueBadge value={topValueToday.bestBet.valueBet} />
                  <DecisionBadge decision={topValueToday.bestBet.decision} />
                  {topValueToday.bestBet.tier && (
                    <TierBadge tier={topValueToday.bestBet.tier} />
                  )}
                </div>

                <div className="scorelab-chrome-control rounded-2xl border p-3.5">
                  <ConfidenceMeter score={topValueToday.bestBet.confidence} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="scorelab-chrome-control rounded-2xl border p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Odds
                    </p>
                    <p className="mt-2 font-mono-data text-[1.15rem] font-semibold text-white">
                      {topValueToday.bestBet.odds}
                    </p>
                  </div>
                  <div className="scorelab-chrome-control rounded-2xl border p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Kelly
                    </p>
                    <p className="mt-2 font-mono-data text-[1.15rem] font-semibold text-white">
                      {topValueToday.bestBet.kelly.toFixed(2)}%
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    openAnalysisInSimpleBet(topValueToday.analysis, topValueToday.bestBet)
                  }
                  className="scorelab-brand-mark inline-flex h-11 w-full items-center justify-center rounded-xl border border-[var(--scorelab-control-border-hover)] px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:brightness-110"
                >
                  Open In Simple Bet
                </button>
              </div>
            </motion.div>
          ) : (
            <SectionCard
              title="Top Value Today"
              description="No standout value pick has been tracked today yet."
              badge="Live Board"
            >
              <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/8 bg-white/[0.04] text-cyan-200/70">
                  <Crosshair className="h-4 w-4" strokeWidth={1.6} />
                </span>
                <p className="text-sm text-white/55">
                  Run today's analyses and the strongest live angle will appear here.
                </p>
              </div>
            </SectionCard>
          )}
        <SectionCard
          title="Daily Profit Trend"
          description="Real betting performance by settled day."
          badge="P/L"
          className="relative"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />

          <div className="relative h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={dashboardData.performance?.dailyProfitTrend ?? []}
                margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                  strokeDasharray="3 3"
                />

                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }}
                />

                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
                  content={<CustomTooltip valueLabel="Profit/Loss" />}
                />

                <Area
                  type="monotone"
                  dataKey="profitLoss"
                  stroke="rgba(16,185,129,0.9)"
                  fill="rgba(16,185,129,0.12)"
                  strokeWidth={0}
                />

                <Line
                  type="monotone"
                  dataKey="profitLoss"
                  stroke="rgba(16,185,129,0.95)"
                  strokeWidth={3}
                  dot={{ r: 0 }}
                  activeDot={{
                    r: 5,
                    fill: "rgba(16,185,129,1)",
                    stroke: "rgba(255,255,255,0.8)",
                    strokeWidth: 2,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        </LayoutSection>

        <LayoutSection id="charts" layout={layout}>
        <div className="scorelab-section-kicker">
          <span>Performance Charts</span>
        </div>

        <MultiBucketChart
          options={[
            { key: "odds", label: "Odds", data: oddsBucketChartData, xKey: "bucket" },
            { key: "edge", label: "Edge", data: edgeBucketChartData, xKey: "bucket" },
            { key: "confidence", label: "Confiança", data: confidenceBucketChartData, xKey: "bucket" },
            { key: "risk", label: "Risco", data: riskChartData, xKey: "risk" },
            { key: "edgeLowerBound", label: "Edge (limite)", data: edgeLowerBoundChartData, xKey: "bucket" },
            { key: "robustness", label: "Robustez", data: robustnessChartData, xKey: "bucket" },
          ]}
        />

        </LayoutSection>

        <LayoutSection id="validation" layout={layout}>
        <button
          type="button"
          onClick={() => setValidationOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5 text-left"
        >
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Validation Core</p>
            <p className="mt-0.5 text-xs text-white/50">
              Leitura detalhada por mercado, liga e tier — abre quando precisares de auditar.
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 flex-none text-white/40 transition-transform ${validationOpen ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence initial={false}>
        {validationOpen && (
          <motion.div
            variants={collapse}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden"
          >
          <div className="flex flex-col gap-7 pt-4">
        <SectionCard
          title="Validation Core"
          description="This is the central read on what the model is validating by market and by league."
          badge="Core"
          className="relative overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.045),transparent_30%)]" />
          <div className="relative z-10 space-y-6">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div className="scorelab-board-3d rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Market Lead
                </p>
                <p className="mt-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
                  {leadingMarket?.market ?? "No clear lead yet"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {leadingMarket
                    ? `${leadingMarket.roi}% ROI across ${leadingMarket.bets} bets`
                    : "Need more settled market data"}
                </p>
              </div>
              <div className="scorelab-board-3d rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  League Lead
                </p>
                <p className="mt-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
                  {leadingLeague?.league ?? "No clear lead yet"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  {leadingLeague
                    ? `${leadingLeague.roi}% ROI · ${leadingLeague.bestMarket}`
                    : "Need more settled league data"}
                </p>
              </div>
              <div className="scorelab-board-3d rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Validation Focus
                </p>
                <p className="mt-2 text-[1.05rem] font-semibold tracking-[-0.02em] text-white">
                  Markets + Leagues
                </p>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Read these two tables together before changing trust levels or exposure.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="scorelab-board-3d rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.94)_0%,rgba(4,11,28,0.97)_100%)] p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white md:text-[15px]">
                      Performance by Market
                    </h3>
                    <p className="mt-1 text-xs leading-6 text-white/56 md:text-[13px]">
                      The main table for deciding which market types deserve trust.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/50">
                    Markets
                  </span>
                </div>
                <div className="mb-5">
                  <MiniHeatmap
                    title="Market Heatmap"
                    items={marketPerformanceRows.map((row) => ({
                      label: row.market,
                      value: row.roi,
                      detail: `${row.bets} bets · ${row.hitRate}% hit`,
                    }))}
                  />
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.025]">
                  <table className="w-full min-w-[1100px] text-sm">
                    <thead className="border-b border-white/5">
                      <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                        <th className="py-3 pr-4">Market</th>
                        <th className="py-3 pr-4">Group</th>
                        <th className="py-3 pr-4">Bets</th>
                        <th className="py-3 pr-4">Wins</th>
                        <th className="py-3 pr-4">Losses</th>
                        <th className="py-3 pr-4">Hit Rate</th>
                        <th className="py-3 pr-4">Avg Odds</th>
                        <th className="py-3 pr-4">Avg Conf.</th>
                        <th className="py-3 pr-4">Avg Edge</th>
                        <th className="py-3 pr-4">Avg Edge LB</th>
                        <th className="py-3 pr-4">Avg Robust.</th>
                        <th className="py-3 pr-4">Stake</th>
                        <th className="py-3 pr-4">P/L</th>
                        <th className="py-3 pr-4">ROI</th>
                      </tr>
                    </thead>

                    <tbody>
                      {marketPerformanceRows.length > 0 ? (
                        marketPerformanceRows.map((row) => (
                          <tr key={row.market} className="border-t border-white/5">
                            <td className="py-3 pr-4 font-medium text-foreground">
                              {row.market}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {row.marketGroup}
                            </td>
                            <td className="py-3 pr-4 font-mono-data">{row.bets}</td>
                            <td className="py-3 pr-4 font-mono-data">{row.wins}</td>
                            <td className="py-3 pr-4 font-mono-data">{row.losses}</td>
                            <td className="py-3 pr-4 font-mono-data">{row.hitRate}%</td>
                            <td className="py-3 pr-4 font-mono-data">{row.avgOdds}</td>
                            <td className="py-3 pr-4 font-mono-data">{row.avgConfidence}</td>
                            <td className="py-3 pr-4 font-mono-data">{row.avgEdge}%</td>
                            <td className="py-3 pr-4 font-mono-data">{row.avgEdgeLowerBound}%</td>
                            <td className="py-3 pr-4 font-mono-data">{row.avgRobustness}</td>
                            <td className="py-3 pr-4 font-mono-data">
                              €{row.totalStake.toFixed(2)}
                            </td>
                            <td className="py-3 pr-4 font-mono-data">
                              €{row.profitLoss.toFixed(2)}
                            </td>
                            <td className="py-3 pr-4 font-mono-data">{row.roi}%</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={14}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No settled tracked bets yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="scorelab-board-3d rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.94)_0%,rgba(4,11,28,0.97)_100%)] p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white md:text-[15px]">
                      League Performance
                    </h3>
                    <p className="mt-1 text-xs leading-6 text-white/56 md:text-[13px]">
                      See which competitions are earning trust and which market is carrying each one.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/50">
                    Leagues
                  </span>
                </div>
                <div className="mb-5">
                  <MiniHeatmap
                    title="League Heatmap"
                    items={leaguePerformanceRows.map((row) => ({
                      label: row.league,
                      value: row.roi,
                      detail: `${row.bets} bets · ${row.bestMarket}`,
                    }))}
                  />
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/8 bg-white/[0.025]">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="border-b border-white/5">
                      <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                        <th className="py-3 pr-4">League</th>
                        <th className="py-3 pr-4">Bets</th>
                        <th className="py-3 pr-4">Hit Rate</th>
                        <th className="py-3 pr-4">Avg Conf.</th>
                        <th className="py-3 pr-4">Avg Edge</th>
                        <th className="py-3 pr-4">Best Market</th>
                        <th className="py-3 pr-4">Stake</th>
                        <th className="py-3 pr-4">P/L</th>
                        <th className="py-3 pr-4">ROI</th>
                      <th className="py-3 pr-4">Status</th>
                      <th className="py-3 pr-4">Intelligence</th>
                      </tr>
                    </thead>

                    <tbody>
                      {leaguePerformanceRows.length > 0 ? (
                        leaguePerformanceRows.map((row) => (
                          <tr key={row.league} className="border-t border-white/5">
                            <td className="py-3 pr-4 font-medium text-foreground">
                              {row.league}
                            </td>
                            <td className="py-3 pr-4 font-mono-data text-foreground">
                              {row.bets}
                            </td>
                            <td className="py-3 pr-4 font-mono-data text-foreground">
                              {row.hitRate}%
                            </td>
                            <td className="py-3 pr-4 font-mono-data text-foreground">
                              {row.avgConfidence}
                            </td>
                            <td className="py-3 pr-4 font-mono-data text-foreground">
                              {row.avgEdge}%
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground">
                              {row.bestMarket}
                            </td>
                            <td className="py-3 pr-4 font-mono-data text-foreground">
                              €{row.totalStake.toFixed(2)}
                            </td>
                            <td className="py-3 pr-4 font-mono-data text-foreground">
                              €{row.profitLoss.toFixed(2)}
                            </td>
                            <td className="py-3 pr-4 font-mono-data text-foreground">
                              {row.roi}%
                            </td>
                            <td className="py-3 pr-4">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getLeagueStatusTone(
                                  row.intelligenceStatus
                                )}`}
                              >
                                {row.intelligenceStatus}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-xs leading-5 text-muted-foreground">
                              {row.trustScore}/100 · {row.recommendation}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={11}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            No settled league data yet. Start tracking results so ScoreLab can validate competitions properly.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Performance by Tier"
          description="This shows whether Premium and Elite are really outperforming the weaker signals."
          badge="Tiers"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b border-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                  <th className="py-3 pr-4">Tier</th>
                  <th className="py-3 pr-4">Bets</th>
                  <th className="py-3 pr-4">Wins</th>
                  <th className="py-3 pr-4">Losses</th>
                  <th className="py-3 pr-4">Hit Rate</th>
                  <th className="py-3 pr-4">Stake</th>
                  <th className="py-3 pr-4">P/L</th>
                  <th className="py-3 pr-4">ROI</th>
                </tr>
              </thead>

              <tbody>
                {(dashboardData.performance?.tierPerformance ?? []).length > 0 ? (
                  (dashboardData.performance?.tierPerformance ?? []).map((row) => (
                    <tr key={row.tier} className="border-t border-white/5">
                      <td className="py-3 pr-4">
                        <TierBadge tier={row.tier} />
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {row.bets}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {row.wins}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {row.losses}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {row.hitRate}%
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        €{row.totalStake.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        €{row.profitLoss.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {row.roi}%
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No settled bets yet. Start tracking results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
          </div>
          </motion.div>
        )}
        </AnimatePresence>
        </LayoutSection>
      </motion.div>
    </AppLayout>
  );
}
