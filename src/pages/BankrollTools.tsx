import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
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
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}

function ToolTipCard({
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

  return (
    <div className="rounded-xl border border-white/10 bg-popover px-3 py-2 text-sm shadow-xl">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-foreground">
        {valueLabel}:{" "}
        <span className="font-mono-data">
          {typeof value === "number" ? `${value.toFixed(2)}${suffix}` : value}
        </span>
      </p>
    </div>
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
  description?: string;
  badge?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      variants={fadeUp}
      className={`overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-white/60">{description}</p>
          ) : null}
        </div>
        {badge ? (
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/50">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-5">{children}</div>
    </motion.section>
  );
}

function FocusMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono-data text-xl font-semibold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function SegmentBarCard({
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
    <SectionCard title={title} description={description} badge="Segments">
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={safeData}
            layout="vertical"
            margin={{ top: 8, right: 4, left: 8, bottom: 0 }}
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
              tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey={yKey}
              width={90}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.58)", fontSize: 12 }}
            />
            <Tooltip content={<ToolTipCard valueLabel={title} suffix={suffix} />} />
            <Bar dataKey={valueKey} radius={[0, 10, 10, 0]} maxBarSize={26}>
              {safeData.map((entry, index) => {
                const value = Number(entry[valueKey] ?? 0);
                return (
                  <Cell
                    key={index}
                    fill={
                      value >= 0
                        ? "rgba(16,185,129,0.9)"
                        : "rgba(239,68,68,0.92)"
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

  const marketPerformance = getMarketPerformance();
  const dailyPerformance = getDailyPerformance();
  const edgeBucketPerformance = getEdgeBucketPerformance();
  const confidenceBucketPerformance = getConfidenceBucketPerformance();
  const drawdownSeries = getDrawdownSeries();
  const dailyProfitSeries = getDailyProfitSeries();
  const edgeZoneSummary = getEdgeZoneSummary();

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

    saveBankrollSettings({ initialBankroll: parsedValue });
    loadData();
    setSavedMessage("Bankroll baseline saved successfully.");

    setTimeout(() => {
      setSavedMessage("");
    }, 2500);
  };

  const bankrollEvolutionData = useMemo(() => {
    const sorted = [...analyses].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
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
      { name: "Start", bankroll: Number(runningBankroll.toFixed(2)) },
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

  const performanceData = useMemo(
    () => [
      { name: "Greens", value: stats.totalGreens },
      { name: "Reds", value: stats.totalReds },
      { name: "Pending", value: stats.totalPending },
      { name: "Voids", value: stats.totalVoids },
    ],
    [stats]
  );

  const openExposure = useMemo(
    () =>
      analyses
        .filter(
          (analysis) =>
            analysis.tracking.betPlaced &&
            analysis.tracking.resultStatus === "pending"
        )
        .reduce((sum, analysis) => sum + (analysis.tracking.stakeUsed || 0), 0),
    [analyses]
  );

  const openExposurePct =
    stats.currentBankroll > 0 ? (openExposure / stats.currentBankroll) * 100 : 0;

  const todayPerformance = dailyPerformance[0] || null;
  const currentDrawdown = drawdownSeries.at(-1)?.drawdownPct ?? 0;
  const maxDrawdown = drawdownSeries.reduce(
    (worst, point) => Math.min(worst, point.drawdownPct),
    0
  );
  const edgeBucketChartData: ChartRow[] = edgeBucketPerformance.map((item) => ({
    ...item,
  }));
  const confidenceBucketChartData: ChartRow[] = confidenceBucketPerformance.map(
    (item) => ({ ...item })
  );
  const strongestMarket = marketPerformance[0] || null;
  const betResultsTotal = performanceData.reduce((acc, item) => acc + item.value, 0);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-6"
      >
        <motion.div variants={fadeUp} className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Bankroll Tools</h1>
          <p className="text-sm text-muted-foreground">
            Treat the bankroll as an operating system: set the baseline, track the
            pressure on capital and understand where performance is coming from.
          </p>
        </motion.div>

        <SectionCard
          title="Bankroll Baseline"
          description="This starting balance powers growth, drawdown and bankroll health calculations across the product."
          badge="Setup"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="w-full lg:max-w-xs">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Starting bankroll
              </label>
              <input
                type="number"
                value={initialBankrollInput}
                onChange={(e) => setInitialBankrollInput(e.target.value)}
                placeholder="Enter bankroll"
                className="h-11 w-full rounded-lg border border-white/10 bg-input px-4 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={handleSaveBankroll}
                className="h-11 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Save baseline
              </button>
              {savedMessage ? (
                <p className="text-sm text-primary">{savedMessage}</p>
              ) : null}
            </div>
          </div>
        </SectionCard>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard
            label="Current Bankroll"
            value={formatCurrency(stats.currentBankroll)}
            change={`${stats.totalBetsPlaced} tracked bets`}
            changeType="neutral"
            mono
          />
          <StatCard
            label="Total P/L"
            value={formatCurrency(stats.totalProfitLoss)}
            change={`${stats.roi.toFixed(2)}% ROI`}
            changeType={stats.totalProfitLoss >= 0 ? "positive" : "negative"}
            mono
          />
          <StatCard
            label="Open Exposure"
            value={formatCurrency(openExposure)}
            change={`${openExposurePct.toFixed(1)}% of live bankroll`}
            changeType={openExposurePct > 8 ? "negative" : "neutral"}
            mono
          />
          <StatCard
            label="Max Drawdown"
            value={`${maxDrawdown.toFixed(2)}%`}
            change={`Current drawdown ${currentDrawdown.toFixed(2)}%`}
            changeType={maxDrawdown < -8 ? "negative" : "neutral"}
            mono
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <SectionCard
            title="Bankroll Health"
            description="A practical read on how capital is behaving right now."
            badge="Overview"
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FocusMetric
                label="Hit Rate"
                value={`${stats.hitRate.toFixed(2)}%`}
                detail={`${stats.totalGreens} wins and ${stats.totalReds} losses`}
              />
              <FocusMetric
                label="Pending Bets"
                value={String(stats.totalPending)}
                detail="Open positions still affecting your risk"
              />
              <FocusMetric
                label="Today"
                value={todayPerformance ? `${todayPerformance.growthPct.toFixed(2)}%` : "0.00%"}
                detail={
                  todayPerformance
                    ? `${formatCurrency(todayPerformance.profitLoss)} on ${todayPerformance.settledBets} settled bets`
                    : "No settled bets today"
                }
              />
              <FocusMetric
                label="Best Market"
                value={strongestMarket?.market ?? "N/A"}
                detail={
                  strongestMarket
                    ? `${formatCurrency(strongestMarket.profitLoss)} profit so far`
                    : "Track results to identify your strongest market"
                }
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Strongest Zone
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {edgeZoneSummary.bestMarket
                    ? `${edgeZoneSummary.bestMarket.market} is currently your strongest tracked zone.`
                    : "No strong zone detected yet."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {edgeZoneSummary.bestMarket
                    ? `${edgeZoneSummary.bestMarket.bets} bets · ${edgeZoneSummary.bestMarket.roi.toFixed(2)}% ROI`
                    : "Once you have enough settled bets, this section will become more informative."}
                </p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Confidence Check
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {edgeZoneSummary.bestConfidenceBucket
                    ? `Confidence bucket ${edgeZoneSummary.bestConfidenceBucket.bucket} is leading.`
                    : "Confidence buckets need more settled data."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {edgeZoneSummary.bestConfidenceBucket
                    ? `${edgeZoneSummary.bestConfidenceBucket.bets} bets · ${edgeZoneSummary.bestConfidenceBucket.roi.toFixed(2)}% ROI`
                    : "Keep tracking outcomes to validate whether confidence is actually predictive."}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Result Mix"
            description="Distribution of tracked outcomes across the bankroll."
            badge="Status"
          >
            <div className="relative flex h-[280px] items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<ToolTipCard valueLabel="Count" />} />
                  <Pie
                    data={performanceData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={96}
                    paddingAngle={4}
                    stroke="rgba(255,255,255,0.04)"
                  >
                    {performanceData.map((entry, index) => (
                      <Cell key={index} fill={resultColors[entry.name]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Total
                </p>
                <p className="font-mono-data text-3xl font-semibold text-foreground">
                  {betResultsTotal}
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              {performanceData.map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
                >
                  <p className="text-muted-foreground">{item.name}</p>
                  <p className="mt-1 font-mono-data text-foreground">{item.value}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Bankroll Evolution"
          description="See how the bankroll moved after each settled bet instead of relying on a raw total."
          badge="Trend"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={bankrollEvolutionData}
                margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
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
                  tick={{ fill: "rgba(255,255,255,0.56)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 12 }}
                />
                <Tooltip content={<ToolTipCard valueLabel="Bankroll" suffix="" />} />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="none"
                  fill="rgba(16,185,129,0.12)"
                />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="rgba(16,185,129,0.95)"
                  strokeWidth={2.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            title="Daily P/L"
            description="Resolved day by day, so the trend is easier to trust."
            badge="P/L"
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dailyProfitSeries}
                  margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
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
                    tick={{ fill: "rgba(255,255,255,0.56)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 12 }}
                  />
                  <Tooltip content={<ToolTipCard valueLabel="P/L" suffix="" />} />
                  <Bar dataKey="profitLoss" radius={[10, 10, 0, 0]} maxBarSize={42}>
                    {dailyProfitSeries.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.profitLoss >= 0
                            ? "rgba(16,185,129,0.9)"
                            : "rgba(239,68,68,0.92)"
                        }
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            title="Drawdown"
            description="Understand pressure against the bankroll peak, not just profit or loss."
            badge="Risk"
          >
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={drawdownSeries}
                  margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
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
                    tick={{ fill: "rgba(255,255,255,0.56)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 12 }}
                  />
                  <Tooltip content={<ToolTipCard valueLabel="Drawdown" suffix="%" />} />
                  <Area
                    type="monotone"
                    dataKey="drawdownPct"
                    stroke="none"
                    fill="rgba(239,68,68,0.12)"
                  />
                  <Line
                    type="monotone"
                    dataKey="drawdownPct"
                    stroke="rgba(239,68,68,0.92)"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SegmentBarCard
            title="ROI by Edge Bucket"
            description="Use this to confirm whether the strongest model edges are really monetising."
            data={edgeBucketChartData}
            yKey="bucket"
          />
          <SegmentBarCard
            title="ROI by Confidence Bucket"
            description="A clean check on whether confidence is aligned with outcomes."
            data={confidenceBucketChartData}
            yKey="bucket"
          />
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Daily Performance"
            description="Operational day-by-day recap for bankroll growth and discipline."
            badge="Daily"
            className="overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-0"
          >
            {dailyPerformance.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-muted-foreground">
                No settled bets yet. Track results in History and this page will start showing real bankroll movement.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-white/5">
                    <tr className="text-left text-xs uppercase tracking-wide text-white/45">
                      <th className="px-4 py-3 pr-4">Date</th>
                      <th className="px-4 py-3 pr-4">Start</th>
                      <th className="px-4 py-3 pr-4">End</th>
                      <th className="px-4 py-3 pr-4">P/L</th>
                      <th className="px-4 py-3 pr-4">Growth</th>
                      <th className="px-4 py-3 pr-4">Settled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyPerformance.map((item) => (
                      <tr key={item.date} className="border-t border-white/5 text-white transition-colors hover:bg-white/[0.03]">
                        <td className="px-4 py-3 pr-4 font-medium">{item.date}</td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {formatCurrency(item.startBankroll)}
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {formatCurrency(item.endBankroll)}
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {formatCurrency(item.profitLoss)}
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {item.growthPct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">{item.settledBets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Market Performance"
            description="The quickest way to see which markets deserve more trust and which ones should be challenged."
            badge="Markets"
            className="overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-0"
          >
            {marketPerformance.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-muted-foreground">
                No tracked bets yet. Once you log results, market-level performance will appear here.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-white/5">
                    <tr className="text-left text-xs uppercase tracking-wide text-white/45">
                      <th className="px-4 py-3 pr-4">Market</th>
                      <th className="px-4 py-3 pr-4">Bets</th>
                      <th className="px-4 py-3 pr-4">Greens</th>
                      <th className="px-4 py-3 pr-4">Reds</th>
                      <th className="px-4 py-3 pr-4">Hit Rate</th>
                      <th className="px-4 py-3 pr-4">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketPerformance.map((item) => (
                      <tr
                        key={item.market}
                        className="border-t border-white/5 text-white transition-colors hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3 pr-4 font-medium">{item.market}</td>
                        <td className="px-4 py-3 pr-4 font-mono-data">{item.bets}</td>
                        <td className="px-4 py-3 pr-4 font-mono-data">{item.greens}</td>
                        <td className="px-4 py-3 pr-4 font-mono-data">{item.reds}</td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {item.hitRate.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {formatCurrency(item.profitLoss)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>
            )}
          </SectionCard>
        </div>
      </motion.div>
    </AppLayout>
  );
}



