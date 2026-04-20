import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Flag,
  Goal,
  Route,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import {
  ANALYSES_UPDATED_EVENT,
  getAnalyses,
  getBankrollStats,
} from "@/lib/analysisStorage";
import { MULTIPLES_UPDATED_EVENT, getSavedMultiples } from "@/lib/multipleStorage";
import {
  DEFAULT_ROADMAP_SETTINGS,
  getRoadmapSettings,
  saveRoadmapSettings,
  type RoadmapSettings,
} from "@/lib/roadmapStorage";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const HEALTHY_RETURN_ON_STAKE_PCT = 10;
const MIN_DAILY_STAKE_PCT = 6;
const MAX_DAILY_STAKE_PCT = 18;

function formatCurrency(value: number) {
  return `EUR ${value.toFixed(2)}`;
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getOpenExposure() {
  const singles = getAnalyses()
    .filter((analysis) => analysis.tracking.betPlaced && analysis.tracking.resultStatus === "pending")
    .reduce((acc, analysis) => acc + (analysis.tracking.stakeUsed || 0), 0);

  const multiples = getSavedMultiples()
    .filter((multiple) => multiple.tracking.betPlaced && multiple.tracking.resultStatus === "pending")
    .reduce((acc, multiple) => acc + (multiple.tracking.stakeUsed || 0), 0);

  return singles + multiples;
}

function getTodayIsoDate() {
  return new Date().toISOString().split("T")[0];
}

function getTodayOperationalStats() {
  const today = getTodayIsoDate();

  const analyses = getAnalyses().filter((analysis) => analysis.createdAt.startsWith(today));
  const multiples = getSavedMultiples().filter((multiple) => multiple.createdAt.startsWith(today));

  const placedSingles = analyses.filter((analysis) => analysis.tracking.betPlaced);
  const placedMultiples = multiples.filter((multiple) => multiple.tracking.betPlaced);

  const stakedToday =
    placedSingles.reduce((acc, analysis) => acc + (analysis.tracking.stakeUsed || 0), 0) +
    placedMultiples.reduce((acc, multiple) => acc + (multiple.tracking.stakeUsed || 0), 0);

  const settledProfitToday =
    placedSingles
      .filter((analysis) => analysis.tracking.resultStatus !== "pending")
      .reduce((acc, analysis) => acc + (analysis.tracking.profitLoss || 0), 0) +
    placedMultiples
      .filter((multiple) => multiple.tracking.resultStatus !== "pending")
      .reduce((acc, multiple) => acc + (multiple.tracking.profitLoss || 0), 0);

  const activeTickets =
    placedSingles.filter((analysis) => analysis.tracking.resultStatus === "pending").length +
    placedMultiples.filter((multiple) => multiple.tracking.resultStatus === "pending").length;

  return {
    stakedToday,
    settledProfitToday,
    ticketsPlacedToday: placedSingles.length + placedMultiples.length,
    activeTickets,
  };
}

function getOddsRange(requiredReturnOnStakePct: number) {
  if (requiredReturnOnStakePct <= 8) return "1.45 - 1.75";
  if (requiredReturnOnStakePct <= 12) return "1.55 - 1.90";
  if (requiredReturnOnStakePct <= 18) return "1.70 - 2.10";
  if (requiredReturnOnStakePct <= 24) return "1.85 - 2.35";
  return "2.10 - 2.80";
}

function getMissionTone(requiredReturnOnStakePct: number) {
  if (requiredReturnOnStakePct <= 10) return "Comfortable";
  if (requiredReturnOnStakePct <= 16) return "Balanced";
  if (requiredReturnOnStakePct <= 22) return "Aggressive";
  return "Stretch";
}

function PremiumCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">
            Roadmap
          </p>
          <h2 className="mt-2 text-base font-semibold text-white md:text-lg">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-white/58">{description}</p>
          ) : null}
        </div>
        {badge ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
            {badge}
          </div>
        ) : null}
      </div>
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function MetricCard({
  label,
  value,
  change,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  change?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <motion.div
      variants={fadeUp}
      className="relative overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,22,38,0.96)_0%,rgba(5,14,28,0.98)_100%)] px-4 py-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_20%)] opacity-80" />
      <div className="relative">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.13em] text-white/38">
          {label}
        </p>
        <div className="mt-2 h-1 w-8 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.88),rgba(34,197,94,0.82))]" />
        <div className="mt-3 font-mono-data text-[1.18rem] font-semibold tracking-[-0.03em] text-white md:text-[1.38rem]">
          {value}
        </div>
        {change ? (
          <p
            className={`mt-2.5 text-[9.5px] font-semibold uppercase tracking-[0.11em] leading-4 ${
              tone === "positive"
                ? "text-emerald-300"
                : tone === "negative"
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

function InputField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full bg-transparent text-sm text-white outline-none"
        />
        {suffix ? (
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/42">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function RoadmapPlanner() {
  const [stats, setStats] = useState(() => getBankrollStats());
  const [settings, setSettings] = useState<RoadmapSettings>(() => getRoadmapSettings());
  const [inputs, setInputs] = useState({
    targetAmount: String(getRoadmapSettings().targetAmount),
    targetDays: String(getRoadmapSettings().targetDays),
  });
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const refresh = () => setStats(getBankrollStats());
    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(MULTIPLES_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, refresh);
    };
  }, []);

  const parsedInputs = useMemo(() => {
    const targetAmount = clampPositive(Number(inputs.targetAmount), settings.targetAmount);
    const targetDays = Math.max(1, Math.round(clampPositive(Number(inputs.targetDays), settings.targetDays)));
    return { targetAmount, targetDays };
  }, [inputs, settings]);

  const roadmap = useMemo(() => {
    const currentBankroll = Math.max(stats.currentBankroll, 0);
    const todayStats = getTodayOperationalStats();
    const targetAmount = parsedInputs.targetAmount;
    const targetDays = parsedInputs.targetDays;
    const openExposure = getOpenExposure();
    const targetGap = Math.max(0, targetAmount - currentBankroll);
    const progressPct = targetAmount > 0 ? Math.max(0, Math.min(100, (currentBankroll / targetAmount) * 100)) : 0;
    const requiredDailyGrowthRate =
      currentBankroll > 0 && targetAmount > currentBankroll
        ? Math.pow(targetAmount / currentBankroll, 1 / targetDays) - 1
        : 0;
    const recommendedDailyStakePct =
      currentBankroll > 0 && requiredDailyGrowthRate > 0
        ? Math.min(
            MAX_DAILY_STAKE_PCT,
            Math.max(
              MIN_DAILY_STAKE_PCT,
              (requiredDailyGrowthRate * 100) / HEALTHY_RETURN_ON_STAKE_PCT * 100
            )
          )
        : 0;
    const missionStake = currentBankroll * (recommendedDailyStakePct / 100);
    const requiredProfitToday = currentBankroll * requiredDailyGrowthRate;
    const requiredReturnOnStakePct = missionStake > 0 ? (requiredProfitToday / missionStake) * 100 : 0;
    const healthyDailyGrowthRate =
      (recommendedDailyStakePct / 100) * (HEALTHY_RETURN_ON_STAKE_PCT / 100);
    const healthyProjection =
      currentBankroll > 0 ? currentBankroll * Math.pow(1 + healthyDailyGrowthRate, targetDays) : 0;
    const oddsRange = getOddsRange(requiredReturnOnStakePct);
    const missionTone = getMissionTone(requiredReturnOnStakePct);
    const exposurePctOfMission = missionStake > 0 ? (openExposure / missionStake) * 100 : 0;
    const remainingMissionCapacity = Math.max(0, missionStake - openExposure);
    const missionProgressPct = missionStake > 0 ? (todayStats.stakedToday / missionStake) * 100 : 0;
    const profitProgressPct =
      requiredProfitToday > 0 ? (todayStats.settledProfitToday / requiredProfitToday) * 100 : 0;
    const elapsedDays = Math.max(
      0,
      Math.floor(
        (new Date(getTodayIsoDate()).getTime() -
          new Date(settings.startedAt.split("T")[0]).getTime()) /
          86400000
      )
    );
    const currentPlanDay = Math.min(targetDays, elapsedDays + 1);
    const remainingDays = Math.max(1, targetDays - elapsedDays);

    const alert =
      currentBankroll <= 0
        ? {
            tone: "negative" as const,
            title: "No bankroll base",
            body: "Set a bankroll baseline first so the system can build a real mission.",
          }
        : targetGap <= 0
        ? {
            tone: "positive" as const,
            title: "Target already reached",
            body: "You already hit the target. Today the clean move is bankroll protection, not forced action.",
          }
        : openExposure >= missionStake && missionStake > 0
        ? {
            tone: "negative" as const,
            title: "Daily cap reached",
            body: `Open exposure already stands at ${formatCurrency(openExposure)}, so the roadmap wants you to stop adding risk today.`,
          }
        : exposurePctOfMission >= 80
        ? {
            tone: "neutral" as const,
            title: "Near the daily cap",
            body: `You only have ${formatCurrency(remainingMissionCapacity)} of clean capacity left before the roadmap considers today's risk budget full.`,
          }
        : requiredReturnOnStakePct > 22
        ? {
            tone: "negative" as const,
            title: "Target is stretched",
            body: "The return needed on today's stake is very demanding. Extending the deadline would create a healthier mission.",
          }
        : {
            tone: "positive" as const,
            title: "Mission is active",
            body: `The roadmap still leaves ${formatCurrency(remainingMissionCapacity)} of controlled daily capacity available.`,
          };

    const nextActions =
      currentBankroll <= 0
        ? [
            "Define a bankroll baseline before using the roadmap.",
            "Do not force action until the capital base is stable.",
            "Reopen the planner after resetting the bankroll.",
          ]
        : openExposure >= missionStake && missionStake > 0
        ? [
            "Stop adding new bets for today.",
            "Let existing exposure resolve before redeploying capital.",
            "Review whether tomorrow's target or deadline should be softened.",
          ]
        : requiredReturnOnStakePct > 22
        ? [
            "Focus only on premium spots inside the suggested odds zone.",
            "Avoid low-edge volume just to fill the mission.",
            "Consider extending the deadline to reduce pressure.",
          ]
        : [
            `Keep total risk close to ${formatCurrency(missionStake)} today.`,
            `Work mainly in the ${oddsRange} odds zone.`,
            `Do not chase above ${formatPct(requiredReturnOnStakePct)} required return on stake.`,
          ];

    const path = Array.from({ length: targetDays }, (_, index) => {
      const day = index + 1;
      return {
        day: `D${day}`,
        targetPath: Number((currentBankroll * Math.pow(1 + requiredDailyGrowthRate, day)).toFixed(2)),
        healthyPath: Number((currentBankroll * Math.pow(1 + healthyDailyGrowthRate, day)).toFixed(2)),
      };
    });

    return {
      currentBankroll,
      targetAmount,
      targetGap,
      progressPct,
      requiredDailyGrowthRate,
      recommendedDailyStakePct,
      missionStake,
      requiredProfitToday,
      requiredReturnOnStakePct,
      openExposure,
      exposurePctOfMission,
      remainingMissionCapacity,
      healthyProjection,
      oddsRange,
      missionTone,
      alert,
      todayStats,
      missionProgressPct,
      profitProgressPct,
      currentPlanDay,
      remainingDays,
      nextActions,
      path,
    };
  }, [parsedInputs, settings.startedAt, stats.currentBankroll]);

  const visiblePath = useMemo(() => {
    if (roadmap.path.length <= 10) return roadmap.path;
    return [...roadmap.path.slice(0, 6), roadmap.path[roadmap.path.length - 1]];
  }, [roadmap.path]);

  const handleSavePlan = () => {
    const nextSettings: RoadmapSettings = {
      targetAmount: parsedInputs.targetAmount,
      targetDays: parsedInputs.targetDays,
      startedAt: settings.startedAt || new Date().toISOString(),
    };
    saveRoadmapSettings(nextSettings);
    setSettings(nextSettings);
    setSavedMessage("Roadmap saved successfully.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  };

  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8 p-6">
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.32)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_32%)]" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Target Planner
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Financial Roadmap
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">
              Define the target and the deadline. The system will suggest the daily bankroll percentage to risk, the return needed, the odds zone to work in, and alerts when today's risk budget is already full.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Current Bankroll" value={formatCurrency(roadmap.currentBankroll)} change="Live bankroll" />
          <MetricCard label="Target" value={formatCurrency(roadmap.targetAmount)} change={`${formatPct(roadmap.progressPct)} reached`} tone="positive" />
          <MetricCard label="Gap" value={formatCurrency(roadmap.targetGap)} change={`${roadmap.remainingDays} days left`} />
          <MetricCard label="Daily Stake %" value={formatPct(roadmap.recommendedDailyStakePct)} change={roadmap.missionTone} tone={roadmap.missionTone === "Comfortable" || roadmap.missionTone === "Balanced" ? "positive" : roadmap.missionTone === "Aggressive" ? "neutral" : "negative"} />
          <MetricCard label="Suggested Odds" value={roadmap.oddsRange} change="Working zone" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <PremiumCard
            title="Roadmap Inputs"
            description="You only define the destination. The daily mission is calculated by the system."
            badge="Controls"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InputField label="Target Amount" value={inputs.targetAmount} suffix="EUR" onChange={(value) => setInputs((prev) => ({ ...prev, targetAmount: value }))} />
              <InputField label="Target Days" value={inputs.targetDays} suffix="days" onChange={(value) => setInputs((prev) => ({ ...prev, targetDays: value }))} />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSavePlan}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 text-sm font-medium text-emerald-200 transition hover:bg-emerald-400/15"
              >
                Save Roadmap
              </button>
              <button
                type="button"
                onClick={() =>
                  setInputs({
                    targetAmount: String(DEFAULT_ROADMAP_SETTINGS.targetAmount),
                    targetDays: String(DEFAULT_ROADMAP_SETTINGS.targetDays),
                  })
                }
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/70 transition hover:bg-white/[0.08]"
              >
                Reset Inputs
              </button>
              {savedMessage ? <span className="text-sm text-emerald-300">{savedMessage}</span> : null}
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-white/42">
              Plan started on {settings.startedAt.split("T")[0]} · day {roadmap.currentPlanDay} of {parsedInputs.targetDays}
            </p>
          </PremiumCard>

          <PremiumCard
            title="Today's Mission"
            description="The roadmap now defines the mission itself, instead of asking you to guess it."
            badge="Auto"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-emerald-200">
                  <Wallet className="h-4 w-4" strokeWidth={1.6} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Stake Limit</p>
                </div>
                <p className="mt-2 font-mono-data text-2xl font-semibold text-white">{formatCurrency(roadmap.missionStake)}</p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  The system wants to risk around {formatPct(roadmap.recommendedDailyStakePct)} of the live bankroll today.
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-cyan-200">
                  <TrendingUp className="h-4 w-4" strokeWidth={1.6} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">Return Needed</p>
                </div>
                <p className="mt-2 font-mono-data text-2xl font-semibold text-white">{formatPct(roadmap.requiredReturnOnStakePct)}</p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  That is the return needed on the daily stake to stay on the roadmap.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Profit Needed Today</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">{formatCurrency(roadmap.requiredProfitToday)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Open Exposure</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">{formatCurrency(roadmap.openExposure)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Capacity Left</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">{formatCurrency(roadmap.remainingMissionCapacity)}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Staked Today</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">{formatCurrency(roadmap.todayStats.stakedToday)}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-white/45">
                  {formatPct(Math.max(0, roadmap.missionProgressPct))} of mission
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">P/L Today</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">{formatCurrency(roadmap.todayStats.settledProfitToday)}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-white/45">
                  {formatPct(roadmap.profitProgressPct)} of profit target
                </p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">Open Tickets</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">{roadmap.todayStats.activeTickets}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-white/45">
                  {roadmap.todayStats.ticketsPlacedToday} placed today
                </p>
              </div>
            </div>
          </PremiumCard>
        </div>

        <PremiumCard
          title="System Alerts"
          description="The roadmap should also protect the bankroll, not only chase the target."
          badge={roadmap.alert.title}
        >
          <div
            className={`rounded-[24px] border p-4 ${
              roadmap.alert.tone === "positive"
                ? "border-emerald-400/20 bg-emerald-400/10"
                : roadmap.alert.tone === "negative"
                ? "border-red-400/20 bg-red-400/10"
                : "border-cyan-400/20 bg-cyan-400/10"
            }`}
          >
            <div className="flex items-center gap-2">
              {roadmap.alert.tone === "negative" ? (
                <ShieldAlert className="h-4 w-4 text-red-200" strokeWidth={1.7} />
              ) : roadmap.alert.tone === "positive" ? (
                <Goal className="h-4 w-4 text-emerald-200" strokeWidth={1.7} />
              ) : (
                <TriangleAlert className="h-4 w-4 text-cyan-200" strokeWidth={1.7} />
              )}
              <p className="text-sm font-medium text-white">{roadmap.alert.title}</p>
            </div>
            <p className="mt-2 text-sm leading-7 text-white/70">{roadmap.alert.body}</p>
            <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/48">
              Exposure used: {formatPct(Math.min(999, roadmap.exposurePctOfMission))}
            </p>
          </div>
        </PremiumCard>

        <PremiumCard
          title="Roadmap Path"
          description="Compare the exact path to the target with a healthier path based on cleaner daily return expectations."
          badge={roadmap.missionTone}
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visiblePath} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tickMargin={10} tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(222,47%,7%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    color: "white",
                  }}
                />
                <Line type="monotone" dataKey="targetPath" stroke="rgba(56,189,248,0.95)" strokeWidth={2.5} dot={false} name="Target Path" />
                <Line type="monotone" dataKey="healthyPath" stroke="rgba(34,197,94,0.95)" strokeWidth={2.5} dot={false} name="Healthy Path" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <PremiumCard title="Plan Read" description="A direct read of what the roadmap is asking from the operation." badge="Read">
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-emerald-200" strokeWidth={1.6} />
                  <p className="text-sm font-medium text-white">Target pressure</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-white/62">
                  To go from {formatCurrency(roadmap.currentBankroll)} to {formatCurrency(roadmap.targetAmount)} in {parsedInputs.targetDays} days, the bankroll needs roughly {formatPct(roadmap.requiredDailyGrowthRate * 100)} growth per day.
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Route className="h-4 w-4 text-cyan-200" strokeWidth={1.6} />
                  <p className="text-sm font-medium text-white">Suggested execution zone</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-white/62">
                  Today the system would work with around {formatPct(roadmap.recommendedDailyStakePct)} bankroll exposure and odds in the {roadmap.oddsRange} area. That mission is currently classified as <span className="font-semibold text-white">{roadmap.missionTone}</span>.
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Healthy projection</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">{formatCurrency(roadmap.healthyProjection)}</p>
                <p className="mt-2 text-sm leading-7 text-white/62">
                  This is where the bankroll would land if the stake plan is respected but the daily return stays around a cleaner {formatPct(HEALTHY_RETURN_ON_STAKE_PCT)} on the staked amount.
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">System actions</p>
                <div className="mt-2 space-y-2 text-sm leading-7 text-white/62">
                  {roadmap.nextActions.map((action) => (
                    <p key={action}>{action}</p>
                  ))}
                </div>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard title="Milestones" description="Short table to compare the exact path with the healthier one." badge="Path">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="border-b border-white/5">
                  <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                    <th className="py-3 pr-4">Day</th>
                    <th className="py-3 pr-4">Target Path</th>
                    <th className="py-3 pr-4">Healthy Path</th>
                    <th className="py-3 pr-4">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePath.map((row) => (
                    <tr key={row.day} className="border-t border-white/5">
                      <td className="py-3 pr-4 font-medium text-white">{row.day}</td>
                      <td className="py-3 pr-4 font-mono-data text-white">{formatCurrency(row.targetPath)}</td>
                      <td className="py-3 pr-4 font-mono-data text-white">{formatCurrency(row.healthyPath)}</td>
                      <td className={`py-3 pr-4 font-mono-data ${row.healthyPath >= row.targetPath ? "text-emerald-300" : "text-red-300"}`}>
                        {formatCurrency(row.healthyPath - row.targetPath)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        </div>
      </motion.div>
    </AppLayout>
  );
}
