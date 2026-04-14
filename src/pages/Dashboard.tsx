import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { motion } from "framer-motion";
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
import { getSavedMultiples, MULTIPLES_UPDATED_EVENT } from "@/lib/multipleStorage";
import { getAdvancedPerformanceBreakdown } from "@/lib/performanceAnalytics";
import type { SavedAnalysis, AnalysisResult } from "@/types/analysis";
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

export default function Dashboard() {
  const [, setRefreshTick] = useState(0);
  const analyses = getAnalyses();
  const bankrollStats = getBankrollStats();

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

    const riskLevel =
      openExposure <= bankrollStats.currentBankroll * 0.03
        ? "Low"
        : openExposure <= bankrollStats.currentBankroll * 0.08
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

  const marketPerformanceRows = useMemo(
    () =>
      [...(dashboardData.performance?.marketPerformance ?? [])].sort(
        (a, b) => b.hitRate - a.hitRate
      ),
    [dashboardData.performance?.marketPerformance]
  );

  const riskChartData: ChartRow[] =
    dashboardData.performance?.riskPerformance?.map((item) => ({
      ...item,
    })) ?? [];

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8"
      >
        <motion.div variants={fadeUp} className="space-y-2">
          <h1 className="text-[1.55rem] font-semibold tracking-tight text-foreground md:text-[1.8rem]">
            Performance Intelligence
          </h1>
          <p className="text-sm text-muted-foreground">
            Use historical betting performance to find where ScoreLab really wins.
          </p>
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
