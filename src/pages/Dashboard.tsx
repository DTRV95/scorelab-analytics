import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { BarChart3, TrendingUp, Target, Zap } from "lucide-react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useMemo, useState } from "react";
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

function startOfCurrentWeek(now: Date) {
  const date = new Date(now);
  const day = date.getDay(); // 0 = Sun, 1 = Mon ...
  const diff = day === 0 ? -6 : 1 - day; // Monday as start
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfCurrentWeek(now: Date) {
  const start = startOfCurrentWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfCurrentMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

function endOfCurrentMonth(now: Date) {
  return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
}

function buildWeeklyTrend(validAnalyses: SavedAnalysis[]) {
  const now = new Date();
  const start = startOfCurrentWeek(now);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return days.map((label, index) => {
    const currentDay = new Date(start);
    currentDay.setDate(start.getDate() + index);

    const dayAnalyses = validAnalyses.filter((analysis) =>
      isSameDay(new Date(analysis.createdAt), currentDay)
    );

    const bestValue = dayAnalyses.reduce((max, analysis) => {
      const bestBet = getBestBet(analysis.results);
      if (!bestBet) return max;
      return Math.max(max, bestBet.valueBet);
    }, 0);

    return {
      name: label,
      value: Number(bestValue.toFixed(1)),
    };
  });
}

function buildMonthlyTrend(validAnalyses: SavedAnalysis[]) {
  const now = new Date();
  const start = startOfCurrentMonth(now);
  const end = endOfCurrentMonth(now);
  const totalDays = end.getDate();

  return Array.from({ length: totalDays }, (_, i) => {
    const currentDay = new Date(start);
    currentDay.setDate(i + 1);

    const dayAnalyses = validAnalyses.filter((analysis) =>
      isSameDay(new Date(analysis.createdAt), currentDay)
    );

    const bestValue = dayAnalyses.reduce((max, analysis) => {
      const bestBet = getBestBet(analysis.results);
      if (!bestBet) return max;
      return Math.max(max, bestBet.valueBet);
    }, 0);

    return {
      name: String(i + 1),
      value: Number(bestValue.toFixed(1)),
    };
  });
}

export default function Dashboard() {
  const analyses = getAnalyses();
  const bankrollStats = getBankrollStats();
  const navigate = useNavigate();
  const [trendView, setTrendView] = useState<"week" | "month">("week");

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

    const valueBetsFound = allResults.filter((result) => result.valueBet > 0).length;

    const avgConfidence =
      allResults.length > 0
        ? allResults.reduce((acc, result) => acc + result.confidence, 0) /
          allResults.length
        : 0;

    const avgXg =
      validAnalyses.length > 0
        ? validAnalyses.reduce((acc, analysis) => acc + analysis.summary.totalXg, 0) /
          validAnalyses.length
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

    const weeklyTrendData = buildWeeklyTrend(validAnalyses);
    const monthlyTrendData = buildMonthlyTrend(validAnalyses);

    const totalTrackedStake = validAnalyses.reduce(
      (acc, analysis) => acc + (analysis.tracking.stakeUsed || 0),
      0
    );

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
      weeklyTrendData,
      monthlyTrendData,
      totalTrackedStake,
      openExposure,
      riskLevel,
      performance,
    };
  }, [analyses, bankrollStats.currentBankroll]);

  const topValueToday = dashboardData.topValueTodayEntry;
  const activeTrendData =
    trendView === "week" ? dashboardData.weeklyTrendData : dashboardData.monthlyTrendData;

  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8">
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-foreground">Good afternoon, Analyst</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's your daily intelligence briefing.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            label="Analyses Today"
            value={dashboardData.analysesToday}
            change={`${analyses.length} total analyses`}
            changeType="neutral"
            icon={<BarChart3 className="w-4 h-4" strokeWidth={1.5} />}
          />
          <StatCard
            label="Value Bets Found"
            value={dashboardData.valueBetsFound}
            change={`${bankrollStats.hitRate.toFixed(1)}% hit rate`}
            changeType="positive"
            icon={<TrendingUp className="w-4 h-4" strokeWidth={1.5} />}
          />
          <StatCard
            label="Avg. Confidence"
            value={dashboardData.avgConfidence.toFixed(1)}
            change={`${analyses.length} tracked analyses`}
            changeType="positive"
            icon={<Target className="w-4 h-4" strokeWidth={1.5} />}
          />
          <StatCard
            label="Avg. xG"
            value={dashboardData.avgXg.toFixed(2)}
            change="Across saved analyses"
            changeType="neutral"
            icon={<Zap className="w-4 h-4" strokeWidth={1.5} />}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div
            variants={fadeUp}
            onClick={() =>
              topValueToday ? navigate(`/history?analysisId=${topValueToday.analysis.id}`) : undefined
            }
            className="lg:col-span-2 rounded-2xl bg-card ring-1 ring-primary/10 p-6 card-shadow card-glow relative overflow-hidden cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(142,71%,45%,0.04)_0%,_transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Top Value Bet Today
                </h2>
                <span className="px-2 py-1 rounded-md gradient-primary text-xs font-bold text-primary-foreground animate-pulse-glow">
                  HOT
                </span>
              </div>

              {topValueToday ? (
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">
                      {topValueToday.analysis.homeTeam} vs {topValueToday.analysis.awayTeam}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {topValueToday.bestBet.market}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          label: "Model Prob.",
                          value: `${topValueToday.bestBet.modelProb}%`,
                          color: "text-foreground",
                        },
                        {
                          label: "Implied Prob.",
                          value: `${topValueToday.bestBet.impliedProb}%`,
                          color: "text-muted-foreground",
                        },
                        {
                          label: "Value Edge",
                          value: `+${topValueToday.bestBet.valueBet.toFixed(1)}%`,
                          color: "text-primary",
                        },
                        {
                          label: "Kelly Stake",
                          value: `${topValueToday.bestBet.kelly.toFixed(1)}%`,
                          color: "text-foreground",
                        },
                      ].map((item, i) => (
                        <motion.div
                          key={item.label}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.3 + i * 0.08 }}
                          className="rounded-xl bg-white/[0.03] ring-1 ring-white/5 p-3 hover:bg-white/[0.05] transition-colors"
                        >
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className={`text-xl font-bold font-mono-data ${item.color}`}>
                            {item.value}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  <div className="flex-1">
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2">Confidence</p>
                      <ConfidenceMeter score={topValueToday.bestBet.confidence} />
                    </div>
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2">Market Direction</p>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium ring-1 ring-primary/20">
                        <TrendingUp className="w-3 h-3" />
                        {topValueToday.bestBet.market.includes("Over")
                          ? "Over leaning"
                          : topValueToday.bestBet.market.includes("Under")
                          ? "Under leaning"
                          : topValueToday.bestBet.market.includes("BTTS")
                          ? "BTTS leaning"
                          : "Model leaning"}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Why this bet?</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        This is the strongest positive edge detected today based on probability
                        advantage, confidence score, and Kelly sizing.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No positive value bets found today. Run new analyses to populate this section.
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            variants={fadeUp}
            className="rounded-2xl bg-card ring-surface p-6 card-shadow"
          >
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Edge Trend
              </h2>

              <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
                <button
                  onClick={() => setTrendView("week")}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    trendView === "week"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setTrendView("month")}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    trendView === "month"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Month
                </button>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={activeTrendData}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222, 47%, 7%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "hsl(210, 40%, 98%)" }}
                  cursor={false}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {activeTrendData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={
                        entry.value >= 5
                          ? "hsl(142, 71%, 45%)"
                          : "hsl(222, 30%, 20%)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <StatCard
            label="Bankroll"
            value={`$${bankrollStats.currentBankroll.toFixed(2)}`}
            change={`Initial: $${bankrollStats.initialBankroll.toFixed(2)}`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="Suggested Exposure"
            value={`$${dashboardData.openExposure.toFixed(2)}`}
            change={`${
              dashboardData.openExposure > 0
                ? (
                    (dashboardData.openExposure /
                      Math.max(bankrollStats.currentBankroll, 1)) *
                    100
                  ).toFixed(1)
                : "0.0"
            }% of bankroll`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="Risk Level"
            value={dashboardData.riskLevel}
            change={`Tracked stake: $${dashboardData.totalTrackedStake.toFixed(2)}`}
            changeType="neutral"
            mono={false}
          />
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-card ring-surface card-shadow overflow-hidden"
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
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Match
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Market
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Edge
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Confidence
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Decision
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recentAnalyses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-8 text-sm text-muted-foreground text-center"
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
                      transition={{ delay: 0.5 + i * 0.05 }}
                      onClick={() => navigate(`/history?analysisId=${a.id}`)}
                      className="border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer"
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
          className="rounded-2xl bg-card ring-surface p-6 card-shadow"
        >
          <div className="mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Performance by Tier
            </h2>
            <p className="text-sm text-muted-foreground">
              This shows which signal levels actually generate profit.
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
                {dashboardData.performance?.tierPerformance?.length > 0 ? (
                  dashboardData.performance.tierPerformance.map((row) => (
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