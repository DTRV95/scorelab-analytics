import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { getEdgeZoneSummary } from "@/lib/edgeInteligence";
import {
  getAnalyses,
  getBankrollSettings,
  saveBankrollSettings,
  getBankrollStats,
  getMarketPerformance,
  getDailyPerformance,
  getEdgeBucketPerformance,
  getConfidenceBucketPerformance,
  getDrawdownSeries,
  getDailyProfitSeries,
} from "@/lib/analysisStorage";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  ComposedChart,
  Area,
  Line,
  Bar,
} from "recharts";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type ChartRow = Record<string, string | number | null | undefined>;

const resultColors: Record<string, string> = {
  Greens: "rgba(34,197,94,0.95)",
  Reds: "rgba(239,68,68,0.95)",
  Pending: "rgba(234,179,8,0.95)",
  Voids: "rgba(148,163,184,0.9)",
};

function ModernTooltip({
  active,
  payload,
  label,
  valueLabel = "Value",
  suffix = "",
}: {
  active?: boolean;
  payload?: Array<{ value?: number | string }>;
  label?: string;
  valueLabel?: string;
  suffix?: string;
}) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0]?.value;
  const displayValue =
    typeof value === "number" ? `${value.toFixed(2)}${suffix}` : value;

  return (
    <div className="rounded-2xl border border-white/10 bg-[hsl(222,47%,7%)] px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="mb-1 text-xs uppercase tracking-wider text-white/50">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <p className="text-sm text-white/70">{valueLabel}</p>
      </div>
      <p className="mt-1 text-lg font-semibold text-white">{displayValue}</p>
    </div>
  );
}

function PremiumCard({
  title,
  description,
  children,
  badge,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="relative mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Bankroll Intelligence
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-white/60">
              {description}
            </p>
          )}
        </div>

        {badge && (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
            {badge}
          </div>
        )}
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function VerticalBarChartCard({
  title,
  description,
  data,
  yKey,
  valueKey = "roi",
  suffix = "%",
}: {
  title: string;
  description: string;
  data: ChartRow[];
  yKey: string;
  valueKey?: string;
  suffix?: string;
}) {
  const safeData = Array.isArray(data) ? data : [];

  return (
    <PremiumCard title={title} description={description} badge="Segments">
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={safeData}
            layout="vertical"
            margin={{ top: 10, right: 12, left: 10, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              stroke="rgba(255,255,255,0.06)"
              horizontal
              vertical={false}
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey={yKey}
              width={80}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
              content={<ModernTooltip valueLabel={title} suffix={suffix} />}
            />
            <Bar dataKey={valueKey} radius={[0, 12, 12, 0]} maxBarSize={26}>
              {safeData.map((entry, index) => {
                const value = Number(entry[valueKey] ?? 0);
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
    </PremiumCard>
  );
}

export default function BankrollTools() {
  const [initialBankrollInput, setInitialBankrollInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [stats, setStats] = useState({
    initialBankroll: 0,
    currentBankroll: 0,
    totalProfitLoss: 0,
    totalBetsPlaced: 0,
    totalGreens: 0,
    totalReds: 0,
    totalVoids: 0,
    totalPending: 0,
    hitRate: 0,
    roi: 0,
  });

  const [analyses, setAnalyses] = useState<ReturnType<typeof getAnalyses>>([]);

  const marketPerformance = useMemo(() => getMarketPerformance(), [analyses]);
  const dailyPerformance = useMemo(() => getDailyPerformance(), [analyses]);
  const edgeBucketPerformance = useMemo(() => getEdgeBucketPerformance(), [analyses]);
  const confidenceBucketPerformance = useMemo(
    () => getConfidenceBucketPerformance(),
    [analyses]
  );
  const drawdownSeries = useMemo(() => getDrawdownSeries(), [analyses]);
  const dailyProfitSeries = useMemo(() => getDailyProfitSeries(), [analyses]);
  const edgeZoneSummary = useMemo(() => getEdgeZoneSummary(), [analyses]);

  const todayPerformance = dailyPerformance[0] || null;
  const yesterdayPerformance = dailyPerformance[1] || null;

  const loadData = () => {
    const settings = getBankrollSettings();
    const bankrollStats = getBankrollStats();
    const savedAnalyses = getAnalyses();

    setInitialBankrollInput(
      settings.initialBankroll ? String(settings.initialBankroll) : ""
    );
    setStats(bankrollStats);
    setAnalyses(savedAnalyses);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveBankroll = () => {
    const parsedValue = Number(initialBankrollInput);

    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      setSavedMessage("Please enter a valid bankroll value.");
      return;
    }

    saveBankrollSettings({
      initialBankroll: parsedValue,
    });

    loadData();
    setSavedMessage("Initial bankroll saved successfully.");

    setTimeout(() => {
      setSavedMessage("");
    }, 2500);
  };

  const bankrollEvolutionData = useMemo(() => {
    const sorted = [...analyses].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    let runningBankroll = stats.initialBankroll;

    const settledBets = sorted.filter(
      (analysis) =>
        analysis.tracking?.betPlaced &&
        (analysis.tracking.resultStatus === "green" ||
          analysis.tracking.resultStatus === "red" ||
          analysis.tracking.resultStatus === "void")
    );

    const data: { name: string; bankroll: number }[] = [
      {
        name: "Start",
        bankroll: Number(runningBankroll.toFixed(2)),
      },
    ];

    settledBets.forEach((analysis, index) => {
      runningBankroll += analysis.tracking?.profitLoss || 0;

      data.push({
        name: `${index + 1}`,
        bankroll: Number(runningBankroll.toFixed(2)),
      });
    });

    return data;
  }, [analyses, stats.initialBankroll]);

  const performanceData = useMemo(() => {
    return [
      { name: "Greens", value: stats.totalGreens },
      { name: "Reds", value: stats.totalReds },
      { name: "Pending", value: stats.totalPending },
      { name: "Voids", value: stats.totalVoids },
    ];
  }, [stats]);

  const betResultsTotal = useMemo(() => {
    return performanceData.reduce((acc, item) => acc + item.value, 0);
  }, [performanceData]);

  const edgeBucketChartData: ChartRow[] = edgeBucketPerformance.map((item) => ({
    ...item,
  }));

  const confidenceBucketChartData: ChartRow[] = confidenceBucketPerformance.map(
    (item) => ({
      ...item,
    })
  );

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-foreground">Bankroll Tools</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your bankroll and track real performance with consistent visual intelligence.
          </p>
        </motion.div>

        <PremiumCard
          title="Initial Bankroll"
          description="Set the bankroll baseline used to calculate growth, ROI and bankroll evolution."
          badge="Settings"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="number"
              value={initialBankrollInput}
              onChange={(e) => setInitialBankrollInput(e.target.value)}
              placeholder="Enter bankroll"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 sm:w-72"
            />
            <button
              onClick={handleSaveBankroll}
              className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-medium text-white transition hover:bg-emerald-400"
            >
              Save Bankroll
            </button>
          </div>

          {savedMessage && (
            <p className="mt-3 text-sm text-emerald-400">{savedMessage}</p>
          )}
        </PremiumCard>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Initial Bankroll"
            value={`€${stats.initialBankroll.toFixed(2)}`}
            change="Starting baseline"
            changeType="neutral"
            mono
          />
          <StatCard
            label="Current Bankroll"
            value={`€${stats.currentBankroll.toFixed(2)}`}
            change={`${stats.totalBetsPlaced} bets tracked`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="Profit / Loss"
            value={`€${stats.totalProfitLoss.toFixed(2)}`}
            change={`${stats.roi.toFixed(2)}% ROI`}
            changeType={stats.totalProfitLoss >= 0 ? "positive" : "negative"}
            mono
          />
          <StatCard
            label="Hit Rate"
            value={`${stats.hitRate.toFixed(2)}%`}
            change={`${stats.totalGreens} greens · ${stats.totalReds} reds`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="Today Growth"
            value={
              todayPerformance ? `${todayPerformance.growthPct.toFixed(2)}%` : "0.00%"
            }
            change="Current day"
            changeType={
              (todayPerformance?.growthPct ?? 0) >= 0 ? "positive" : "negative"
            }
            mono
          />
          <StatCard
            label="Yesterday Growth"
            value={
              yesterdayPerformance
                ? `${yesterdayPerformance.growthPct.toFixed(2)}%`
                : "0.00%"
            }
            change="Previous day"
            changeType={
              (yesterdayPerformance?.growthPct ?? 0) >= 0
                ? "positive"
                : "negative"
            }
            mono
          />
          <StatCard
            label="Pending"
            value={stats.totalPending}
            change={`${stats.totalVoids} voids`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="ROI"
            value={`${stats.roi.toFixed(2)}%`}
            change="Overall performance"
            changeType={stats.roi >= 0 ? "positive" : "negative"}
            mono
          />
        </motion.div>

        <PremiumCard
          title="Bankroll Evolution"
          description="Tracks bankroll growth across all settled bets."
          badge="Trend"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={bankrollEvolutionData}
                margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
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
                  content={<ModernTooltip valueLabel="Bankroll" suffix=" €" />}
                />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="rgba(16,185,129,0.9)"
                  fill="rgba(16,185,129,0.12)"
                  strokeWidth={0}
                />
                <Line
                  type="monotone"
                  dataKey="bankroll"
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
        </PremiumCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PremiumCard
            title="Daily Profit / Loss"
            description="Profitability by resolved day."
            badge="P/L"
          >
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyProfitSeries}
                  margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                  barCategoryGap="28%"
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
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    content={<ModernTooltip valueLabel="Profit / Loss" suffix=" €" />}
                  />
                  <Bar dataKey="profitLoss" radius={[12, 12, 12, 12]} maxBarSize={38}>
                    {dailyProfitSeries.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.profitLoss >= 0
                            ? "rgba(34,197,94,0.95)"
                            : "rgba(239,68,68,0.95)"
                        }
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>

          <PremiumCard
            title="Bet Results Breakdown"
            description="Overall distribution of results."
            badge="Distribution"
          >
            <div className="relative flex h-[320px] items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ModernTooltip valueLabel="Count" />} />
                  <Pie
                    data={performanceData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={4}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth={1}
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={index} fill={resultColors[entry.name]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="pointer-events-none absolute text-center">
                <p className="text-xs uppercase tracking-wider text-white/45">
                  Total
                </p>
                <p className="font-mono-data text-3xl font-bold text-white">
                  {betResultsTotal}
                </p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {performanceData.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
                >
                  <p className="text-white/55">{item.name}</p>
                  <p className="mt-1 font-mono-data text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </PremiumCard>
        </div>

        <PremiumCard
          title="Edge Intelligence"
          description="Detects the strongest zone in your tracked performance."
          badge="Signal"
        >
          {!edgeZoneSummary.bestMarket &&
          !edgeZoneSummary.bestEdgeBucket &&
          !edgeZoneSummary.bestConfidenceBucket ? (
            <p className="text-sm text-white/60">
              Not enough settled bets yet. You need at least 2 bets per group to detect your strongest zone.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-white/45">
                  Best Market
                </p>
                {edgeZoneSummary.bestMarket ? (
                  <>
                    <p className="text-lg font-bold text-white">
                      {edgeZoneSummary.bestMarket.market}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      ROI: {edgeZoneSummary.bestMarket.roi.toFixed(2)}%
                    </p>
                    <p className="text-sm text-white/60">
                      Bets: {edgeZoneSummary.bestMarket.bets}
                    </p>
                    <p className="text-sm text-white/60">
                      Avg Edge: {edgeZoneSummary.bestMarket.avgEdge.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/60">Not enough data</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-white/45">
                  Best Edge Bucket
                </p>
                {edgeZoneSummary.bestEdgeBucket ? (
                  <>
                    <p className="text-lg font-bold text-white">
                      {edgeZoneSummary.bestEdgeBucket.bucket}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      ROI: {edgeZoneSummary.bestEdgeBucket.roi.toFixed(2)}%
                    </p>
                    <p className="text-sm text-white/60">
                      Bets: {edgeZoneSummary.bestEdgeBucket.bets}
                    </p>
                    <p className="text-sm text-white/60">
                      Hit Rate: {edgeZoneSummary.bestEdgeBucket.hitRate.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/60">Not enough data</p>
                )}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="mb-2 text-xs uppercase tracking-wider text-white/45">
                  Best Confidence Bucket
                </p>
                {edgeZoneSummary.bestConfidenceBucket ? (
                  <>
                    <p className="text-lg font-bold text-white">
                      {edgeZoneSummary.bestConfidenceBucket.bucket}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      ROI: {edgeZoneSummary.bestConfidenceBucket.roi.toFixed(2)}%
                    </p>
                    <p className="text-sm text-white/60">
                      Bets: {edgeZoneSummary.bestConfidenceBucket.bets}
                    </p>
                    <p className="text-sm text-white/60">
                      Avg Edge: {edgeZoneSummary.bestConfidenceBucket.avgEdge.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/60">Not enough data</p>
                )}
              </div>
            </div>
          )}
        </PremiumCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <VerticalBarChartCard
            title="ROI by Edge Bucket"
            description="Shows which edge ranges are really converting into profit."
            data={edgeBucketChartData}
            yKey="bucket"
          />

          <VerticalBarChartCard
            title="ROI by Confidence Bucket"
            description="Shows whether higher confidence actually performs better."
            data={confidenceBucketChartData}
            yKey="bucket"
          />
        </div>

        <PremiumCard
          title="Drawdown"
          description="Tracks bankroll vs peak to understand downside pressure."
          badge="Risk"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={drawdownSeries}
                margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="step"
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
                  content={<ModernTooltip valueLabel="Bankroll / Peak" />}
                />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="none"
                  fill="rgba(16,185,129,0.10)"
                />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="rgba(16,185,129,0.95)"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="peak"
                  stroke="rgba(148,163,184,0.9)"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 4"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        <PremiumCard
          title="Breakdown"
          description="Quick operational overview of your tracked bankroll performance."
          badge="Overview"
        >
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-white/55">Pending</p>
              <p className="mt-1 font-semibold text-white">{stats.totalPending}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-white/55">Voids</p>
              <p className="mt-1 font-semibold text-white">{stats.totalVoids}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-white/55">Hit Rate</p>
              <p className="mt-1 font-semibold text-white">
                {stats.hitRate.toFixed(2)}%
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-white/55">ROI</p>
              <p className="mt-1 font-semibold text-white">
                {stats.roi.toFixed(2)}%
              </p>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard
          title="Daily Performance"
          description="Shows how the bankroll behaved day by day."
          badge="Table"
        >
          {dailyPerformance.length === 0 ? (
            <p className="text-sm text-white/60">
              No settled bets yet. Track results in History to see daily growth.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {[
                      "Date",
                      "Start Bankroll",
                      "End Bankroll",
                      "P/L",
                      "Growth %",
                      "Settled Bets",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/45"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyPerformance.map((item) => (
                    <tr
                      key={item.date}
                      className="border-t border-white/5 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-medium text-white">{item.date}</td>
                      <td className="px-4 py-3 font-mono-data text-white">
                        €{item.startBankroll.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono-data text-white">
                        €{item.endBankroll.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono-data text-white">
                        €{item.profitLoss.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-mono-data text-white">
                        {item.growthPct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-white">{item.settledBets}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>

        <PremiumCard
          title="Market Performance"
          description="Helps identify which markets are actually producing returns."
          badge="Markets"
        >
          {marketPerformance.length === 0 ? (
            <p className="text-sm text-white/60">
              No tracked bets yet. Start tracking bets in History to see market performance.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {[
                      "Market",
                      "Bets",
                      "Greens",
                      "Reds",
                      "Hit Rate",
                      "Profit / Loss",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/45"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marketPerformance.map((item) => (
                    <tr
                      key={item.market}
                      className="border-t border-white/5 transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-medium text-white">
                        {item.market}
                      </td>
                      <td className="px-4 py-3 text-white">{item.bets}</td>
                      <td className="px-4 py-3 text-white">{item.greens}</td>
                      <td className="px-4 py-3 text-white">{item.reds}</td>
                      <td className="px-4 py-3 text-white">
                        {item.hitRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 font-mono-data text-white">
                        €{item.profitLoss.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>
      </motion.div>
    </AppLayout>
  );
}