import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Flag, Route, TrendingUp, Wallet } from "lucide-react";
import {
  ANALYSES_UPDATED_EVENT,
  getBankrollStats,
} from "@/lib/analysisStorage";
import { MULTIPLES_UPDATED_EVENT } from "@/lib/multipleStorage";
import {
  DEFAULT_ROADMAP_SETTINGS,
  getRoadmapSettings,
  saveRoadmapSettings,
  type RoadmapSettings,
} from "@/lib/roadmapStorage";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
} from "recharts";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatCurrency(value: number) {
  return `EUR ${value.toFixed(2)}`;
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
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
        <div className="mt-3 font-mono-data text-[1.28rem] font-semibold tracking-[-0.03em] text-white md:text-[1.46rem]">
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

export default function Roadmap() {
  const [stats, setStats] = useState(() => getBankrollStats());
  const [settings, setSettings] = useState<RoadmapSettings>(() => getRoadmapSettings());
  const [inputs, setInputs] = useState({
    targetAmount: String(getRoadmapSettings().targetAmount),
    targetDays: String(getRoadmapSettings().targetDays),
    dailyStakePct: String(getRoadmapSettings().dailyStakePct),
    expectedReturnOnStakePct: String(getRoadmapSettings().expectedReturnOnStakePct),
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
    const dailyStakePct = clampPositive(Number(inputs.dailyStakePct), settings.dailyStakePct);
    const expectedReturnOnStakePct = clampPositive(
      Number(inputs.expectedReturnOnStakePct),
      settings.expectedReturnOnStakePct
    );

    return {
      targetAmount,
      targetDays,
      dailyStakePct,
      expectedReturnOnStakePct,
    };
  }, [inputs, settings]);

  const roadmap = useMemo(() => {
    const currentBankroll = Math.max(stats.currentBankroll, 0);
    const targetAmount = parsedInputs.targetAmount;
    const targetDays = parsedInputs.targetDays;
    const dailyStakePct = parsedInputs.dailyStakePct;
    const expectedReturnOnStakePct = parsedInputs.expectedReturnOnStakePct;

    const targetGap = targetAmount - currentBankroll;
    const progressPct =
      targetAmount > 0
        ? Math.max(0, Math.min(100, (currentBankroll / targetAmount) * 100))
        : 0;

    const requiredDailyGrowthRate =
      currentBankroll > 0 && targetAmount > currentBankroll
        ? Math.pow(targetAmount / currentBankroll, 1 / targetDays) - 1
        : 0;

    const plannedDailyGrowthRate =
      (dailyStakePct / 100) * (expectedReturnOnStakePct / 100);

    const requiredProfitToday = currentBankroll * requiredDailyGrowthRate;
    const missionStake = currentBankroll * (dailyStakePct / 100);
    const expectedProfitToday = missionStake * (expectedReturnOnStakePct / 100);
    const requiredReturnOnStakePct =
      dailyStakePct > 0 ? (requiredDailyGrowthRate / (dailyStakePct / 100)) * 100 : 0;

    const projectedBankroll =
      currentBankroll > 0
        ? currentBankroll * Math.pow(1 + plannedDailyGrowthRate, targetDays)
        : 0;

    const onTrack = projectedBankroll >= targetAmount;
    const daysToTarget =
      currentBankroll > 0 &&
      targetAmount > currentBankroll &&
      plannedDailyGrowthRate > 0
        ? Math.ceil(
            Math.log(targetAmount / currentBankroll) /
              Math.log(1 + plannedDailyGrowthRate)
          )
        : 0;

    const path = Array.from({ length: targetDays }, (_, index) => {
      const day = index + 1;

      return {
        day: `D${day}`,
        required: Number(
          (
            currentBankroll * Math.pow(1 + requiredDailyGrowthRate, day)
          ).toFixed(2)
        ),
        projected: Number(
          (
            currentBankroll * Math.pow(1 + plannedDailyGrowthRate, day)
          ).toFixed(2)
        ),
      };
    });

    return {
      currentBankroll,
      targetAmount,
      targetGap,
      progressPct,
      requiredDailyGrowthRate,
      plannedDailyGrowthRate,
      missionStake,
      requiredProfitToday,
      expectedProfitToday,
      requiredReturnOnStakePct,
      projectedBankroll,
      onTrack,
      daysToTarget,
      path,
    };
  }, [parsedInputs, stats.currentBankroll]);

  const handleInputChange = (
    field: keyof typeof inputs,
    value: string
  ) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleSavePlan = () => {
    const nextSettings: RoadmapSettings = {
      targetAmount: parsedInputs.targetAmount,
      targetDays: parsedInputs.targetDays,
      dailyStakePct: parsedInputs.dailyStakePct,
      expectedReturnOnStakePct: parsedInputs.expectedReturnOnStakePct,
    };

    saveRoadmapSettings(nextSettings);
    setSettings(nextSettings);
    setSavedMessage("Roadmap saved successfully.");

    window.setTimeout(() => {
      setSavedMessage("");
    }, 2500);
  };

  const visiblePath = useMemo(() => {
    if (roadmap.path.length <= 10) return roadmap.path;

    return [
      ...roadmap.path.slice(0, 6),
      roadmap.path[roadmap.path.length - 1],
    ];
  }, [roadmap.path]);

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
              Target Planner
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Financial Roadmap
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">
              Build a realistic mission from your live bankroll to a target amount, with a daily staking plan and a growth path you can actually follow.
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            label="Current Bankroll"
            value={formatCurrency(roadmap.currentBankroll)}
            change="Live bankroll"
          />
          <MetricCard
            label="Target"
            value={formatCurrency(roadmap.targetAmount)}
            change={`${formatPct(roadmap.progressPct)} reached`}
            tone="positive"
          />
          <MetricCard
            label="Gap"
            value={formatCurrency(Math.max(0, roadmap.targetGap))}
            change={`${parsedInputs.targetDays} days planned`}
          />
          <MetricCard
            label="Required Daily Growth"
            value={formatPct(roadmap.requiredDailyGrowthRate * 100)}
            change="Needed to hit target"
            tone={roadmap.requiredDailyGrowthRate > roadmap.plannedDailyGrowthRate ? "negative" : "positive"}
          />
          <MetricCard
            label="Projected Bankroll"
            value={formatCurrency(roadmap.projectedBankroll)}
            change={roadmap.onTrack ? "Plan is on track" : "Plan is short"}
            tone={roadmap.onTrack ? "positive" : "negative"}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <PremiumCard
            title="Roadmap Inputs"
            description="Set the destination and the daily behaviour you want the plan to follow."
            badge="Controls"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InputField
                label="Target Amount"
                value={inputs.targetAmount}
                suffix="EUR"
                onChange={(value) => handleInputChange("targetAmount", value)}
              />
              <InputField
                label="Target Days"
                value={inputs.targetDays}
                suffix="days"
                onChange={(value) => handleInputChange("targetDays", value)}
              />
              <InputField
                label="Daily Stake"
                value={inputs.dailyStakePct}
                suffix="%"
                onChange={(value) => handleInputChange("dailyStakePct", value)}
              />
              <InputField
                label="Expected Return On Stake"
                value={inputs.expectedReturnOnStakePct}
                suffix="%"
                onChange={(value) =>
                  handleInputChange("expectedReturnOnStakePct", value)
                }
              />
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
                onClick={() => {
                  setInputs({
                    targetAmount: String(DEFAULT_ROADMAP_SETTINGS.targetAmount),
                    targetDays: String(DEFAULT_ROADMAP_SETTINGS.targetDays),
                    dailyStakePct: String(DEFAULT_ROADMAP_SETTINGS.dailyStakePct),
                    expectedReturnOnStakePct: String(
                      DEFAULT_ROADMAP_SETTINGS.expectedReturnOnStakePct
                    ),
                  });
                }}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/70 transition hover:bg-white/[0.08]"
              >
                Reset Inputs
              </button>
              {savedMessage ? (
                <span className="text-sm text-emerald-300">{savedMessage}</span>
              ) : null}
            </div>
          </PremiumCard>

          <PremiumCard
            title="Today's Mission"
            description="A direct operational target for the current bankroll, based on your roadmap settings."
            badge="Mission"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-emerald-200">
                  <Wallet className="h-4 w-4" strokeWidth={1.6} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Stake Limit
                  </p>
                </div>
                <p className="mt-2 font-mono-data text-2xl font-semibold text-white">
                  {formatCurrency(roadmap.missionStake)}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  This is {formatPct(parsedInputs.dailyStakePct)} of the current bankroll.
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-cyan-200">
                  <TrendingUp className="h-4 w-4" strokeWidth={1.6} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">
                    Profit Needed Today
                  </p>
                </div>
                <p className="mt-2 font-mono-data text-2xl font-semibold text-white">
                  {formatCurrency(roadmap.requiredProfitToday)}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/58">
                  To stay exactly on the path, you need roughly {formatPct(roadmap.requiredReturnOnStakePct)} return on the stake you plan to use today.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 text-white">
                <Route className="h-4 w-4 text-cyan-200" strokeWidth={1.6} />
                <p className="text-sm font-medium">Expected mission outcome</p>
              </div>
              <p className="mt-2 text-sm leading-7 text-white/62">
                With a daily stake of {formatPct(parsedInputs.dailyStakePct)} and an expected return on staked capital of {formatPct(parsedInputs.expectedReturnOnStakePct)}, the model expects about {formatCurrency(roadmap.expectedProfitToday)} profit today and a projected bankroll of {formatCurrency(roadmap.projectedBankroll)} by day {parsedInputs.targetDays}.
              </p>
            </div>
          </PremiumCard>
        </div>

        <PremiumCard
          title="Roadmap Path"
          description="Compare the exact bankroll path needed to hit the target with the path implied by your current daily plan."
          badge={roadmap.onTrack ? "On Track" : "Gap"}
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={visiblePath} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
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
                  contentStyle={{
                    backgroundColor: "hsl(222,47%,7%)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    color: "white",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="required"
                  stroke="rgba(56,189,248,0.95)"
                  strokeWidth={2.5}
                  dot={false}
                  name="Required Path"
                />
                <Line
                  type="monotone"
                  dataKey="projected"
                  stroke="rgba(34,197,94,0.95)"
                  strokeWidth={2.5}
                  dot={false}
                  name="Planned Path"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <PremiumCard
            title="Plan Read"
            description="The roadmap should tell you quickly whether the target is realistic under the current daily behaviour."
            badge="Read"
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-emerald-200" strokeWidth={1.6} />
                  <p className="text-sm font-medium text-white">Target viability</p>
                </div>
                <p className="mt-2 text-sm leading-7 text-white/62">
                  {roadmap.onTrack
                    ? `At the current plan, the bankroll is projected to reach ${formatCurrency(
                        roadmap.projectedBankroll
                      )}, which is enough to clear the target.`
                    : `At the current plan, the bankroll is projected to reach only ${formatCurrency(
                        roadmap.projectedBankroll
                      )}, so the target is still short by ${formatCurrency(
                        roadmap.targetAmount - roadmap.projectedBankroll
                      )}.`}
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Required vs planned growth</p>
                <p className="mt-2 text-sm leading-7 text-white/62">
                  You need around {formatPct(roadmap.requiredDailyGrowthRate * 100)} daily bankroll growth to hit the target, while the current mission assumes about {formatPct(roadmap.plannedDailyGrowthRate * 100)}.
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <p className="text-sm font-medium text-white">Estimated days at current rhythm</p>
                <p className="mt-2 font-mono-data text-xl font-semibold text-white">
                  {roadmap.daysToTarget > 0 ? `${roadmap.daysToTarget} days` : "Already there"}
                </p>
              </div>
            </div>
          </PremiumCard>

          <PremiumCard
            title="Milestones"
            description="Short milestone table so you can compare the ideal path with the one implied by your plan."
            badge="Path"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="border-b border-white/5">
                  <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                    <th className="py-3 pr-4">Day</th>
                    <th className="py-3 pr-4">Required Bankroll</th>
                    <th className="py-3 pr-4">Projected Bankroll</th>
                    <th className="py-3 pr-4">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePath.map((row) => (
                    <tr key={row.day} className="border-t border-white/5">
                      <td className="py-3 pr-4 font-medium text-white">{row.day}</td>
                      <td className="py-3 pr-4 font-mono-data text-white">
                        {formatCurrency(row.required)}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-white">
                        {formatCurrency(row.projected)}
                      </td>
                      <td
                        className={`py-3 pr-4 font-mono-data ${
                          row.projected >= row.required ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {formatCurrency(row.projected - row.required)}
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
