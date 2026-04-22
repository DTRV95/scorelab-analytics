import { AppLayout } from "@/components/layout/AppLayout";
import { getEdgeZoneSummary } from "@/lib/edgeInteligence";
import {
  MULTIPLES_UPDATED_EVENT,
  getBetTypePerformance,
  getMultipleMarketPerformance,
  getMultipleCorrelationPerformance,
  getMultipleLegCountPerformance,
  getMultiplePerformanceSummary,
  getSavedMultiples,
} from "@/lib/multipleStorage";
import {
  ANALYSES_UPDATED_EVENT,
  type DailyPerformanceItem,
  getAnalyses,
  getBankrollSettings,
  saveBankrollSettings,
  getBankrollStats,
  getMarketPerformance,
  getEdgeBucketPerformance,
  getConfidenceBucketPerformance,
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
import { AITypewriter } from "@/components/AITypewriter";
import { buildFinancialSnapshot } from "@/lib/financialEngine";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type ChartRow = Record<string, string | number | null | undefined>;

interface BankrollAISummary {
  configured: boolean;
  summary: string;
  strengths: string[];
  risks: string[];
  next_actions: string[];
  disclaimer: string;
}

interface BankrollAISummaryPayload {
  current_bankroll: number;
  initial_bankroll: number;
  bankroll_growth_pct: number;
  open_exposure: number;
  open_exposure_pct: number;
  potential_profit: number;
  total_profit_loss: number;
  total_staked: number;
  roi_pct: number;
  hit_rate: number;
  total_bets_placed: number;
  total_pending: number;
  total_greens: number;
  total_reds: number;
  max_drawdown_pct: number;
  current_drawdown_pct: number;
  strongest_market: string | null;
  strongest_market_profit: number | null;
  strongest_zone: string | null;
  best_confidence_bucket: string | null;
  multiple_roi_pct: number;
  multiple_hit_rate: number;
  multiple_settled: number;
  recent_metrics: Array<{
    label: string;
    value: number;
    context: string;
  }>;
}

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

function buildLocalBankrollAiSummary(
  payload: BankrollAISummaryPayload
): BankrollAISummary {
  const strengths: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];

  if (payload.strongest_market) {
    strengths.push(
      `${payload.strongest_market} is currently the strongest market, with EUR ${(payload.strongest_market_profit ?? 0).toFixed(2)} profit.`
    );
  }

  if (payload.best_confidence_bucket) {
    strengths.push(
      `Confidence bucket ${payload.best_confidence_bucket} is the strongest validation zone right now.`
    );
  }

  if (payload.open_exposure_pct >= 10) {
    risks.push(
      `Open exposure is high at ${payload.open_exposure_pct.toFixed(1)}% of live bankroll, so new positions should stay selective.`
    );
  } else {
    strengths.push(
      `Open exposure is controlled at ${payload.open_exposure_pct.toFixed(1)}% of live bankroll.`
    );
  }

  if (payload.max_drawdown_pct <= -20) {
    risks.push(
      `Max drawdown is ${payload.max_drawdown_pct.toFixed(1)}%, which suggests the bankroll path is still volatile.`
    );
  }

  if (payload.multiple_settled > 0 && payload.multiple_roi_pct < 0) {
    risks.push(
      `Multiples are currently negative at ${payload.multiple_roi_pct.toFixed(1)}% ROI, so they should stay secondary.`
    );
  }

  nextActions.push(
    "Keep using bankroll tools to protect capital before increasing exposure."
  );
  nextActions.push(
    "Use the strongest validated zones as the base of the next decisions."
  );

  return {
    configured: false,
    summary: `Your bankroll is at EUR ${payload.current_bankroll.toFixed(2)}, up ${payload.bankroll_growth_pct.toFixed(1)}% from the starting point, with ${payload.roi_pct.toFixed(1)}% ROI across EUR ${payload.total_staked.toFixed(2)} staked.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    next_actions: nextActions.slice(0, 3),
    disclaimer:
      "This review interprets tracked bankroll data. It supports discipline, but it does not replace the betting model.",
  };
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
      className={`overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] ${className}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-white/5 px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold text-white md:text-[15px]">{title}</h2>
          {description ? (
            <p className="mt-1 text-xs leading-6 text-white/58 md:text-[13px]">{description}</p>
          ) : null}
        </div>
        {badge ? (
          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white/50">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="p-4">{children}</div>
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
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3.5">
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
                ? "text-emerald-400"
                : changeType === "negative"
                ? "text-red-400"
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

export default function BankrollTools() {
  const [initialBankrollInput, setInitialBankrollInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [showAllDailyPerformance, setShowAllDailyPerformance] = useState(false);
  const [aiSummary, setAiSummary] = useState<BankrollAISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [stats, setStats] = useState({
    initialBankroll: 0,
    currentBankroll: 0,
    totalProfitLoss: 0,
    totalStaked: 0,
    totalBetsPlaced: 0,
    totalGreens: 0,
    totalReds: 0,
    totalVoids: 0,
    totalPending: 0,
    hitRate: 0,
    roi: 0,
    bankrollGrowthPct: 0,
  });
  const [analyses, setAnalyses] = useState<ReturnType<typeof getAnalyses>>([]);
  const [savedMultiples, setSavedMultiples] = useState<ReturnType<typeof getSavedMultiples>>([]);

  const marketPerformance = mergeSimpleAndMultipleMarketPerformance(
    getMarketPerformance(),
    getMultipleMarketPerformance({ excludeDuplicateSingles: true })
  );
  const edgeBucketPerformance = getEdgeBucketPerformance();
  const confidenceBucketPerformance = getConfidenceBucketPerformance();
  const edgeZoneSummary = getEdgeZoneSummary();

  const loadData = () => {
    const settings = getBankrollSettings();
    const bankrollStats = getBankrollStats();
    const savedAnalyses = getAnalyses();
    const multiples = getSavedMultiples();

    setInitialBankrollInput(
      settings.initialBankroll ? String(settings.initialBankroll) : ""
    );
    setStats(bankrollStats);
    setAnalyses(savedAnalyses);
    setSavedMultiples(multiples);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleRefresh = () => loadData();

    window.addEventListener(ANALYSES_UPDATED_EVENT, handleRefresh);
    window.addEventListener(MULTIPLES_UPDATED_EVENT, handleRefresh);

    return () => {
      window.removeEventListener(ANALYSES_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, handleRefresh);
    };
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

  const financialSnapshot = useMemo(
    () =>
      buildFinancialSnapshot({
        analyses,
        multiples: savedMultiples,
        initialBankroll: stats.initialBankroll,
      }),
    [analyses, savedMultiples, stats.initialBankroll]
  );

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
  const bankrollAiPayload = useMemo<BankrollAISummaryPayload>(
    () => ({
      current_bankroll: stats.currentBankroll,
      initial_bankroll: stats.initialBankroll,
      bankroll_growth_pct: stats.bankrollGrowthPct,
      open_exposure: openExposure,
      open_exposure_pct: openExposurePct,
      potential_profit: openPotentialProfit,
      total_profit_loss: stats.totalProfitLoss,
      total_staked: stats.totalStaked,
      roi_pct: stats.roi,
      hit_rate: stats.hitRate,
      total_bets_placed: stats.totalBetsPlaced,
      total_pending: stats.totalPending,
      total_greens: stats.totalGreens,
      total_reds: stats.totalReds,
      max_drawdown_pct: maxDrawdown,
      current_drawdown_pct: currentDrawdown,
      strongest_market: strongestMarket?.market ?? null,
      strongest_market_profit: strongestMarket?.profitLoss ?? null,
      strongest_zone: edgeZoneSummary.bestMarket?.market ?? null,
      best_confidence_bucket: edgeZoneSummary.bestConfidenceBucket?.bucket ?? null,
      multiple_roi_pct: multipleSummary.roi,
      multiple_hit_rate: multipleSummary.hitRate,
      multiple_settled: multipleSummary.settledMultiples,
      recent_metrics: [
        {
          label: "roi",
          value: Number(stats.roi.toFixed(2)),
          context: "overall betting roi",
        },
        {
          label: "hit-rate",
          value: Number(stats.hitRate.toFixed(2)),
          context: "settled singles and multiples",
        },
        {
          label: "drawdown",
          value: Number(maxDrawdown.toFixed(2)),
          context: "maximum drawdown percentage",
        },
      ],
    }),
    [
      currentDrawdown,
      edgeZoneSummary.bestConfidenceBucket?.bucket,
      edgeZoneSummary.bestMarket?.market,
      maxDrawdown,
      multipleSummary.hitRate,
      multipleSummary.roi,
      multipleSummary.settledMultiples,
      openExposure,
      openExposurePct,
      openPotentialProfit,
      stats.bankrollGrowthPct,
      stats.currentBankroll,
      stats.hitRate,
      stats.initialBankroll,
      stats.roi,
      stats.totalBetsPlaced,
      stats.totalGreens,
      stats.totalPending,
      stats.totalProfitLoss,
      stats.totalReds,
      stats.totalStaked,
      strongestMarket?.market,
      strongestMarket?.profitLoss,
    ]
  );
  const bankrollAiPayloadKey = useMemo(
    () => JSON.stringify(bankrollAiPayload),
    [bankrollAiPayload]
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
        const response = await fetch("http://localhost:8000/ai/bankroll-review", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: bankrollAiPayloadKey,
        });

        if (!response.ok) {
          throw new Error(`Failed to load bankroll AI review (${response.status})`);
        }

        const data = (await response.json()) as BankrollAISummary;
        if (!isCancelled) {
          setAiSummary(data);
        }
      } catch {
        if (!isCancelled) {
          const parsedPayload = JSON.parse(
            bankrollAiPayloadKey
          ) as BankrollAISummaryPayload;
          setAiSummary(buildLocalBankrollAiSummary(parsedPayload));
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
  }, [bankrollAiPayloadKey]);

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
              Bankroll Workspace
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Bankroll Tools
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">
              Treat the bankroll as an operating system: set the baseline, track pressure on capital and understand where performance is really coming from.
            </p>
          </div>
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
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <CompactStatCard
            label="Current Bankroll"
            value={formatCurrency(stats.currentBankroll)}
            change={`${stats.totalBetsPlaced} tracked bets`}
            changeType="neutral"
          />
          <CompactStatCard
            label="Total P/L"
            value={formatCurrency(stats.totalProfitLoss)}
            change={`${stats.roi.toFixed(2)}% ROI`}
            changeType={stats.totalProfitLoss >= 0 ? "positive" : "negative"}
          />
          <CompactStatCard
            label="Open Exposure"
            value={formatCurrency(openExposure)}
            change={`${openExposurePct.toFixed(1)}% of live bankroll`}
            changeType={openExposurePct > 8 ? "negative" : "neutral"}
          />
          <CompactStatCard
            label="Max Drawdown"
            value={`${maxDrawdown.toFixed(2)}%`}
            change={`Current drawdown ${currentDrawdown.toFixed(2)}%`}
            changeType={maxDrawdown < -8 ? "negative" : "neutral"}
          />
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
        >
          <CompactStatCard
            label="Potential Profit"
            value={formatCurrency(openPotentialProfit)}
            change="If every open bet wins"
            changeType={openPotentialProfit > 0 ? "positive" : "neutral"}
          />
          <CompactStatCard
            label="Multiple P/L"
            value={formatCurrency(multipleSummary.profitLoss)}
            change={`${multipleSummary.roi.toFixed(2)}% ROI`}
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

        <SectionCard
          title="AI Bankroll Review"
          description="A quick read on bankroll health, pressure on capital and where discipline matters most."
          badge={aiSummary?.configured ? "AI Live" : "Fallback"}
        >
          {aiLoading ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
              Building bankroll review...
            </div>
          ) : aiSummary ? (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                    Capital Review
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
                      : ["No clear bankroll strength is standing out strongly yet."]
                  }
                />
                <AIReviewColumn
                  title="Risks"
                  tone="red"
                  startDelay={760}
                  items={
                    aiSummary.risks.length
                      ? aiSummary.risks
                      : ["No major bankroll warning is being flagged right now."]
                  }
                />
                <AIReviewColumn
                  title="Next Actions"
                  tone="cyan"
                  startDelay={1140}
                  items={
                    aiSummary.next_actions.length
                      ? aiSummary.next_actions
                      : ["Keep tracking results so the bankroll review can get sharper."]
                  }
                />
              </div>

              <p className="text-[11px] leading-5 text-white/42">{aiSummary.disclaimer}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-white/55">
              The bankroll AI review could not be loaded right now.
            </div>
          )}
        </SectionCard>

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
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={combinedDailyProfitSeries}
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

        <div className="space-y-6">
          <SectionCard
            title="Daily Performance"
            description="Operational day-by-day recap for bankroll growth and discipline."
            badge="Daily"
            className="overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] shadow-[0_10px_40px_rgba(0,0,0,0.35)] ring-0"
          >
            {combinedDailyPerformance.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-muted-foreground">
                No settled bets yet. Track results in History and this page will start showing real bankroll movement.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
                {hiddenDailyRows > 0 ? (
                  <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
                    <p className="text-sm text-white/60">
                      Showing the last 5 days by default.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllDailyPerformance((prev) => !prev)
                      }
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/[0.08]"
                    >
                      {showAllDailyPerformance
                        ? "Show Less"
                        : `Show ${hiddenDailyRows} More`}
                    </button>
                  </div>
                ) : null}
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
                    {visibleDailyPerformance.map((item: DailyPerformanceItem) => (
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
                    {marketPerformanceRows.map((item) => (
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



