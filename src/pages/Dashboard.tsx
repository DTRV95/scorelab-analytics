import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { motion } from "framer-motion";
import { AITypewriter } from "@/components/AITypewriter";
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
import {
  ANALYSES_UPDATED_EVENT,
  getAnalyses,
  getBankrollStats,
} from "@/lib/analysisStorage";
import {
  getMultipleMarketPerformance,
  getSavedMultiples,
  MULTIPLES_UPDATED_EVENT,
} from "@/lib/multipleStorage";
import { getAdvancedPerformanceBreakdown } from "@/lib/performanceAnalytics";
import type { SavedAnalysis, AnalysisResult } from "@/types/analysis";
import type { MarketPerformance } from "@/lib/portofolioEngine";
import { getDashboardAutoInsights } from "@/lib/edgeInteligence";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

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

interface LeaguePerformanceRow {
  league: string;
  bets: number;
  wins: number;
  losses: number;
  voids: number;
  hitRate: number;
  avgConfidence: number;
  avgEdge: number;
  totalStake: number;
  profitLoss: number;
  roi: number;
  bestMarket: string;
  status: "Strong" | "Stable" | "Weak" | "Too Early";
}

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
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ type: "spring", stiffness: 360, damping: 26 }}
      className="relative overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,22,38,0.96)_0%,rgba(5,14,28,0.98)_100%)] px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
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
      className={`overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] ${className}`}
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

function getLeagueStatus(
  bets: number,
  roi: number,
  hitRate: number
): LeaguePerformanceRow["status"] {
  if (bets < 3) return "Too Early";
  if (roi >= 12 && hitRate >= 55) return "Strong";
  if (roi >= 0 && hitRate >= 50) return "Stable";
  return "Weak";
}

function getLeagueStatusTone(status: LeaguePerformanceRow["status"]) {
  if (status === "Strong") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "Stable") {
    return "border-cyan-400/20 bg-cyan-400/10 text-cyan-200";
  }

  if (status === "Weak") {
    return "border-red-400/20 bg-red-400/10 text-red-200";
  }

  return "border-white/10 bg-white/[0.05] text-white/55";
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
}: {
  title: string;
  description: string;
  data: ChartRow[];
  xKey: string;
  barKey?: string;
}) {
  const safeData: ChartRow[] = Array.isArray(data) ? data : [];

  return (
    <SectionCard title={title} description={description} badge="ROI">
      <div className="h-[240px]">
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
              fill="rgba(255,255,255,0.03)"
            />

            <Bar dataKey={barKey} radius={[12, 12, 12, 12]} maxBarSize={72}>
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
  const [refreshTick, setRefreshTick] = useState(0);
  const [analyses, setAnalyses] = useState(() => getAnalyses());
  const [bankrollStats, setBankrollStats] = useState(() => getBankrollStats());
  const [aiSummary, setAiSummary] = useState<DashboardAISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    setAnalyses(getAnalyses());
    setBankrollStats(getBankrollStats());
  }, [refreshTick]);

  useEffect(() => {
    const handleRefresh = () => {
      setRefreshTick((value) => value + 1);
    };

    window.addEventListener(ANALYSES_UPDATED_EVENT, handleRefresh);
    window.addEventListener(MULTIPLES_UPDATED_EVENT, handleRefresh);

    return () => {
      window.removeEventListener(ANALYSES_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, handleRefresh);
    };
  }, []);

  const dashboardData = useMemo(() => {
    const now = new Date();
    const savedMultiples = getSavedMultiples();

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

    const singlesOpenExposure = validAnalyses
      .filter(
        (analysis) =>
          analysis.tracking.betPlaced &&
          analysis.tracking.resultStatus === "pending"
      )
      .reduce((acc, analysis) => acc + (analysis.tracking.stakeUsed || 0), 0);

    const multiplesOpenExposure = savedMultiples
      .filter(
        (multiple) =>
          multiple.tracking.betPlaced &&
          multiple.tracking.resultStatus === "pending"
      )
      .reduce((acc, multiple) => acc + (multiple.tracking.stakeUsed || 0), 0);

    const openExposure = singlesOpenExposure + multiplesOpenExposure;
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
  }, [analyses, bankrollStats.currentBankroll]);

  const topValueToday = dashboardData.topValueTodayEntry;

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

  const multipleMarketPerformance = getMultipleMarketPerformance({
    excludeDuplicateSingles: true,
  });

  const marketPerformanceRows = useMemo(
    () =>
      mergeMarketPerformanceRows(
        dashboardData.performance?.marketPerformance ?? [],
        multipleMarketPerformance
      ),
    [dashboardData.performance?.marketPerformance, multipleMarketPerformance]
  );

  const leaguePerformanceRows = useMemo<LeaguePerformanceRow[]>(() => {
    const settledAnalyses = analyses.filter(
      (analysis) =>
        analysis.tracking.betPlaced &&
        (analysis.tracking.resultStatus === "green" ||
          analysis.tracking.resultStatus === "red" ||
          analysis.tracking.resultStatus === "void") &&
        analysis.tracking.selectedMarket
    );

    const leagueMap = new Map<
      string,
      {
        bets: number;
        wins: number;
        losses: number;
        voids: number;
        totalStake: number;
        profitLoss: number;
        confidenceSum: number;
        edgeSum: number;
        marketMap: Map<string, { bets: number; totalStake: number; profitLoss: number }>;
      }
    >();

    settledAnalyses.forEach((analysis) => {
      const league = analysis.league?.trim() || "Unspecified";
      const selectedResult = analysis.results.find(
        (result) => result.market === analysis.tracking.selectedMarket
      );

      if (!selectedResult) return;

      if (!leagueMap.has(league)) {
        leagueMap.set(league, {
          bets: 0,
          wins: 0,
          losses: 0,
          voids: 0,
          totalStake: 0,
          profitLoss: 0,
          confidenceSum: 0,
          edgeSum: 0,
          marketMap: new Map(),
        });
      }

      const current = leagueMap.get(league)!;
      const stake = analysis.tracking.stakeUsed || 0;
      const profitLoss = analysis.tracking.profitLoss || 0;
      const market = selectedResult.market;

      current.bets += 1;
      current.totalStake += stake;
      current.profitLoss += profitLoss;
      current.confidenceSum += selectedResult.confidence || 0;
      current.edgeSum += selectedResult.valueBet || 0;

      if (analysis.tracking.resultStatus === "green") current.wins += 1;
      if (analysis.tracking.resultStatus === "red") current.losses += 1;
      if (analysis.tracking.resultStatus === "void") current.voids += 1;

      const existingMarket = current.marketMap.get(market) || {
        bets: 0,
        totalStake: 0,
        profitLoss: 0,
      };

      existingMarket.bets += 1;
      existingMarket.totalStake += stake;
      existingMarket.profitLoss += profitLoss;
      current.marketMap.set(market, existingMarket);
    });

    return Array.from(leagueMap.entries())
      .map(([league, row]) => {
        const hitRate = row.bets > 0 ? (row.wins / row.bets) * 100 : 0;
        const roi = row.totalStake > 0 ? (row.profitLoss / row.totalStake) * 100 : 0;
        const avgConfidence = row.bets > 0 ? row.confidenceSum / row.bets : 0;
        const avgEdge = row.bets > 0 ? row.edgeSum / row.bets : 0;

        const bestMarketEntry =
          Array.from(row.marketMap.entries()).sort((a, b) => {
            const aRoi =
              a[1].totalStake > 0 ? (a[1].profitLoss / a[1].totalStake) * 100 : 0;
            const bRoi =
              b[1].totalStake > 0 ? (b[1].profitLoss / b[1].totalStake) * 100 : 0;

            if (bRoi !== aRoi) return bRoi - aRoi;
            return b[1].bets - a[1].bets;
          })[0];

        return {
          league,
          bets: row.bets,
          wins: row.wins,
          losses: row.losses,
          voids: row.voids,
          hitRate: Number(hitRate.toFixed(1)),
          avgConfidence: Number(avgConfidence.toFixed(2)),
          avgEdge: Number(avgEdge.toFixed(2)),
          totalStake: Number(row.totalStake.toFixed(2)),
          profitLoss: Number(row.profitLoss.toFixed(2)),
          roi: Number(roi.toFixed(1)),
          bestMarket: bestMarketEntry?.[0] ?? "No clear read yet",
          status: getLeagueStatus(row.bets, roi, hitRate),
        };
      })
      .sort((a, b) => {
        if (a.status === "Too Early" && b.status !== "Too Early") return 1;
        if (b.status === "Too Early" && a.status !== "Too Early") return -1;
        return b.roi - a.roi;
      });
  }, [analyses]);

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
      settled_bets: dashboardData.performance?.summary?.totalSettledBets ?? 0,
      roi_pct: dashboardData.performance?.summary?.overallRoi ?? 0,
      profit_loss: dashboardData.performance?.summary?.totalProfitLoss ?? 0,
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
      dashboardData.analysesToday,
      dashboardData.autoInsights,
      dashboardData.avgConfidence,
      dashboardData.openExposure,
      dashboardData.performance?.summary?.overallRoi,
      dashboardData.performance?.summary?.totalProfitLoss,
      dashboardData.performance?.summary?.totalSettledBets,
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
    let isCancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 8000);

    const run = async () => {
      setAiLoading(true);
      try {
        const response = await fetch("http://localhost:8000/ai/dashboard-summary", {
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

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.32)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_32%)]" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Dashboard Workspace
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Performance Intelligence
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">
              Use historical betting performance to find where ScoreLab is really validating and where discipline matters most.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          <CompactStatCard
            label="Settled Bets"
            value={dashboardData.performance?.summary?.totalSettledBets ?? 0}
            change={`${dashboardData.performance?.summary?.hitRate ?? 0}% hit rate`}
          />
          <CompactStatCard
            label="ROI"
            value={`${dashboardData.performance?.summary?.overallRoi ?? 0}%`}
            change={`P/L €${(dashboardData.performance?.summary?.totalProfitLoss ?? 0).toFixed(2)}`}
            changeType={
              (dashboardData.performance?.summary?.overallRoi ?? 0) >= 0
                ? "positive"
                : "negative"
            }
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
              <div
                key={insight.title}
                className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.25)]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                  {insight.title}
                </p>
                <p
                  className={`mt-2.5 text-sm leading-7 ${
                    insight.tone === "positive"
                      ? "text-emerald-300"
                      : insight.tone === "negative"
                      ? "text-red-300"
                      : "text-white/70"
                  }`}
                >
                  {insight.detail}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        <SectionCard
          title="AI Dashboard Read"
          description="A quick reading of what is validating, what looks fragile and where to stay disciplined."
          badge={aiSummary?.configured ? "AI Live" : "Fallback"}
        >
          {aiLoading ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
              Building AI summary...
            </div>
          ) : aiSummary ? (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                    Operational Read
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                    {aiSummary.configured ? "OpenAI Live" : "Local Fallback"}
                  </span>
                </div>
                <p className="mt-2.5 text-sm leading-7 text-white/75">
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

              <p className="text-[11px] leading-5 text-white/42">{aiSummary.disclaimer}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
              The AI summary could not be loaded right now.
            </div>
          )}
        </SectionCard>

        {topValueToday && (
          <motion.div
            variants={fadeUp}
            className="rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-4 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Top Value Today
                </p>
                <h2 className="text-lg font-semibold text-foreground md:text-xl">
                  {topValueToday.analysis.homeTeam} vs {topValueToday.analysis.awayTeam}
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                  <ValueBadge value={topValueToday.bestBet.valueBet} />
                  <DecisionBadge decision={topValueToday.bestBet.decision} />
                  {topValueToday.bestBet.tier && (
                    <TierBadge tier={topValueToday.bestBet.tier} />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Market:{" "}
                  <span className="font-medium text-foreground">
                    {topValueToday.bestBet.market}
                  </span>
                </p>
              </div>

              <div className="min-w-[220px] space-y-3">
                <ConfidenceMeter score={topValueToday.bestBet.confidence} />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <p className="text-muted-foreground">Odds</p>
                    <p className="font-mono-data text-foreground">
                      {topValueToday.bestBet.odds}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                    <p className="text-muted-foreground">Kelly</p>
                    <p className="font-mono-data text-foreground">
                      {topValueToday.bestBet.kelly.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
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
            title="ROI by Edge Lower Bound"
            description="Validates whether stronger edge safety margins are paying off."
            data={edgeLowerBoundChartData}
            xKey="bucket"
          />

          <ChartCard
            title="ROI by Robustness"
            description="Shows whether robust picks are actually winning more money."
            data={robustnessChartData}
            xKey="bucket"
          />

          <ChartCard
            title="ROI by Risk"
            description="Find out whether Low, Medium or High risk is damaging returns."
            data={riskChartData}
            xKey="risk"
          />
        </div>

        <SectionCard
          title="Performance by Market"
          description="This is the most important table to discover which market types deserve trust."
          badge="Markets"
        >
          <div className="overflow-x-auto">
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
        </SectionCard>

        <SectionCard
          title="League Performance"
          description="Validate which leagues are earning trust, which ones still need sample and which market is carrying each competition."
          badge="Leagues"
        >
          <div className="overflow-x-auto">
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
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No settled league data yet. Start tracking results so ScoreLab can validate competitions properly.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
