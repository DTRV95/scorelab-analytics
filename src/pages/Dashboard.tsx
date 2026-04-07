import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
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
import { useMemo } from "react";
import { getAnalyses, getBankrollStats } from "@/lib/analysisStorage";
import { getAdvancedPerformanceBreakdown } from "@/lib/performanceAnalytics";
import type { SavedAnalysis, AnalysisResult } from "@/types/analysis";
import { useNavigate } from "react-router-dom";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type ChartRow = Record<string, string | number | null | undefined>;

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

function getRecentLabel(dateString: string) {
  const analysisDate = new Date(dateString);
  const today = new Date();

  const diffMs =
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
    new Date(
      analysisDate.getFullYear(),
      analysisDate.getMonth(),
      analysisDate.getDate()
    ).getTime();

  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return analysisDate.toLocaleDateString();
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
    <motion.div
      variants={fadeUp}
      className="group relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />

      <div className="relative mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Analytics
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-white/60">
            {description}
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
          ROI
        </div>
      </div>

      <div className="relative h-[280px]">
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
    </motion.div>
  );
}

export default function Dashboard() {
  const analyses = getAnalyses();
  const bankrollStats = getBankrollStats();
  const navigate = useNavigate();

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

    const recentAnalyses = validAnalyses
      .slice(0, 5)
      .map((analysis) => {
        const bestBet = getBestBet(analysis.results);
        if (!bestBet) return null;

        return {
          id: analysis.id,
          match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
          market: bestBet.market,
          edge: bestBet.valueBet,
          confidence: bestBet.confidence,
          decision: bestBet.decision,
          date: getRecentLabel(analysis.createdAt),
        };
      })
      .filter(Boolean) as {
      id: string;
      match: string;
      market: string;
      edge: number;
      confidence: number;
      decision: "Bet" | "No Bet" | "Caution";
      date: string;
    }[];

    const openExposure = validAnalyses
      .filter(
        (analysis) =>
          analysis.tracking.betPlaced &&
          analysis.tracking.resultStatus === "pending"
      )
      .reduce((acc, analysis) => acc + (analysis.tracking.stakeUsed || 0), 0);

    const riskLevel =
      openExposure <= bankrollStats.currentBankroll * 0.03
        ? "Low"
        : openExposure <= bankrollStats.currentBankroll * 0.08
        ? "Moderate"
        : "High";

    const performance = getAdvancedPerformanceBreakdown(validAnalyses);

    return {
      analysesToday,
      valueBetsFound,
      avgConfidence,
      avgXg,
      topValueTodayEntry,
      recentAnalyses,
      openExposure,
      riskLevel,
      performance,
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
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-foreground">
            Performance Intelligence
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use historical betting performance to find where ScoreLab really wins.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Settled Bets"
            value={dashboardData.performance?.summary?.totalSettledBets ?? 0}
            change={`${dashboardData.performance?.summary?.hitRate ?? 0}% hit rate`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="ROI"
            value={`${dashboardData.performance?.summary?.overallRoi ?? 0}%`}
            change={`P/L €${(dashboardData.performance?.summary?.totalProfitLoss ?? 0).toFixed(2)}`}
            changeType={
              (dashboardData.performance?.summary?.overallRoi ?? 0) >= 0
                ? "positive"
                : "negative"
            }
            mono
          />
          <StatCard
            label="Avg Confidence"
            value={dashboardData.avgConfidence.toFixed(1)}
            change={`${dashboardData.valueBetsFound} value bets found`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="Bankroll"
            value={`€${bankrollStats.currentBankroll.toFixed(2)}`}
            change={`Open exposure €${dashboardData.openExposure.toFixed(2)} · ${dashboardData.riskLevel}`}
            changeType="neutral"
            mono
          />
        </motion.div>

        {topValueToday && (
          <motion.div
            variants={fadeUp}
            className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Top Value Today
                </p>
                <h2 className="text-xl font-semibold text-foreground">
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
                  <div className="rounded-xl bg-white/[0.03] p-3">
                    <p className="text-muted-foreground">Odds</p>
                    <p className="font-mono-data text-foreground">
                      {topValueToday.bestBet.odds}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/[0.03] p-3">
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

        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />

          <div className="relative mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                Trend
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Daily Profit Trend
              </h2>
              <p className="mt-1 text-sm text-white/60">
                Real betting performance by settled day.
              </p>
            </div>

            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
              P/L
            </div>
          </div>

          <div className="relative h-[300px]">
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
        </motion.div>

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

        <motion.div
          variants={fadeUp}
          className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Performance by Market
            </h2>
            <p className="text-sm text-muted-foreground">
              This is the most important table to discover which market types deserve trust.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
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
                {(dashboardData.performance?.marketPerformance ?? []).length > 0 ? (
                  (dashboardData.performance?.marketPerformance ?? []).map((row) => (
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
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] overflow-hidden"
        >
          <div className="p-6 pb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Recent Analyses
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-white/5">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Match
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Market
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Edge
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Decision
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recentAnalyses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-center text-sm text-muted-foreground"
                    >
                      No recent analyses yet. Run your first analysis to populate the dashboard.
                    </td>
                  </tr>
                ) : (
                  dashboardData.recentAnalyses.map((a, i) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.04 }}
                      onClick={() => navigate(`/history?analysisId=${a.id}`)}
                      className="cursor-pointer border-t border-white/5 transition-all duration-200 hover:bg-white/[0.03]"
                    >
                      <td className="px-6 py-3.5 text-sm font-medium text-foreground">
                        {a.match}
                      </td>
                      <td className="px-6 py-3.5 text-sm text-muted-foreground">
                        {a.market}
                      </td>
                      <td className="px-6 py-3.5">
                        <ValueBadge value={a.edge} />
                      </td>
                      <td className="px-6 py-3.5">
                        <ConfidenceMeter score={a.confidence} className="w-24" />
                      </td>
                      <td className="px-6 py-3.5">
                        <DecisionBadge decision={a.decision} />
                      </td>
                      <td className="px-6 py-3.5 text-sm text-muted-foreground">
                        {a.date}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Performance by Tier
            </h2>
            <p className="text-sm text-muted-foreground">
              This shows whether Premium and Elite are really outperforming the weaker signals.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="border-b border-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
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
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}