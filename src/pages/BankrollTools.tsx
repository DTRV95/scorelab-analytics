import { AppLayout } from "@/components/layout/AppLayout";
import { getEdgeZoneSummary } from "@/lib/edgeInteligence";
import {
  getBetTypePerformance,
  getMultipleMarketPerformance,
  getMultipleCorrelationPerformance,
  getMultipleLegCountPerformance,
  getMultiplePerformanceSummary,
} from "@/lib/multipleStorage";
import {
  type DailyPerformanceItem,
  saveBankrollSettings,
  getMarketPerformance,
  getEdgeBucketPerformance,
  getConfidenceBucketPerformance,
  getQualityScorePerformance,
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
import { MatchdayHero } from "@/components/MatchdayHero";
import { HudStateIcon, HudStatusPill } from "@/components/HudLayer";
import { PulseOnChange } from "@/components/MotionIntelligence";
import { StadiumLightSweep } from "@/components/ArenaEffects";
import { SystemPulse3D } from "@/components/SystemPulse3D";
import { useScoreLabData } from "@/hooks/useScoreLabData";
import { getModelAuditSummary } from "@/lib/modelAudit";
import {
  buildTrueEdgeValidationModel,
  type TrueEdgeVerdict,
} from "@/lib/trueEdgeValidation";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const TRUE_EDGE_FILTERS = ["All", "Trusted", "Promising", "Watch", "Avoid", "Learning"] as const;
type TrueEdgeFilter = (typeof TRUE_EDGE_FILTERS)[number];

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type ChartRow = Record<string, string | number | null | undefined>;

function mergeSimpleAndMultipleMarketPerformance(
  singles: ReturnType<typeof getMarketPerformance>,
  multiples: ReturnType<typeof getMultipleMarketPerformance>
) {
  const merged = new Map<
    string,
    {
      market: string;
      bets: number;
      greens: number;
      reds: number;
      voids: number;
      pending: number;
      profitLoss: number;
    }
  >();

  const upsert = (
    market: string,
    bets: number,
    greens: number,
    reds: number,
    voids: number,
    pending: number,
    profitLoss: number
  ) => {
    const current = merged.get(market) || {
      market,
      bets: 0,
      greens: 0,
      reds: 0,
      voids: 0,
      pending: 0,
      profitLoss: 0,
    };

    current.bets += bets;
    current.greens += greens;
    current.reds += reds;
    current.voids += voids;
    current.pending += pending;
    current.profitLoss += profitLoss;

    merged.set(market, current);
  };

  singles.forEach((item) => {
    upsert(
      item.market,
      item.bets,
      item.greens,
      item.reds,
      item.voids,
      item.pending,
      item.profitLoss
    );
  });

  multiples.forEach((item) => {
    upsert(
      item.market,
      item.bets,
      item.greens,
      item.reds,
      item.voids,
      item.pending,
      item.profitLoss
    );
  });

  return Array.from(merged.values()).map((item) => {
    const settled = item.greens + item.reds;

    return {
      ...item,
      profitLoss: Number(item.profitLoss.toFixed(2)),
      hitRate: settled > 0 ? Number(((item.greens / settled) * 100).toFixed(1)) : 0,
    };
  });
}

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

function getTrueEdgeVerdictClass(verdict: TrueEdgeVerdict) {
  if (verdict === "Trusted") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-700";
  if (verdict === "Promising") return "border-primary/30 bg-primary/10 text-primary";
  if (verdict === "Avoid") return "border-red-300/25 bg-red-300/10 text-red-700";
  if (verdict === "Watch") return "border-amber-300/25 bg-amber-300/10 text-amber-700";
  return "border-border bg-[hsl(var(--sl-surface))] text-muted-foreground";
}

function getLocalDateKey(dateInput: string | null | undefined) {
  if (!dateInput) return null;

  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
    <div className="scorelab-chart-tooltip rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-xl">
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
      className={`relative overflow-hidden rounded-[26px] border border-border ${className}`}
    >
      <div className="relative z-10 flex items-start justify-between gap-4 border-b border-border px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-foreground md:text-[15px]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-6 text-muted-foreground md:text-[13px]">{description}</p>
          ) : null}
        </div>
        {badge ? (
          <span className="sl-pill sl-pill-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em]">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="relative z-10 p-4">{children}</div>
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
    <div className="rounded-xl border border-border p-3.5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-mono-data text-lg font-semibold text-foreground md:text-[1.15rem]">
        {value}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

function CompactStatCard({
  label,
  value,
  change,
  changeType = "neutral",
}: {
  label: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
}) {
  return (
    <PulseOnChange value={`${value}-${change ?? ""}`}>
      <StadiumLightSweep trigger={`${value}-${change ?? ""}`}>
        <motion.div
          whileHover={{ y: -1 }}
          transition={{ type: "spring", stiffness: 360, damping: 26 }}
          className="relative overflow-hidden rounded-[20px] border border-border px-4 py-3.5"
        >
          <div className="relative">
            <p className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              {label}
            </p>
            <div className="mt-2 h-1 w-8 rounded-full bg-primary" />
            <p className="mt-3 font-mono-data text-[1.28rem] font-semibold tracking-[-0.03em] text-foreground md:text-[1.46rem]">
              {value}
            </p>
            {change ? (
              <p
                className={`mt-2.5 text-[9.5px] font-semibold uppercase tracking-[0.11em] leading-4 ${
                  changeType === "positive"
                    ? "text-emerald-700"
                    : changeType === "negative"
                    ? "text-red-400"
                    : "text-muted-foreground"
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
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={safeData}
            layout="vertical"
            margin={{ top: 8, right: 4, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              stroke="hsl(var(--border))"
              horizontal
              vertical={false}
              strokeDasharray="3 3"
            />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey={yKey}
              width={90}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
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
  const { analyses, financialSnapshot, dataVersion, refresh } = useScoreLabData();
  const stats = financialSnapshot.stats;
  const [initialBankrollInput, setInitialBankrollInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [showAllDailyPerformance, setShowAllDailyPerformance] = useState(false);
  const [trueEdgeFilter, setTrueEdgeFilter] = useState<TrueEdgeFilter>("All");

  useEffect(() => {
    setInitialBankrollInput(
      stats.initialBankroll ? String(stats.initialBankroll) : ""
    );
  }, [stats.initialBankroll]);

  const marketPerformance = useMemo(
    () => {
      void dataVersion;
      return mergeSimpleAndMultipleMarketPerformance(
        getMarketPerformance(analyses),
        getMultipleMarketPerformance({ excludeDuplicateSingles: true })
      );
    },
    [analyses, dataVersion]
  );
  const edgeBucketPerformance = useMemo(
    () => {
      void dataVersion;
      return getEdgeBucketPerformance(analyses);
    },
    [analyses, dataVersion]
  );
  const confidenceBucketPerformance = useMemo(
    () => {
      void dataVersion;
      return getConfidenceBucketPerformance(analyses);
    },
    [analyses, dataVersion]
  );
  const qualityScorePerformance = useMemo(
    () => {
      void dataVersion;
      return getQualityScorePerformance(analyses);
    },
    [analyses, dataVersion]
  );
  const edgeZoneSummary = useMemo(() => {
    void dataVersion;
    return getEdgeZoneSummary();
  }, [dataVersion]);
  const trueEdgeValidation = useMemo(
    () => buildTrueEdgeValidationModel(analyses),
    [analyses]
  );
  const modelAuditSummary = useMemo(
    () => getModelAuditSummary(analyses),
    [analyses]
  );

  const handleSaveBankroll = () => {
    const parsedValue = Number(initialBankrollInput);

    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      setSavedMessage("Please enter a valid bankroll value.");
      return;
    }

    saveBankrollSettings({ initialBankroll: parsedValue });
    refresh();
    setSavedMessage("Bankroll baseline saved successfully.");

    setTimeout(() => {
      setSavedMessage("");
    }, 2500);
  };

  const bankrollEvolutionData = financialSnapshot.bankrollEvolution;

  const performanceData = useMemo(
    () => [
      { name: "Greens", value: stats.totalGreens },
      { name: "Reds", value: stats.totalReds },
      { name: "Pending", value: stats.totalPending },
      { name: "Voids", value: stats.totalVoids },
    ],
    [stats]
  );

  const openExposure = financialSnapshot.openExposure;

  const openExposurePct =
    stats.currentBankroll > 0 ? (openExposure / stats.currentBankroll) * 100 : 0;
  const openPotentialProfit = financialSnapshot.openPotentialProfit;
  const combinedDailyPerformance = financialSnapshot.dailyPerformance;
  const todayPerformance = financialSnapshot.todayPerformance;
  const combinedDrawdownSeries = financialSnapshot.drawdownSeries;
  const currentDrawdown = combinedDrawdownSeries.at(-1)?.drawdownPct ?? 0;
  const maxDrawdown = combinedDrawdownSeries.reduce(
    (worst, point) => Math.min(worst, point.drawdownPct),
    0
  );
  const edgeBucketChartData: ChartRow[] = edgeBucketPerformance.map((item) => ({
    ...item,
  }));
  const confidenceBucketChartData: ChartRow[] = confidenceBucketPerformance.map(
    (item) => ({ ...item })
  );
  const qualityScoreChartData: ChartRow[] = qualityScorePerformance.map((item) => ({
    ...item,
  }));
  const betTypePerformance = getBetTypePerformance();
  const multipleLegCountPerformance = getMultipleLegCountPerformance();
  const multipleCorrelationPerformance = getMultipleCorrelationPerformance();
  const multipleSummary = getMultiplePerformanceSummary();
  const strongestMarket = useMemo(
    () =>
      [...marketPerformance].sort((a, b) => {
        if (b.profitLoss !== a.profitLoss) return b.profitLoss - a.profitLoss;
        return b.hitRate - a.hitRate;
      })[0] || null,
    [marketPerformance]
  );
  const betResultsTotal = performanceData.reduce((acc, item) => acc + item.value, 0);
  const combinedDailyProfitSeries = useMemo(
    () =>
      combinedDailyPerformance
        .slice()
        .reverse()
        .map((day) => ({
          date: day.date.slice(5),
          profitLoss: Number(day.profitLoss.toFixed(2)),
          growthPct: Number(day.growthPct.toFixed(2)),
        })),
    [combinedDailyPerformance]
  );
  const visibleDailyPerformance: DailyPerformanceItem[] = showAllDailyPerformance
    ? combinedDailyPerformance
    : combinedDailyPerformance.slice(0, 5);
  const hiddenDailyRows = Math.max(0, combinedDailyPerformance.length - 5);
  const marketPerformanceRows = useMemo(
    () => [...marketPerformance].sort((a, b) => b.hitRate - a.hitRate),
    [marketPerformance]
  );
  const trueEdgeRows = useMemo(() => {
    const rows = trueEdgeValidation.segments.filter((segment) =>
      trueEdgeFilter === "All" ? true : segment.verdict === trueEdgeFilter
    );

    return rows
      .sort((a, b) => {
        const verdictOrder: Record<TrueEdgeVerdict, number> = {
          Trusted: 0,
          Promising: 1,
          Avoid: 2,
          Watch: 3,
          Learning: 4,
        };
        const verdictDiff = verdictOrder[a.verdict] - verdictOrder[b.verdict];
        if (verdictDiff !== 0) return verdictDiff;
        if (b.trueEdgeScore !== a.trueEdgeScore) return b.trueEdgeScore - a.trueEdgeScore;
        return b.settled - a.settled;
      })
      .slice(0, 8);
  }, [trueEdgeFilter, trueEdgeValidation.segments]);
  const bankrollHeroTone =
    openExposurePct > 8
      ? "red"
      : stats.totalProfitLoss >= 0
      ? "emerald"
      : "cyan";
  const bankrollHeroState =
    openExposurePct > 8 ? "risk" : openExposure > 0 ? "scanning" : "online";

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <MatchdayHero
          eyebrow="Bankroll Workspace"
          tone={bankrollHeroTone}
          statusIcon={<HudStateIcon state={bankrollHeroState} />}
          title="Bankroll Tools"
          description="Treat the bankroll as an operating system: set the baseline, track pressure on capital and understand where performance is really coming from."
          statusItems={
            <>
              <HudStatusPill
                label={`${openExposurePct.toFixed(1)}% Exposure`}
                tone={openExposurePct > 8 ? "red" : openExposure > 0 ? "amber" : "cyan"}
                icon={<HudStateIcon state={openExposurePct > 8 ? "risk" : "scanning"} />}
              />
              <HudStatusPill
                label={`${stats.totalPending} Pending`}
                tone={stats.totalPending > 0 ? "amber" : "emerald"}
                icon={<HudStateIcon state={stats.totalPending > 0 ? "scanning" : "online"} />}
              />
              <HudStatusPill
                label={`${stats.roi.toFixed(2)}% ROI`}
                tone={stats.roi >= 0 ? "emerald" : "red"}
                icon={<HudStateIcon state={stats.roi >= 0 ? "online" : "risk"} />}
              />
            </>
          }
          visual={
            <SystemPulse3D
              label="Capital Pulse"
              value={formatCurrency(stats.currentBankroll)}
              detail={`Net P/L ${formatCurrency(stats.totalProfitLoss)} with ${formatCurrency(openExposure)} open.`}
              tone={bankrollHeroTone}
            />
          }
        />

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
                className="h-11 w-full rounded-lg border border-border bg-input px-4 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-end gap-3">
              <button
                type="button"
                onClick={handleSaveBankroll}
                className="h-11 rounded-2xl bg-primary px-5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
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
          className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"
        >
            <CompactStatCard
              label="Free Bankroll"
              value={formatCurrency(stats.currentBankroll)}
              change={`${stats.totalBetsPlaced} tracked bets`}
              changeType="neutral"
            />
            <CompactStatCard
              label="Net P/L"
              value={formatCurrency(stats.totalProfitLoss)}
              change={`${stats.roi.toFixed(2)}% return on total staked`}
              changeType={stats.totalProfitLoss >= 0 ? "positive" : "negative"}
            />
            <CompactStatCard
              label="Open Exposure"
              value={formatCurrency(openExposure)}
              change={`${openExposurePct.toFixed(1)}% of free bankroll`}
              changeType={openExposurePct > 8 ? "negative" : "neutral"}
            />
            <CompactStatCard
              label="Max Drawdown"
              value={`${maxDrawdown.toFixed(2)}%`}
              change={`Live drawdown ${currentDrawdown.toFixed(2)}%`}
              changeType={maxDrawdown < -8 ? "negative" : "neutral"}
            />
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"
        >
            <CompactStatCard
              label="Potential Profit"
              value={formatCurrency(openPotentialProfit)}
              change="If every open position wins"
              changeType={openPotentialProfit > 0 ? "positive" : "neutral"}
            />
            <CompactStatCard
              label="Multiple P/L"
              value={formatCurrency(multipleSummary.profitLoss)}
              change={`${multipleSummary.roi.toFixed(2)}% return on multiple stake`}
              changeType={multipleSummary.profitLoss >= 0 ? "positive" : "negative"}
            />
          <CompactStatCard
            label="Multiple Hit Rate"
            value={`${multipleSummary.hitRate.toFixed(2)}%`}
            change={`${multipleSummary.settledMultiples} settled`}
            changeType="neutral"
          />
          <CompactStatCard
            label="Multiple Stake"
            value={formatCurrency(multipleSummary.totalStake)}
            change="Tracked separately from singles"
            changeType="neutral"
          />
        </motion.div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_1fr]">
          <SectionCard
            title="Bankroll Health"
            description="A practical read on how capital is behaving right now."
            badge="Overview"
          >
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
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
                  label="Settled Today"
                  value={todayPerformance ? `${todayPerformance.growthPct.toFixed(2)}%` : "0.00%"}
                  detail={
                    todayPerformance
                      ? `${formatCurrency(todayPerformance.profitLoss)} across ${todayPerformance.settledBets} settled bets`
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

            <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-4">
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
              <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-4">
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
              <div
                className={`rounded-xl border p-4 ${
                  trueEdgeValidation.bestSegment
                    ? "border-emerald-300/18 bg-emerald-300/[0.06]"
                    : trueEdgeValidation.strongestWarning
                    ? "border-red-300/18 bg-red-300/[0.06]"
                    : "border-border bg-[hsl(var(--sl-surface))]"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  True Edge
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {trueEdgeValidation.bestSegment
                    ? `${trueEdgeValidation.bestSegment.label} is validated.`
                    : trueEdgeValidation.strongestWarning
                    ? `${trueEdgeValidation.strongestWarning.label} is failing validation.`
                    : "No validated edge yet."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {trueEdgeValidation.bestSegment
                    ? `${trueEdgeValidation.bestSegment.actualHitRate.toFixed(1)}% actual vs ${trueEdgeValidation.bestSegment.expectedHitRate.toFixed(1)}% expected · ${trueEdgeValidation.bestSegment.roi.toFixed(2)}% ROI`
                    : trueEdgeValidation.strongestWarning
                    ? `${trueEdgeValidation.strongestWarning.actualHitRate.toFixed(1)}% actual vs ${trueEdgeValidation.strongestWarning.expectedHitRate.toFixed(1)}% expected · avoid until it improves`
                    : "The system requires at least 8 settled results before trusting a zone."}
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Result Mix"
            description="Distribution of tracked outcomes across the bankroll."
            badge="Status"
          >
            <div className="relative flex h-[240px] items-center justify-center">
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
                  className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-3"
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
                  stroke="hsl(var(--border))"
                  vertical={false}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
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
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={combinedDailyProfitSeries}
                  margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip content={<ToolTipCard valueLabel="P/L" suffix="" />} />
                  <Bar dataKey="profitLoss" radius={[10, 10, 0, 0]} maxBarSize={42}>
                    {combinedDailyProfitSeries.map((entry, index) => (
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
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={combinedDrawdownSeries}
                  margin={{ top: 8, right: 6, left: -18, bottom: 0 }}
                >
                  <CartesianGrid
                    stroke="hsl(var(--border))"
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="step"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SegmentBarCard
            title="ROI by Quality Score"
            description="Validates whether high-quality bets are actually producing better returns."
            data={qualityScoreChartData}
            yKey="bucket"
          />
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <SegmentBarCard
            title="Singles vs Multiples"
            description="Direct comparison between simple bets and combined slips."
            data={betTypePerformance}
            yKey="type"
          />
          <SegmentBarCard
            title="Multiple ROI by Legs"
            description="See whether shorter or longer combos are treating the bankroll better."
            data={multipleLegCountPerformance}
            yKey="bucket"
          />
          <SegmentBarCard
            title="Multiple ROI by Correlation"
            description="Validate whether same-game correlation is helping or hurting your multiples."
            data={multipleCorrelationPerformance}
            yKey="bucket"
          />
        </div>

        <SectionCard
          title="Validation Lab"
          description="Audit the zones the system trusts, watches or rejects before they influence roadmap execution."
          badge="True Edge"
          className="overflow-hidden rounded-3xl border border-border bg-card ring-0"
        >
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Trusted
                </p>
                <p className="mt-1 font-mono-data text-lg text-emerald-700">
                  {trueEdgeValidation.summary.trustedCount}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Avoid
                </p>
                <p className="mt-1 font-mono-data text-lg text-red-700">
                  {trueEdgeValidation.summary.avoidCount}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Learning
                </p>
                <p className="mt-1 font-mono-data text-lg text-foreground">
                  {trueEdgeValidation.summary.learningCount}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Min Sample
                </p>
                <p className="mt-1 font-mono-data text-lg text-primary">8</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TRUE_EDGE_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setTrueEdgeFilter(filter)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                    trueEdgeFilter === filter
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-[hsl(var(--sl-surface))] text-muted-foreground hover:bg-[hsl(var(--sl-surface))]"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {trueEdgeRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-[hsl(var(--sl-surface))] px-4 py-5 text-sm text-muted-foreground">
              No validation segments match this filter yet. Keep resolving bets and the lab will become more useful.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-[hsl(var(--sl-surface))]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 pr-4">Segment</th>
                      <th className="px-4 py-3 pr-4">Type</th>
                      <th className="px-4 py-3 pr-4">Verdict</th>
                      <th className="px-4 py-3 pr-4">Settled</th>
                      <th className="px-4 py-3 pr-4">Actual</th>
                      <th className="px-4 py-3 pr-4">Expected</th>
                      <th className="px-4 py-3 pr-4">Gap</th>
                      <th className="px-4 py-3 pr-4">ROI</th>
                      <th className="px-4 py-3 pr-4">Score</th>
                      <th className="px-4 py-3 pr-4">Roadmap Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trueEdgeRows.map((segment) => (
                      <tr
                        key={segment.key}
                        className="border-t border-border text-foreground transition-colors hover:bg-[hsl(var(--sl-surface))]"
                      >
                        <td className="px-4 py-3 pr-4 font-medium">{segment.label}</td>
                        <td className="px-4 py-3 pr-4 text-muted-foreground">{segment.type}</td>
                        <td className="px-4 py-3 pr-4">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${getTrueEdgeVerdictClass(
                              segment.verdict
                            )}`}
                          >
                            {segment.verdict}
                          </span>
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">{segment.settled}</td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {segment.actualHitRate.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {segment.expectedHitRate.toFixed(1)}%
                        </td>
                        <td
                          className={`px-4 py-3 pr-4 font-mono-data ${
                            segment.calibrationGap >= 0
                              ? "text-emerald-700"
                              : "text-red-700"
                          }`}
                        >
                          {segment.calibrationGap >= 0 ? "+" : ""}
                          {segment.calibrationGap.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {segment.roi.toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 pr-4 font-mono-data">
                          {segment.trueEdgeScore}/100
                        </td>
                        <td className="px-4 py-3 pr-4 text-muted-foreground">
                          {segment.verdict === "Trusted" || segment.verdict === "Promising"
                            ? "Can support clean picks"
                            : segment.verdict === "Avoid"
                            ? "Blocks clean execution"
                            : segment.verdict === "Watch"
                            ? "Needs stronger pick quality"
                            : "No operational trust yet"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Daily Performance"
            description="Operational day-by-day recap for bankroll growth and discipline."
            badge="Daily"
            className="overflow-hidden rounded-3xl border border-border bg-card ring-0"
          >
            {combinedDailyPerformance.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-[hsl(var(--sl-surface))] px-4 py-5 text-sm text-muted-foreground">
                No settled bets yet. Track results in History and this page will start showing real bankroll movement.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-[hsl(var(--sl-surface))]">
                {hiddenDailyRows > 0 ? (
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Showing the last 5 days by default.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllDailyPerformance((prev) => !prev)
                      }
                      className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-foreground transition hover:bg-[hsl(var(--sl-surface))]"
                    >
                      {showAllDailyPerformance
                        ? "Show Less"
                        : `Show ${hiddenDailyRows} More`}
                    </button>
                  </div>
                ) : null}
                <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 pr-4">Date</th>
                      <th className="px-4 py-3 pr-4">Start</th>
                      <th className="px-4 py-3 pr-4">End</th>
                      <th className="px-4 py-3 pr-4">P/L</th>
                      <th className="px-4 py-3 pr-4">Growth</th>
                      <th className="px-4 py-3 pr-4">Settled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDailyPerformance.map((item: DailyPerformanceItem) => (
                      <tr key={item.date} className="border-t border-border text-foreground transition-colors hover:bg-[hsl(var(--sl-surface))]">
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
            title="Model Audit"
            description="Paper performance for analysed games. It validates model behaviour without touching bankroll, ROI or real-money P/L."
            badge="Model"
            className="overflow-hidden rounded-3xl border border-border bg-card ring-0"
          >
            {modelAuditSummary.auditedMatches === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-[hsl(var(--sl-surface))] px-4 py-5 text-sm text-muted-foreground">
                No audited matches yet. Add final scores in Simple Bet to validate analysed markets without logging a real stake.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <FocusMetric
                    label="Audited Matches"
                    value={String(modelAuditSummary.auditedMatches)}
                    detail={`${modelAuditSummary.auditedMarkets} market checks`}
                  />
                  <FocusMetric
                    label="Model Hit Rate"
                    value={`${modelAuditSummary.hitRate.toFixed(1)}%`}
                    detail={`${modelAuditSummary.greens} green / ${modelAuditSummary.reds} red`}
                  />
                  <FocusMetric
                    label="Avg Model Prob."
                    value={`${modelAuditSummary.avgModelProb.toFixed(1)}%`}
                    detail="Average predicted probability"
                  />
                  <FocusMetric
                    label="Brier Score"
                    value={modelAuditSummary.brierScore.toFixed(3)}
                    detail="Lower means better calibration"
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-border bg-[hsl(var(--sl-surface))]">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="border-b border-border">
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-3 pr-4">Market</th>
                          <th className="px-4 py-3 pr-4">Samples</th>
                          <th className="px-4 py-3 pr-4">Greens</th>
                          <th className="px-4 py-3 pr-4">Reds</th>
                          <th className="px-4 py-3 pr-4">Hit Rate</th>
                          <th className="px-4 py-3 pr-4">Avg Prob.</th>
                          <th className="px-4 py-3 pr-4">Brier</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modelAuditSummary.marketPerformance.slice(0, 8).map((item) => (
                          <tr
                            key={item.market}
                            className="border-t border-border text-foreground transition-colors hover:bg-[hsl(var(--sl-surface))]"
                          >
                            <td className="px-4 py-3 pr-4 font-medium">{item.market}</td>
                            <td className="px-4 py-3 pr-4 font-mono-data">{item.samples}</td>
                            <td className="px-4 py-3 pr-4 font-mono-data">{item.greens}</td>
                            <td className="px-4 py-3 pr-4 font-mono-data">{item.reds}</td>
                            <td className="px-4 py-3 pr-4 font-mono-data">
                              {item.hitRate.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 pr-4 font-mono-data">
                              {item.avgModelProb.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 pr-4 font-mono-data">
                              {item.brierScore.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Market Performance"
            description="The quickest way to see which markets deserve more trust and which ones should be challenged."
            badge="Markets"
            className="overflow-hidden rounded-3xl border border-border bg-card ring-0"
          >
            {marketPerformance.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-[hsl(var(--sl-surface))] px-4 py-5 text-sm text-muted-foreground">
                No tracked bets yet. Once you log results, market-level performance will appear here.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-[hsl(var(--sl-surface))]">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3 pr-4">Market</th>
                      <th className="px-4 py-3 pr-4">Bets</th>
                      <th className="px-4 py-3 pr-4">Greens</th>
                      <th className="px-4 py-3 pr-4">Reds</th>
                      <th className="px-4 py-3 pr-4">Hit Rate</th>
                      <th className="px-4 py-3 pr-4">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketPerformanceRows.map((item) => (
                      <tr
                        key={item.market}
                        className="border-t border-border text-foreground transition-colors hover:bg-[hsl(var(--sl-surface))]"
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



