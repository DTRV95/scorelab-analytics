import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { SystemPulse3D } from "@/components/SystemPulse3D";
import { HudStateIcon, HudStatusPill } from "@/components/HudLayer";
import { PulseOnChange } from "@/components/MotionIntelligence";
import { MiniHeatmap } from "@/components/DataObjects";
import { MatchdayHero } from "@/components/MatchdayHero";
import { StadiumLightSweep } from "@/components/ArenaEffects";
import { motion } from "framer-motion";
import { AITypewriter } from "@/components/AITypewriter";
import { buildApiUrl } from "@/lib/apiConfig";
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
import { useEffect, useMemo, useState, type ReactNode } from "react";
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

const SHOW_AI_READS = false;

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type ChartRow = Record<string, string | number | null | undefined>;

interface DashboardAISummary {
  configured: boolean;
  summary: string;
  strengths: string[];
  risks: string[];
  next_actions: string[];
  disclaimer: string;
}

interface DashboardAISummaryPayload {
  current_bankroll: number;
  bankroll_growth_pct: number;
  open_exposure: number;
  risk_level: string;
  settled_bets: number;
  roi_pct: number;
  profit_loss: number;
  avg_confidence: number;
  analyses_today: number;
  value_bets_found: number;
  auto_insights: string[];
  top_markets: {
    market: string;
    bets: number;
    roi: number;
    hit_rate: number;
    profit_loss: number;
  }[];
  tier_performance: {
    tier: string;
    bets: number;
    roi: number;
    hit_rate: number;
  }[];
  top_value_today: {
    match: string;
    market: string;
    edge_pct: number;
    confidence: number;
    odds: number;
    decision: string;
  } | null;
}

type LeaguePerformanceRow = LeagueIntelligenceRow;

function buildLocalAiSummary(
  payload: DashboardAISummaryPayload
): DashboardAISummary {
  const strengths: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];

  const bestMarket = payload.top_markets[0];

  if (bestMarket) {
    strengths.push(
      `${bestMarket.market} is currently the strongest tracked market at ${bestMarket.roi.toFixed(1)}% ROI over ${bestMarket.bets} bets.`
    );
  }

  if (payload.top_value_today) {
    strengths.push(
      `Today's strongest live angle is ${payload.top_value_today.match} on ${payload.top_value_today.market} with ${payload.top_value_today.edge_pct.toFixed(1)}% edge.`
    );
  }

  if (payload.risk_level.toLowerCase() === "high") {
    risks.push(
      `Open exposure is high at EUR ${payload.open_exposure.toFixed(2)}, so new bets should stay selective.`
    );
  } else {
    risks.push(
      `Open exposure is EUR ${payload.open_exposure.toFixed(2)}, which keeps live risk in a manageable zone.`
    );
  }

  if (payload.settled_bets < 40) {
    risks.push(
      `The sample is still early at ${payload.settled_bets} settled bets, so patterns should guide you but not fully dictate changes.`
    );
  }

  nextActions.push(
    "Keep prioritising the markets that are already validating with real settled volume."
  );
  nextActions.push(
    "Avoid making aggressive model changes until the settled sample grows further."
  );

  return {
    configured: false,
    summary: `ScoreLab is currently running at ${payload.roi_pct.toFixed(1)}% ROI with EUR ${payload.profit_loss.toFixed(2)} total profit and EUR ${payload.current_bankroll.toFixed(2)} live bankroll.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    next_actions: nextActions.slice(0, 3),
    disclaimer:
      "This summary is interpretive guidance built on tracked results. It does not replace the statistical model.",
  };
}

function CompactStatCard({
  label,
  value,
  change,
  changeType = "neutral",
}: {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}) {
  return (
    <PulseOnChange value={`${value}-${change ?? ""}`}>
      <StadiumLightSweep trigger={`${value}-${change ?? ""}`}>
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 360, damping: 26 }}
        className="scorelab-board-3d scorelab-tilt-3d relative overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,22,38,0.96)_0%,rgba(5,14,28,0.98)_100%)] px-4 py-3.5"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_20%)] opacity-80" />
        <div className="relative">
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-white/38">
            {label}
          </p>
          <div className="mt-2 h-1 w-8 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.88),rgba(34,197,94,0.82))]" />
          <p className="mt-3 font-mono-data text-[1.28rem] font-semibold tracking-[-0.03em] text-white md:text-[1.46rem]">
            {value}
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
      className={`scorelab-board-3d overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-white md:text-[15px]">{title}</h2>
          <p className="mt-1 text-xs leading-6 text-white/58 md:text-[13px]">{description}</p>
        </div>
        {badge ? (
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/50">
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
      hitRate: row.bets > 0 ? Number(((row.wins / row.bets) * 100).toFixed(1)) : 0,
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
    <div className="rounded-2xl border border-white/10 bg-[hsl(222,47%,7%)] px-4 py-3 shadow-2xl backdrop-blur-md">
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

function ChartCard({
  title,
  description,
  data,
  xKey,
  barKey = "roi",
  cardClassName = "",
  chartHeightClassName = "h-[240px]",
}: {
  title: string;
  description: string;
  data: ChartRow[];
  xKey: string;
  barKey?: string;
  cardClassName?: string;
  chartHeightClassName?: string;
}) {
  const safeData: ChartRow[] = Array.isArray(data) ? data : [];

  return (
    <SectionCard title={title} description={description} badge="ROI" className={cardClassName}>
      <div className={`scorelab-chart-cinematic relative ${chartHeightClassName}`}>
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
              dataKey={xKey}
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
              dataKey={barKey}
              stroke="none"
              fill="rgba(125,245,238,0.045)"
              isAnimationActive
              animationDuration={850}
            />

            <Bar
              dataKey={barKey}
              radius={[12, 12, 12, 12]}
              maxBarSize={72}
              isAnimationActive
              animationDuration={780}
            >
              {safeData.map((entry, index) => {
                const value = Number(entry[barKey] ?? 0);
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
    </SectionCard>
  );
}

function AIReviewColumn({
  title,
  tone,
  items,
  startDelay = 0,
}: {
  title: string;
  tone: "emerald" | "red" | "cyan";
  items: string[];
  startDelay?: number;
}) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-400/15 bg-emerald-400/[0.04] text-emerald-200"
      : tone === "red"
      ? "border-red-400/15 bg-red-400/[0.04] text-red-200"
      : "border-cyan-400/15 bg-cyan-400/[0.04] text-cyan-200";

  return (
    <div className={`rounded-xl border p-3.5 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
        {title}
      </p>
      <div className="mt-3 space-y-2.5">
        {items.map((item, index) => (
          <div key={`${title}-${index}`} className="flex items-start gap-2.5">
            <span className="mt-[3px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full border border-current/20 text-[9px] font-semibold opacity-75">
              {index + 1}
            </span>
            <p className="text-[13px] leading-6 text-white/78">
              <AITypewriter text={item} startDelay={startDelay + index * 220} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { analyses, financialSnapshot, dataVersion } = useScoreLabData();
  const bankrollStats = financialSnapshot.stats;
  const [aiSummary, setAiSummary] = useState<DashboardAISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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

    const performance = getAdvancedPerformanceBreakdown(validAnalyses);
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
  }, [analyses, bankrollStats.currentBankroll, financialSnapshot]);

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

  const dashboardAiPayload = useMemo<DashboardAISummaryPayload>(
    () => ({
      current_bankroll: bankrollStats.currentBankroll,
      bankroll_growth_pct: bankrollStats.bankrollGrowthPct,
      open_exposure: dashboardData.openExposure,
      risk_level: dashboardData.riskLevel,
      settled_bets:
        bankrollStats.totalGreens + bankrollStats.totalReds + bankrollStats.totalVoids,
      roi_pct: bankrollStats.roi,
      profit_loss: bankrollStats.totalProfitLoss,
      avg_confidence: Number(dashboardData.avgConfidence.toFixed(2)),
      analyses_today: dashboardData.analysesToday,
      value_bets_found: dashboardData.valueBetsFound,
      auto_insights: (dashboardData.autoInsights ?? []).map((item) => item.detail),
      top_markets: marketPerformanceRows.slice(0, 4).map((row) => ({
        market: row.market,
        bets: row.bets,
        roi: row.roi,
        hit_rate: row.hitRate,
        profit_loss: row.profitLoss,
      })),
      tier_performance: (dashboardData.performance?.tierPerformance ?? [])
        .slice(0, 4)
        .map((row) => ({
          tier: row.tier,
          bets: row.bets,
          roi: row.roi,
          hit_rate: row.hitRate,
        })),
      top_value_today: topValueToday
        ? {
            match: `${topValueToday.analysis.homeTeam} vs ${topValueToday.analysis.awayTeam}`,
            market: topValueToday.bestBet.market,
            edge_pct: topValueToday.bestBet.valueBet,
            confidence: topValueToday.bestBet.confidence,
            odds: topValueToday.bestBet.odds,
            decision: topValueToday.bestBet.decision,
          }
        : null,
    }),
    [
      bankrollStats.bankrollGrowthPct,
      bankrollStats.currentBankroll,
      bankrollStats.roi,
      bankrollStats.totalGreens,
      bankrollStats.totalProfitLoss,
      bankrollStats.totalReds,
      bankrollStats.totalVoids,
      dashboardData.analysesToday,
      dashboardData.autoInsights,
      dashboardData.avgConfidence,
      dashboardData.openExposure,
      dashboardData.performance?.tierPerformance,
      dashboardData.riskLevel,
      dashboardData.valueBetsFound,
      marketPerformanceRows,
      topValueToday,
    ]
  );

  const dashboardAiPayloadKey = useMemo(
    () => JSON.stringify(dashboardAiPayload),
    [dashboardAiPayload]
  );

  useEffect(() => {
    if (!SHOW_AI_READS) {
      setAiLoading(false);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 8000);

    const run = async () => {
      setAiLoading(true);
      try {
        const response = await fetch(buildApiUrl("/ai/dashboard-summary"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: dashboardAiPayloadKey,
        });

        if (!response.ok) {
          throw new Error(`Failed to load AI summary (${response.status})`);
        }

        const data = (await response.json()) as DashboardAISummary;
        if (!isCancelled) {
          setAiSummary(data);
        }
      } catch {
        if (!isCancelled) {
          const parsedPayload = JSON.parse(
            dashboardAiPayloadKey
          ) as DashboardAISummaryPayload;
          setAiSummary(buildLocalAiSummary(parsedPayload));
        }
      } finally {
        if (!isCancelled) {
          setAiLoading(false);
        }
        window.clearTimeout(timeoutId);
      }
    };

    run();

    return () => {
      isCancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [dashboardAiPayloadKey]);

  const dashboardPulseTone =
    dashboardData.riskLevel === "High"
      ? "red"
      : dashboardData.riskLevel === "Moderate"
      ? "amber"
      : bankrollStats.roi >= 0
      ? "emerald"
      : "cyan";

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <MatchdayHero
          eyebrow="Dashboard Workspace"
          tone={dashboardData.riskLevel === "High" ? "amber" : "cyan"}
          statusIcon={<HudStateIcon state="online" />}
          title="Performance Intelligence"
          description="Use historical betting performance to find where ScoreLab is really validating and where discipline matters most."
          statusItems={
            <>
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
              <HudStatusPill
                label={`${marketPerformanceRows.length} Markets`}
                tone="cyan"
                pulse={false}
                icon={<HudStateIcon state="scanning" />}
              />
            </>
          }
          visual={
            <SystemPulse3D
              label="System Pulse"
              value={`${bankrollStats.roi.toFixed(1)}% ROI`}
              detail={`Live risk is ${dashboardData.riskLevel.toLowerCase()} with EUR ${dashboardData.openExposure.toFixed(2)} open.`}
              tone={dashboardPulseTone}
            />
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <CompactStatCard
            label="Settled Bets"
            value={
              bankrollStats.totalGreens +
              bankrollStats.totalReds +
              bankrollStats.totalVoids
            }
            change={`${bankrollStats.hitRate.toFixed(1)}% hit rate`}
          />
          <CompactStatCard
            label="ROI"
            value={`${bankrollStats.roi.toFixed(2)}%`}
            change={`P/L €${bankrollStats.totalProfitLoss.toFixed(2)}`}
            changeType={bankrollStats.roi >= 0 ? "positive" : "negative"}
          />
          <CompactStatCard
            label="Avg Confidence"
            value={dashboardData.avgConfidence.toFixed(1)}
            change={`${dashboardData.valueBetsFound} value bets found`}
          />
          <CompactStatCard
            label="Bankroll"
            value={`€${bankrollStats.currentBankroll.toFixed(2)}`}
            change={`Open exposure €${dashboardData.openExposure.toFixed(2)} · ${dashboardData.riskLevel}`}
          />
          <CompactStatCard
            label="Bankroll Growth"
            value={`${bankrollStats.bankrollGrowthPct.toFixed(2)}%`}
            change={`Started at €${bankrollStats.initialBankroll.toFixed(2)}`}
            changeType={bankrollStats.bankrollGrowthPct >= 0 ? "positive" : "negative"}
          />
        </div>

        {(dashboardData.autoInsights ?? []).length > 0 && (
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
        )}

        {SHOW_AI_READS ? (
        <SectionCard
          title="AI Dashboard Read"
          description="A quick reading of what is validating, what looks fragile and where to stay disciplined."
          badge={aiSummary?.configured ? "AI Live" : "Fallback"}
          className="relative overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.07),transparent_24%)]" />
          <div className="relative">
            {aiLoading ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
                Building AI summary...
              </div>
            ) : aiSummary ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(34,211,238,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                      Operational Read
                    </p>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                      {aiSummary.configured ? "OpenAI Live" : "Local Fallback"}
                    </span>
                  </div>
                  <p className="mt-3 text-[14px] leading-7 text-white/78">
                    <AITypewriter text={aiSummary.summary} startDelay={120} />
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                  <AIReviewColumn
                    title="Strengths"
                    tone="emerald"
                    startDelay={380}
                    items={
                      aiSummary.strengths.length
                        ? aiSummary.strengths
                        : ["No clear strength has stood out strongly enough yet."]
                    }
                  />
                  <AIReviewColumn
                    title="Risks"
                    tone="red"
                    startDelay={760}
                    items={
                      aiSummary.risks.length
                        ? aiSummary.risks
                        : ["No major operational risk is being flagged right now."]
                    }
                  />
                  <AIReviewColumn
                    title="Next Actions"
                    tone="cyan"
                    startDelay={1140}
                    items={
                      aiSummary.next_actions.length
                        ? aiSummary.next_actions
                        : ["Keep tracking outcomes so the review can get sharper."]
                    }
                  />
                </div>

                <p className="text-[11px] leading-5 text-white/42">
                  {aiSummary.disclaimer}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                The AI summary could not be loaded right now.
              </div>
            )}
          </div>
        </SectionCard>
        ) : null}

          {topValueToday ? (
            <motion.div
              variants={fadeUp}
              className="scorelab-board-3d relative overflow-hidden rounded-[28px] border border-white/8 p-4"
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
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
                Run today's analyses and the strongest live angle will appear here.
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <ChartCard
            title="ROI by Odds Bucket"
            description="Shows which odds ranges are actually profitable."
            data={oddsBucketChartData}
            xKey="bucket"
          />

          <ChartCard
            title="ROI by Edge Bucket"
            description="Checks whether higher edge is really translating into profit."
            data={edgeBucketChartData}
            xKey="bucket"
          />

          <ChartCard
            title="ROI by Confidence Bucket"
            description="Tests whether high confidence really performs better."
            data={confidenceBucketChartData}
            xKey="bucket"
          />

          <ChartCard
            title="ROI by Risk"
            description="Find out whether Low, Medium or High risk is damaging returns."
            data={riskChartData}
            xKey="risk"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ChartCard
            title="ROI by Edge Lower Bound"
            description="Checks whether stronger edge safety margins are adding value."
            data={edgeLowerBoundChartData}
            xKey="bucket"
            cardClassName="border-white/6 opacity-[0.94]"
            chartHeightClassName="h-[205px]"
          />

          <ChartCard
            title="ROI by Robustness"
            description="A lighter read on whether robust picks are paying off."
            data={robustnessChartData}
            xKey="bucket"
            cardClassName="border-white/6 opacity-[0.94]"
            chartHeightClassName="h-[205px]"
          />
        </div>

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
      </motion.div>
    </AppLayout>
  );
}
