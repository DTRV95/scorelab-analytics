import { AppLayout } from "@/components/layout/AppLayout";
import { motion } from "framer-motion";
import { SystemPulse3D } from "@/components/SystemPulse3D";
import { HudStateIcon, HudStatusPill } from "@/components/HudLayer";
import { PulseOnChange } from "@/components/MotionIntelligence";
import { AnalyticOrb, RiskBar } from "@/components/DataObjects";
import { MatchdayHero } from "@/components/MatchdayHero";
import { StadiumLightSweep } from "@/components/ArenaEffects";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Flag,
  Goal,
  Route,
  Trash2,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  ANALYSES_UPDATED_EVENT,
  getAllAnalysisTrackingEntries,
  getAnalyses,
  getBestPerformingZone,
  getBankrollStats,
} from "@/lib/analysisStorage";
import {
  MULTIPLES_UPDATED_EVENT,
  getMultiplePerformanceSummary,
  getSavedMultiples,
} from "@/lib/multipleStorage";
import {
  DEFAULT_ROADMAP_SETTINGS,
  createRoadmapMissionId,
  deleteRoadmapMission,
  getRoadmapDayMemories,
  getRoadmapMissions,
  getRoadmapSettings,
  overwriteRoadmapDayMemories,
  saveRoadmapMission,
  saveRoadmapSettings,
  syncRoadmapDayMemories,
  type RoadmapDayMemory,
  type RoadmapMissionRecord,
  type RoadmapSettings,
} from "@/lib/roadmapStorage";
import { buildFinancialSnapshot } from "@/lib/financialEngine";
import { PERSISTENCE_HYDRATED_EVENT } from "@/lib/persistenceSync";
import { buildRadarOpportunities, type RadarOpportunity } from "@/lib/valueRadar";

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const HEALTHY_RETURN_ON_STAKE_PCT = 10;
const MIN_DAILY_STAKE_PCT = 8;
const MAX_DAILY_STAKE_PCT = 65;
const MAX_REALISTIC_RETURN_ON_STAKE_PCT = 20;
const MAX_STRETCH_RETURN_ON_STAKE_PCT = 30;
const ROADMAP_RADAR_MIN_MODEL_PROB = 75;
const ROADMAP_TIMEZONE = "Europe/Lisbon";
const surfaceCardClass =
  "scorelab-board-3d scorelab-tilt-3d rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.02)_100%)] p-5 backdrop-blur-sm";
const compactSurfaceCardClass =
  "scorelab-board-3d scorelab-tilt-3d rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] p-4 backdrop-blur-sm";

function formatCurrency(value: number) {
  return `EUR ${value.toFixed(2)}`;
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function normalizeProbabilityPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return value <= 1 ? value * 100 : value;
}

function clampPositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getIsoDateOnly(value: string | Date) {
  if (typeof value === "string") {
    const isoLikeMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoLikeMatch) {
      return isoLikeMatch[1];
    }
  }

  return getDateKeyInTimezone(value);
}

function getDateKeyInTimezone(value: string | Date, timeZone = ROADMAP_TIMEZONE) {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function getDayOffset(startedAt: string, index: number) {
  const base = parseDateOnly(getIsoDateOnly(startedAt));
  base.setDate(base.getDate() + index);
  return getIsoDateOnly(base);
}

function getLocalDayDifference(from: string, to: string) {
  const fromLocalMidnight = parseDateOnly(from);
  const toLocalMidnight = parseDateOnly(to);

  return Math.floor(
    (toLocalMidnight.getTime() - fromLocalMidnight.getTime()) / 86400000
  );
}

function getOddsRange(requiredReturnOnStakePct: number) {
  if (requiredReturnOnStakePct <= 8) return "1.45 - 1.75";
  if (requiredReturnOnStakePct <= 12) return "1.55 - 1.90";
  if (requiredReturnOnStakePct <= 18) return "1.70 - 2.10";
  if (requiredReturnOnStakePct <= 24) return "1.85 - 2.35";
  return "2.10 - 2.80";
}

function getOddsExecutionOptions(requiredReturnOnStakePct: number) {
  if (requiredReturnOnStakePct <= 8) {
    return [
      "3 singles around 1.35-1.45",
      "2 singles around 1.45-1.55",
      "1 clean single around 1.60",
    ];
  }

  if (requiredReturnOnStakePct <= 12) {
    return [
      "3 singles around 1.40-1.50",
      "2 singles around 1.55-1.65",
      "1 single around 1.75-1.85",
    ];
  }

  if (requiredReturnOnStakePct <= 18) {
    return [
      "3 singles around 1.45-1.60",
      "2 singles around 1.60-1.75",
      "1 single around 1.90-2.10",
    ];
  }

  if (requiredReturnOnStakePct <= 24) {
    return [
      "3 singles around 1.50-1.65",
      "2 singles around 1.70-1.90",
      "1 higher-risk single around 2.10-2.35",
    ];
  }

  return [
    "3 singles around 1.55-1.75",
    "2 singles around 1.85-2.05",
    "1 aggressive single around 2.30+",
  ];
}

function getExecutionMode(
  requiredReturnOnStakePct: number,
  exposurePctOfMission: number,
  targetRealism: string
) {
  if (requiredReturnOnStakePct <= 10) {
    return {
      mode: "Single-Focused",
      badge: "Low Variance",
      tone: "positive" as const,
      summary: "Today's target can be reached with disciplined singles, so the system prefers cleaner execution over complexity.",
      guidance: [
        "Prioritize one or two premium singles.",
        "Stay inside the lower end of the suggested odds range.",
        "Avoid forcing a multiple just to speed things up.",
      ],
    };
  }

  if (requiredReturnOnStakePct <= 18) {
    return {
      mode: "Split Execution",
      badge: "Balanced",
      tone: "neutral" as const,
      summary: "The target is better approached by spreading risk across two or three controlled positions instead of one oversized ticket.",
      guidance: [
        "Split the mission across two or three selections.",
        "Keep average odds in the structured execution zone.",
        "Let the mission build steadily rather than chasing one big return.",
      ],
    };
  }

  if (targetRealism === "Unrealistic" || requiredReturnOnStakePct > 24) {
    return {
      mode: "Deadline Pressure",
      badge: "Stretch",
      tone: "negative" as const,
      summary: "The roadmap is under too much pressure for clean execution, so the system prefers extending the timeline over escalating risk.",
      guidance: [
        "Reduce urgency instead of forcing high-risk structures.",
        "Only consider a multiple if every leg is already premium quality.",
        "Extending the plan is healthier than chasing the target in one day.",
      ],
    };
  }

  return {
    mode: "Multiple-Assisted",
    badge: "Selective Combo",
    tone: "neutral" as const,
    summary: "A carefully selected combo can assist the mission, but only if the legs are already strong on their own.",
    guidance: [
      "Use singles first, and only add a multiple if the board is strong.",
      "Keep the combo short and correlation-aware.",
      "Do not let the multiple become the whole plan.",
    ],
  };
}

function getMissionTone(requiredReturnOnStakePct: number) {
  if (requiredReturnOnStakePct <= 10) return "Comfortable";
  if (requiredReturnOnStakePct <= 16) return "Balanced";
  if (requiredReturnOnStakePct <= 22) return "Aggressive";
  return "Stretch";
}

function getTargetRealism(requiredReturnOnStakePct: number) {
  if (requiredReturnOnStakePct <= 12) return "Realistic";
  if (requiredReturnOnStakePct <= 18) return "Demanding";
  if (requiredReturnOnStakePct <= MAX_STRETCH_RETURN_ON_STAKE_PCT) return "Stretched";
  return "Unrealistic";
}

function getAdaptiveMission(bankroll: number, targetAmount: number, remainingDays: number) {
  const safeBankroll = Math.max(0, bankroll);
  const safeRemainingDays = Math.max(1, remainingDays);
  const targetGap = Math.max(0, targetAmount - safeBankroll);
  const requiredDailyGrowthRate =
    safeBankroll > 0 && targetAmount > safeBankroll
      ? Math.pow(targetAmount / safeBankroll, 1 / safeRemainingDays) - 1
      : 0;
  const requiredProfit = safeBankroll * requiredDailyGrowthRate;

  if (safeBankroll <= 0 || requiredProfit <= 0) {
    return {
      targetGap,
      requiredProfit: 0,
      requiredDailyGrowthRate: 0,
      recommendedStakePct: 0,
      missionStake: 0,
      requiredReturnOnStakePct: 0,
      plannedReturnOnStakePct: 0,
      plannedProfit: 0,
      pressureGap: 0,
    };
  }

  let selectedStakePct = MAX_DAILY_STAKE_PCT;
  let selectedReturnPct = 0;

  for (let stakePct = MIN_DAILY_STAKE_PCT; stakePct <= MAX_DAILY_STAKE_PCT; stakePct += 0.5) {
    const stakeAmount = safeBankroll * (stakePct / 100);
    const neededReturnPct = stakeAmount > 0 ? (requiredProfit / stakeAmount) * 100 : 0;
    if (neededReturnPct <= MAX_REALISTIC_RETURN_ON_STAKE_PCT) {
      selectedStakePct = stakePct;
      selectedReturnPct = neededReturnPct;
      break;
    }
  }

  if (selectedReturnPct === 0) {
    for (let stakePct = MIN_DAILY_STAKE_PCT; stakePct <= MAX_DAILY_STAKE_PCT; stakePct += 0.5) {
      const stakeAmount = safeBankroll * (stakePct / 100);
      const neededReturnPct = stakeAmount > 0 ? (requiredProfit / stakeAmount) * 100 : 0;
      if (neededReturnPct <= MAX_STRETCH_RETURN_ON_STAKE_PCT) {
        selectedStakePct = stakePct;
        selectedReturnPct = neededReturnPct;
        break;
      }
    }
  }

  const missionStake = safeBankroll * (selectedStakePct / 100);
  const requiredReturnOnStakePct =
    missionStake > 0 ? (requiredProfit / missionStake) * 100 : 0;
  const maxPossibleProfit =
    safeBankroll * (MAX_DAILY_STAKE_PCT / 100) * (MAX_STRETCH_RETURN_ON_STAKE_PCT / 100);
  const plannedReturnOnStakePct =
    selectedReturnPct > 0 ? selectedReturnPct : MAX_STRETCH_RETURN_ON_STAKE_PCT;
  const plannedProfit =
    selectedReturnPct > 0 ? requiredProfit : Math.min(requiredProfit, maxPossibleProfit);
  const pressureGap = Math.max(0, requiredProfit - plannedProfit);

  return {
    targetGap,
    requiredProfit,
    requiredDailyGrowthRate,
    recommendedStakePct: selectedStakePct,
    missionStake,
    requiredReturnOnStakePct,
    plannedReturnOnStakePct,
    plannedProfit,
    pressureGap,
  };
}

function classifyRoadmapDay(
  targetStake: number,
  actualStake: number,
  targetProfit: number,
  actualProfit: number
): RoadmapDayMemory["classification"] {
  if (actualStake <= 0) return "quiet";
  if (targetStake > 0 && actualStake > targetStake * 1.05) return "overexposed";
  if (targetProfit > 0 && actualProfit >= targetProfit && actualStake <= targetStake) {
    return "efficient";
  }
  if (targetStake > 0 && actualStake >= targetStake && actualProfit < targetProfit) {
    return "forced";
  }
  return "disciplined";
}

function getDisciplineProfile(memories: Array<{ classification: RoadmapDayMemory["classification"] }>) {
  if (memories.length === 0) {
    return {
      score: 50,
      label: "Building",
      note: "The roadmap needs a few tracked days before discipline quality becomes meaningful.",
    };
  }

  const weights: Record<RoadmapDayMemory["classification"], number> = {
    efficient: 100,
    disciplined: 82,
    quiet: 60,
    forced: 34,
    overexposed: 18,
  };

  const score =
    memories.reduce((sum, memory) => sum + weights[memory.classification], 0) /
    memories.length;

  if (score >= 85) {
    return {
      score,
      label: "Elite",
      note: "Execution has been clean, efficient and well controlled across recent sessions.",
    };
  }

  if (score >= 70) {
    return {
      score,
      label: "Stable",
      note: "The roadmap is being followed with decent discipline and limited forcing.",
    };
  }

  if (score >= 50) {
    return {
      score,
      label: "Mixed",
      note: "Execution is uneven. The mission still needs more consistency day to day.",
    };
  }

  return {
    score,
    label: "Fragile",
    note: "The recent pattern is too reactive, so the roadmap should prioritize control over speed.",
  };
}

function getSystemCommand({
  availableBankroll,
  targetGap,
  openExposure,
  missionStake,
  missionStatus,
  targetRealism,
  remainingMissionCapacity,
}: {
  availableBankroll: number;
  targetGap: number;
  openExposure: number;
  missionStake: number;
  missionStatus: string;
  targetRealism: string;
  remainingMissionCapacity: number;
}) {
  if (availableBankroll <= 0) {
    return {
      label: "Reset",
      tone: "negative" as const,
      body: "Pause execution and restore the bankroll base before continuing the mission.",
    };
  }

  if (targetGap <= 0) {
    return {
      label: "Protect",
      tone: "positive" as const,
      body: "The target has already been reached, so the mission should focus on protection rather than new risk.",
    };
  }

  if (missionStatus === "Overexposed" || (missionStake > 0 && openExposure >= missionStake)) {
    return {
      label: "Stop",
      tone: "negative" as const,
      body: "Open exposure has already consumed the day's risk budget. Let positions settle before adding more.",
    };
  }

  if (targetRealism === "Unrealistic") {
    return {
      label: "Reduce Pressure",
      tone: "negative" as const,
      body: "The mission is asking for too much from the current bankroll. Extend the timeline instead of forcing execution.",
    };
  }

  if (remainingMissionCapacity <= 0) {
    return {
      label: "Hold",
      tone: "neutral" as const,
      body: "There is no clean daily capacity left. Hold position and reassess after settlement.",
    };
  }

  return {
    label: "Deploy",
    tone: "positive" as const,
    body: `The roadmap still allows ${formatCurrency(remainingMissionCapacity)} of controlled capacity for today's plan.`,
  };
}

function getRadarExecutionPlan({
  opportunities,
  stakeBudget,
  profitTarget,
}: {
  opportunities: RadarOpportunity[];
  stakeBudget: number;
  profitTarget: number;
}) {
  const cleanStakeBudget = Math.max(0, stakeBudget);
  const cleanProfitTarget = Math.max(0, profitTarget);

  const candidates = opportunities
    .filter((opportunity) => {
      if (!Number.isFinite(opportunity.odds) || opportunity.odds <= 1) return false;
      if (normalizeProbabilityPct(opportunity.modelProb) <= ROADMAP_RADAR_MIN_MODEL_PROB) return false;
      return true;
    })
    .sort((a, b) => {
      const tierWeight = { premium: 4, elite: 3, bet: 2, watchlist: 1, discard: 0 };
      const bModelProb = normalizeProbabilityPct(b.modelProb);
      const aModelProb = normalizeProbabilityPct(a.modelProb);
      if (bModelProb !== aModelProb) return bModelProb - aModelProb;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      const tierDiff = (tierWeight[b.tier ?? "discard"] || 0) - (tierWeight[a.tier ?? "discard"] || 0);
      if (tierDiff !== 0) return tierDiff;
      return b.edge - a.edge;
    })
    .slice(0, 4);

  const picks = candidates.slice(0, 4).map((opportunity) => {
    const profitPerEuro = opportunity.odds - 1;
    const requiredStake = profitPerEuro > 0 ? cleanProfitTarget / profitPerEuro : 0;
    const projectedProfit = requiredStake * profitPerEuro;
    const normalizedModelProb = normalizeProbabilityPct(opportunity.modelProb);
    const fitsCapacity = requiredStake <= cleanStakeBudget;
    const isClean =
      fitsCapacity &&
      opportunity.decision === "Bet" &&
      opportunity.edge > 0 &&
      opportunity.confidence >= 7.5 &&
      normalizedModelProb >= 78;
    const guardrail =
      isClean
        ? ({
            label: "Clean",
            tone: "positive" as const,
            reason: "Probability, edge, confidence and stake fit are aligned.",
          })
        : fitsCapacity && normalizedModelProb >= ROADMAP_RADAR_MIN_MODEL_PROB
        ? ({
            label: "Watch",
            tone: "neutral" as const,
            reason: "Probability is strong, but at least one quality signal is not fully aligned.",
          })
        : ({
            label: "Avoid",
            tone: "negative" as const,
            reason: "The stake required does not fit the remaining mission capacity.",
          });

    return {
      ...opportunity,
      suggestedStake: Number(requiredStake.toFixed(2)),
      projectedProfit: Number(projectedProfit.toFixed(2)),
      fitsCapacity,
      guardrail,
    };
  });
  const bestCapacityFit =
    picks.find((pick) => pick.guardrail.label === "Clean") ??
    picks.find((pick) => pick.fitsCapacity) ??
    null;

  if (cleanProfitTarget <= 0 || candidates.length === 0) {
    return {
      candidates,
      picks: [] as Array<
        RadarOpportunity & {
          suggestedStake: number;
          projectedProfit: number;
          fitsCapacity: boolean;
          guardrail: {
            label: "Clean" | "Watch" | "Avoid";
            tone: "positive" | "neutral" | "negative";
            reason: string;
          };
        }
      >,
      totalStake: 0,
      projectedProfit: 0,
      coveragePct: 0,
      fullyCovered: false,
      bestCapacityFit: null as
        | (RadarOpportunity & {
            suggestedStake: number;
            projectedProfit: number;
            fitsCapacity: boolean;
            guardrail: {
              label: "Clean" | "Watch" | "Avoid";
              tone: "positive" | "neutral" | "negative";
              reason: string;
            };
          })
        | null,
    };
  }

  return {
    candidates,
    picks,
    totalStake: bestCapacityFit ? bestCapacityFit.suggestedStake : 0,
    projectedProfit: bestCapacityFit ? bestCapacityFit.projectedProfit : 0,
    coveragePct: bestCapacityFit ? 100 : 0,
    fullyCovered: Boolean(bestCapacityFit),
    bestCapacityFit,
  };
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
      className="scorelab-stage-3d scorelab-board-3d relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="scorelab-depth-grid pointer-events-none absolute inset-x-8 bottom-0 h-24 opacity-25" />
      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/45">
            Mission System
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white md:text-[1.2rem]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-white/56">{description}</p>
          ) : null}
        </div>
        {badge ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/50">
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
    <PulseOnChange value={`${label}-${String(value)}-${change ?? ""}`}>
      <StadiumLightSweep trigger={`${label}-${String(value)}-${change ?? ""}`}>
      <motion.div
        variants={fadeUp}
        className="scorelab-board-3d scorelab-tilt-3d relative overflow-hidden rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(9,22,38,0.96)_0%,rgba(5,14,28,0.98)_100%)] px-4 py-3.5"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.10),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_20%)] opacity-80" />
        <div className="relative">
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-cyan-100/38">
            {label}
          </p>
          <div className="mt-2 h-1 w-8 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.88),rgba(34,197,94,0.82))]" />
          <div className="mt-3 text-[1rem] font-semibold tracking-[-0.03em] text-white md:text-[1.14rem]">
            {value}
          </div>
          {change ? (
            <p
              className={`mt-2.5 text-[9px] font-semibold uppercase tracking-[0.15em] leading-4 ${
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
      </StadiumLightSweep>
    </PulseOnChange>
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
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/40">
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
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export default function RoadmapPlanner() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(() => getBankrollStats());
  const [analyses, setAnalyses] = useState(() => getAnalyses());
  const [multiples, setMultiples] = useState(() => getSavedMultiples());
  const [settings, setSettings] = useState<RoadmapSettings>(() => getRoadmapSettings());
  const [dayMemories, setDayMemories] = useState(() => getRoadmapDayMemories());
  const [missionHistory, setMissionHistory] = useState<RoadmapMissionRecord[]>(() =>
    getRoadmapMissions()
  );
  const [inputs, setInputs] = useState({
    targetAmount: String(getRoadmapSettings().targetAmount),
    targetDays: String(getRoadmapSettings().targetDays),
  });
  const [savedMessage, setSavedMessage] = useState("");
  const [showFullDailyLog, setShowFullDailyLog] = useState(false);

  const effectiveStartedAt = useMemo(() => {
    const candidates = [getIsoDateOnly(settings.startedAt)];
    const memoryDates = dayMemories.map((memory) => memory.date).filter(Boolean);
    if (memoryDates.length > 0) {
      candidates.push(...memoryDates);
    }
    return candidates.sort((a, b) => a.localeCompare(b))[0];
  }, [dayMemories, settings.startedAt]);

  useEffect(() => {
    const refresh = () => {
      setStats(getBankrollStats());
      setAnalyses(getAnalyses());
      setMultiples(getSavedMultiples());
      setDayMemories(getRoadmapDayMemories());
      setSettings(getRoadmapSettings());
      setMissionHistory(getRoadmapMissions());
    };

    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(MULTIPLES_UPDATED_EVENT, refresh);
    window.addEventListener(PERSISTENCE_HYDRATED_EVENT, refresh);
    return () => {
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, refresh);
      window.removeEventListener(PERSISTENCE_HYDRATED_EVENT, refresh);
    };
  }, []);

  const parsedInputs = useMemo(() => {
    const targetAmount = clampPositive(Number(inputs.targetAmount), settings.targetAmount);
    const targetDays = Math.max(1, Math.round(clampPositive(Number(inputs.targetDays), settings.targetDays)));
    return { targetAmount, targetDays };
  }, [inputs, settings]);

  const roadmap = useMemo(() => {
    const availableBankroll = Math.max(stats.currentBankroll, 0);
    const startingBankroll = Math.max(stats.initialBankroll, 0);
    const startedAt = effectiveStartedAt || getDateKeyInTimezone(new Date());
    const today = getDateKeyInTimezone(new Date());
    const existingMemoryByDate = new Map(dayMemories.map((memory) => [memory.date, memory]));
    const targetAmount = parsedInputs.targetAmount;
    const targetDays = parsedInputs.targetDays;
    const trackedAnalysisEntries = getAllAnalysisTrackingEntries(analyses);
    const financialSnapshot = buildFinancialSnapshot({
      analyses: trackedAnalysisEntries.map((entry) => ({
        createdAt: entry.createdAt,
        tracking: entry.tracking,
      })),
      multiples,
      initialBankroll: startingBankroll,
    });
    const dailyPerformanceMap = new Map(
      financialSnapshot.dailyPerformance.map((entry) => [entry.date, entry])
    );
    const openExposure = financialSnapshot.openExposure;
    const missionCapital = availableBankroll + openExposure;
    const elapsedDays = Math.max(
      0,
      getLocalDayDifference(getIsoDateOnly(startedAt), today)
    );
    const currentPlanDay = Math.min(targetDays, elapsedDays + 1);
    const remainingDays = Math.max(1, targetDays - elapsedDays);
    const adaptiveMission = getAdaptiveMission(availableBankroll, targetAmount, remainingDays);
    const targetGap = Math.max(0, targetAmount - missionCapital);
    const availableTargetGap = adaptiveMission.targetGap;
    const missionProgressToTargetPct =
      targetAmount > 0 ? Math.max(0, Math.min(100, (availableBankroll / targetAmount) * 100)) : 0;
    const bankrollProgressToTargetPct =
      targetAmount > 0 ? Math.max(0, Math.min(100, (availableBankroll / targetAmount) * 100)) : 0;

    const dailyLog = Array.from({ length: targetDays }, (_, index) => {
      const date = getDayOffset(startedAt, index);
      const existingMemory = existingMemoryByDate.get(date);
      const dayCreatedAnalyses = trackedAnalysisEntries.filter(
        (entry) =>
          entry.tracking.betPlaced &&
          getDateKeyInTimezone(entry.createdAt) === date
      );
      const dayCreatedMultiples = multiples.filter(
        (multiple) =>
          multiple.tracking.betPlaced &&
          getDateKeyInTimezone(multiple.createdAt) === date
      );
      const dayPerformance = dailyPerformanceMap.get(date) || null;

      const actualStake =
        dayCreatedAnalyses.reduce((acc, entry) => acc + (entry.tracking.stakeUsed || 0), 0) +
        dayCreatedMultiples.reduce((acc, multiple) => acc + (multiple.tracking.stakeUsed || 0), 0);

      const actualProfit =
        dayPerformance
          ? dayPerformance.profitLoss
          : date < today && existingMemory
          ? existingMemory.actualProfit
          : 0;

      return {
        day: index + 1,
        date,
        actualStake,
        actualProfit,
        tickets: dayCreatedAnalyses.length + dayCreatedMultiples.length,
        activeTickets:
          dayCreatedAnalyses.filter((entry) => entry.tracking.resultStatus === "pending").length +
          dayCreatedMultiples.filter((multiple) => multiple.tracking.resultStatus === "pending").length,
        settledBets: dayPerformance?.settledBets || 0,
      };
    });

    const todayActualEntry = dailyLog[Math.min(elapsedDays, dailyLog.length - 1)] ?? {
      day: 1,
      date: today,
      actualStake: 0,
      actualProfit: 0,
      tickets: 0,
      activeTickets: 0,
      settledBets: 0,
    };

    const requiredDailyGrowthRate = adaptiveMission.requiredDailyGrowthRate;
    const recommendedDailyStakePct = adaptiveMission.recommendedStakePct;
    const missionStake = adaptiveMission.missionStake;
    const requiredProfitToday = adaptiveMission.plannedProfit;
    const theoreticalRequiredProfitToday = adaptiveMission.requiredProfit;
    const requiredReturnOnStakePct = adaptiveMission.requiredReturnOnStakePct;
    const practicalReturnOnStakePct = adaptiveMission.plannedReturnOnStakePct;
    const missionPressureGap = adaptiveMission.pressureGap;
    const oddsRange = getOddsRange(requiredReturnOnStakePct);
    const oddsExecutionOptions = getOddsExecutionOptions(requiredReturnOnStakePct);
    const missionTone = getMissionTone(requiredReturnOnStakePct);
    const exposurePctOfMission = missionStake > 0 ? (openExposure / missionStake) * 100 : 0;
    const remainingMissionCapacity = Math.max(0, missionStake - openExposure);
    const allRadarOpportunities = buildRadarOpportunities(analyses);
    const todayRadarOpportunities = allRadarOpportunities.filter(
      (opportunity) => getDateKeyInTimezone(opportunity.createdAt) === today
    );
    const latestRadarDate =
      allRadarOpportunities
        .map((opportunity) => getDateKeyInTimezone(opportunity.createdAt))
        .sort((a, b) => b.localeCompare(a))[0] ?? today;
    const latestRadarOpportunities = allRadarOpportunities.filter(
      (opportunity) => getDateKeyInTimezone(opportunity.createdAt) === latestRadarDate
    );
    const todayHighProbabilityCount = todayRadarOpportunities.filter(
      (opportunity) =>
        Number.isFinite(opportunity.odds) &&
        opportunity.odds > 1 &&
        normalizeProbabilityPct(opportunity.modelProb) > ROADMAP_RADAR_MIN_MODEL_PROB
    ).length;
    const radarExecutionSourceDate =
      todayHighProbabilityCount > 0 ? today : latestRadarDate;
    const radarExecutionPlan = getRadarExecutionPlan({
      opportunities:
        todayHighProbabilityCount > 0 ? todayRadarOpportunities : latestRadarOpportunities,
      stakeBudget: remainingMissionCapacity,
      profitTarget: requiredProfitToday,
    });
    const missionProgressPct = missionStake > 0 ? (todayActualEntry.actualStake / missionStake) * 100 : 0;
    const profitProgressPct = requiredProfitToday > 0 ? (todayActualEntry.actualProfit / requiredProfitToday) * 100 : 0;
    const healthyDailyGrowthRate = (recommendedDailyStakePct / 100) * (HEALTHY_RETURN_ON_STAKE_PCT / 100);
    const healthyProjection =
      availableBankroll > 0 ? availableBankroll * Math.pow(1 + healthyDailyGrowthRate, remainingDays) : 0;
    const targetRealism = getTargetRealism(requiredReturnOnStakePct);
    const executionMode = getExecutionMode(
      requiredReturnOnStakePct,
      exposurePctOfMission,
      targetRealism
    );
    const bestZone = getBestPerformingZone();
    const multipleSummary = getMultiplePerformanceSummary();
    const favoredMarket =
      bestZone.bestMarket && bestZone.bestMarket.roi > 0 ? bestZone.bestMarket : null;
    const favoredEdgeZone =
      bestZone.bestEdgeBucket && bestZone.bestEdgeBucket.roi > 0
        ? bestZone.bestEdgeBucket
        : null;
    const favoredConfidenceZone =
      bestZone.bestConfidenceBucket && bestZone.bestConfidenceBucket.roi > 0
        ? bestZone.bestConfidenceBucket
        : null;
    const multipleStance =
      multipleSummary.settledMultiples >= 3
        ? multipleSummary.roi > 0
          ? {
              label: "Multiples Supportive",
              tone: "positive" as const,
              detail: `${formatPct(multipleSummary.roi)} ROI across ${multipleSummary.settledMultiples} settled multiples.`,
            }
          : {
              label: "Multiples Dragging",
              tone: "negative" as const,
              detail: `${formatPct(multipleSummary.roi)} ROI across ${multipleSummary.settledMultiples} settled multiples.`,
            }
        : {
            label: "Multiples Under Sample",
            tone: "neutral" as const,
            detail: `${multipleSummary.settledMultiples} settled multiples tracked so far.`,
          };
    const missionIntelligenceSummary = favoredMarket
      ? `${favoredMarket.market} is the strongest settled market, so today's mission should lean there when the board allows it.`
      : "There is not enough settled market data yet to lean into one clear profile.";
    const missionIntelligenceNote =
      favoredConfidenceZone && favoredEdgeZone
        ? `Best validation sits in confidence ${favoredConfidenceZone.bucket} and edge ${favoredEdgeZone.bucket}.`
        : favoredConfidenceZone
        ? `Best validation sits in confidence ${favoredConfidenceZone.bucket}.`
        : favoredEdgeZone
        ? `Best validation sits in edge ${favoredEdgeZone.bucket}.`
        : "Confidence and edge still need more validation.";
    const missionStatus =
      openExposure >= missionStake && missionStake > 0
        ? "Overexposed"
        : requiredReturnOnStakePct > 22
        ? "Stretch"
        : profitProgressPct >= 100
        ? "On Track"
        : missionProgressPct >= 100 && profitProgressPct < 100
        ? "Watch"
        : "Active";
    const alert =
      availableBankroll <= 0
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
        : missionProgressPct >= 100 && profitProgressPct < 100
        ? {
            tone: "negative" as const,
            title: "Mission used, return still short",
            body: "The daily stake budget is already consumed but the required profit has not yet been reached. Do not force extra volume.",
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

    const intelligenceActions = [
      favoredMarket
        ? `Favor ${favoredMarket.market} when the board quality is there; it is validating at ${formatPct(favoredMarket.roi)} ROI across ${favoredMarket.bets} settled bets.`
        : null,
      favoredConfidenceZone
        ? `Trust the ${favoredConfidenceZone.bucket} confidence zone more than weaker buckets; it is your best settled confidence cluster so far.`
        : null,
      favoredEdgeZone
        ? `Prefer setups landing in edge bucket ${favoredEdgeZone.bucket}; that zone is validating best in settled results.`
        : null,
      multipleSummary.settledMultiples >= 3 && multipleSummary.roi < 0
        ? "Keep the roadmap single-led for now; multiples are still dragging the execution profile."
        : multipleSummary.settledMultiples >= 3 && multipleSummary.roi > 0
        ? "Multiples can assist selectively, but only after the single-led mission is already clean."
        : null,
    ].filter(Boolean) as string[];

    const nextActions =
      availableBankroll <= 0
        ? [
            "Define a bankroll baseline first.",
            "Pause execution until the capital base is stable.",
            "Restart the roadmap after the reset.",
          ]
        : openExposure >= missionStake && missionStake > 0
        ? [
            "Do not add more bets today.",
            "Let current exposure resolve before deploying more capital.",
            "Reassess tomorrow's mission after settlement.",
          ]
        : missionProgressPct >= 100 && profitProgressPct < 100
        ? [
            "Do not chase low-edge bets to rescue the day.",
            "Accept that today may close below plan if quality is not there.",
            "Let the system recalibrate tomorrow.",
          ]
        : requiredReturnOnStakePct > 22
        ? [
            ...intelligenceActions,
            "Work only premium-quality spots inside the suggested odds zone.",
            `If you want lower variance, use structures like ${oddsExecutionOptions[0].toLowerCase()}.`,
            `Execution mode today: ${executionMode.mode}.`,
            "Extend the deadline if you want cleaner execution.",
            "Avoid using multiples to artificially accelerate the path.",
          ]
        : [
            ...intelligenceActions,
            `Keep total risk near ${formatCurrency(missionStake)} today.`,
            `Prefer selections in the ${oddsRange} odds zone.`,
            `Safer structures today: ${oddsExecutionOptions.slice(0, 2).join(" or ")}.`,
            `Execution mode today: ${executionMode.mode}.`,
            `Stop adding bets when open exposure reaches ${formatCurrency(missionStake)}.`,
          ].slice(0, 5);

    const path = Array.from({ length: remainingDays }, (_, index) => {
      const day = index + 1;
      return {
        day: `D${day}`,
        targetPath: Number((availableBankroll * Math.pow(1 + requiredDailyGrowthRate, day)).toFixed(2)),
        healthyPath: Number((availableBankroll * Math.pow(1 + healthyDailyGrowthRate, day)).toFixed(2)),
      };
    });

    let rollingBankroll = startingBankroll;

    const logWithTargets = dailyLog.map((entry, index) => {
      const daysRemainingIncludingThis = Math.max(1, targetDays - index);
      const dayMission = getAdaptiveMission(
        rollingBankroll,
        targetAmount,
        daysRemainingIncludingThis
      );
      const targetStake = dayMission.missionStake;
      const targetProfit = dayMission.requiredProfit;
      const status =
        entry.actualProfit >= targetProfit && targetProfit > 0
          ? "Completed"
          : entry.actualStake >= targetStake && entry.actualProfit < targetProfit
          ? "Used"
          : entry.tickets > 0
          ? "In Play"
          : index + 1 < currentPlanDay
          ? "Quiet"
          : "Pending";

      const classification = classifyRoadmapDay(
        targetStake,
        entry.actualStake,
        targetProfit,
        entry.actualProfit
      );

      const row = { ...entry, targetStake, targetProfit, status, classification };
      const realizedOrProjectedProfit = index + 1 < currentPlanDay ? entry.actualProfit : targetProfit;
      rollingBankroll += realizedOrProjectedProfit;
      return row;
    });

    const todayLog =
      logWithTargets[Math.min(elapsedDays, logWithTargets.length - 1)] ?? {
        day: 1,
        date: today,
        actualStake: 0,
        actualProfit: 0,
        tickets: 0,
        activeTickets: 0,
        settledBets: 0,
        targetStake: missionStake,
        targetProfit: requiredProfitToday,
        status: "Pending",
        classification: "quiet" as const,
      };
    const todayMissionCompletionPct = Math.max(
      0,
      Math.min(100, Math.max(missionProgressPct, profitProgressPct))
    );
    const todayMissionVisual =
      todayLog.status === "Completed" || profitProgressPct >= 100
        ? {
            label: "Completed",
            tone: "positive" as const,
            description: "Today's mission is on target and the daily profit objective has been reached.",
          }
        : missionStatus === "Overexposed"
        ? {
            label: "Cap Reached",
            tone: "negative" as const,
            description: "The daily stake budget is already used, so the mission should now be protected rather than expanded.",
          }
        : missionStatus === "Watch"
        ? {
            label: "In Play",
            tone: "neutral" as const,
            description: "The mission has deployment, but the profit target still needs settlement support to complete cleanly.",
          }
        : {
            label: "Building",
            tone: "neutral" as const,
            description: "The mission is still progressing and the roadmap is tracking execution against today's plan.",
          };
    const recentExecutionMemories = [...logWithTargets]
      .filter((entry) => entry.day < currentPlanDay)
      .slice(-7);
    const disciplineProfile = getDisciplineProfile(recentExecutionMemories);
    const systemCommand = getSystemCommand({
      availableBankroll,
      targetGap,
      openExposure,
      missionStake,
      missionStatus,
      targetRealism,
      remainingMissionCapacity,
    });

    const tomorrowStakePct =
      missionStatus === "Overexposed" || missionStatus === "Stretch"
        ? Math.max(MIN_DAILY_STAKE_PCT, recommendedDailyStakePct - 2)
        : missionStatus === "On Track"
        ? Math.max(MIN_DAILY_STAKE_PCT, recommendedDailyStakePct - 0.5)
        : recommendedDailyStakePct;
    const tomorrowStakeAmount = availableBankroll * (tomorrowStakePct / 100);
    const tomorrowMission = getAdaptiveMission(
      availableBankroll,
      targetAmount,
      Math.max(1, remainingDays - 1)
    );
    const tomorrowTargetProfit = tomorrowMission.plannedProfit;
    const suggestedExtraDays =
      targetRealism === "Unrealistic" ? Math.ceil(requiredReturnOnStakePct / 6) : 0;

    return {
      currentBankroll: availableBankroll,
      availableBankroll,
      startingBankroll,
      missionCapital,
      targetAmount,
      targetGap,
      availableTargetGap,
      missionProgressToTargetPct,
      bankrollProgressToTargetPct,
      remainingDays,
      currentPlanDay,
      requiredDailyGrowthRate,
      recommendedDailyStakePct,
      missionStake,
      requiredProfitToday,
      theoreticalRequiredProfitToday,
      missionPressureGap,
      practicalReturnOnStakePct,
      requiredReturnOnStakePct,
      openExposure,
      exposurePctOfMission,
      remainingMissionCapacity,
      healthyProjection,
      oddsRange,
      oddsExecutionOptions,
      radarExecutionPlan,
      radarExecutionSourceDate,
      isRadarExecutionFromToday: radarExecutionSourceDate === today,
      executionMode,
      missionIntelligenceSummary,
      missionIntelligenceNote,
      favoredMarket,
      favoredEdgeZone,
      favoredConfidenceZone,
      multipleStance,
      missionTone,
      targetRealism,
      missionStatus,
      todayMissionCompletionPct,
      todayMissionVisual,
      disciplineProfile,
      systemCommand,
      alert,
      todayLog,
      missionProgressPct,
      profitProgressPct,
      nextActions,
      tomorrowStakePct,
      tomorrowStakeAmount,
      tomorrowTargetProfit,
      suggestedExtraDays,
      dailyLog: logWithTargets,
      path,
    };
  }, [analyses, dayMemories, effectiveStartedAt, multiples, parsedInputs, stats]);

  useEffect(() => {
    syncRoadmapDayMemories(roadmap.dailyLog);
    setDayMemories(getRoadmapDayMemories());
  }, [roadmap.dailyLog]);

  const visibleLog = useMemo(() => {
    if (showFullDailyLog || roadmap.dailyLog.length <= 5) return roadmap.dailyLog;

    const currentIndex = Math.max(
      0,
      roadmap.dailyLog.findIndex((entry) => entry.day === roadmap.currentPlanDay)
    );
    const startIndex = Math.min(
      Math.max(0, currentIndex - 2),
      Math.max(0, roadmap.dailyLog.length - 5)
    );

    return roadmap.dailyLog.slice(startIndex, startIndex + 5);
  }, [roadmap.currentPlanDay, roadmap.dailyLog, showFullDailyLog]);
  const hiddenDailyLogRows = Math.max(0, roadmap.dailyLog.length - visibleLog.length);
  const roadmapPulseTone =
    roadmap.systemCommand.tone === "negative"
      ? "red"
      : roadmap.systemCommand.tone === "positive"
      ? "emerald"
      : roadmap.targetRealism === "Demanding"
      ? "amber"
      : "cyan";

  const missionTracker = useMemo(() => {
    const missionState =
      roadmap.missionProgressToTargetPct >= 100
        ? {
            label: "Completed",
            tone: "positive" as const,
            description: "The roadmap target has been reached.",
          }
        : roadmap.currentPlanDay >= parsedInputs.targetDays && roadmap.missionProgressToTargetPct < 100
        ? {
            label: "Behind Target",
            tone: "negative" as const,
            description: "Time is nearly gone and the target gap is still meaningful.",
          }
        : {
            label: "In Progress",
            tone: "neutral" as const,
            description: "The mission is live and moving toward the target.",
          };

    return {
      state: missionState,
      completionRate: roadmap.missionProgressToTargetPct,
      completedCheckpoints: roadmap.dailyLog.filter((entry) => entry.status === "Completed").length,
      remainingCheckpoints: roadmap.dailyLog.filter((entry) => entry.day >= roadmap.currentPlanDay).length,
    };
  }, [parsedInputs.targetDays, roadmap.currentPlanDay, roadmap.dailyLog, roadmap.missionProgressToTargetPct]);

  const handleSavePlan = () => {
    const nextSettings: RoadmapSettings = {
      targetAmount: parsedInputs.targetAmount,
      targetDays: parsedInputs.targetDays,
      startedAt: effectiveStartedAt || getDateKeyInTimezone(new Date()),
    };
    saveRoadmapSettings(nextSettings);
    setSettings(nextSettings);
    setSavedMessage("Roadmap saved successfully.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  };

  const archiveCurrentMission = (status: RoadmapMissionRecord["status"]) => {
    const mission: RoadmapMissionRecord = {
      id: createRoadmapMissionId(),
      targetAmount: roadmap.targetAmount,
      targetDays: parsedInputs.targetDays,
      startedAt: effectiveStartedAt || getDateKeyInTimezone(new Date()),
      endedAt: new Date().toISOString(),
      status,
      startingBankroll: roadmap.startingBankroll,
      finalBankroll: roadmap.availableBankroll,
      progressPct: roadmap.missionProgressToTargetPct,
      netProfit: roadmap.availableBankroll - roadmap.startingBankroll,
    };

    saveRoadmapMission(mission);
    setMissionHistory(getRoadmapMissions());
    setSavedMessage(status === "success" ? "Mission saved as successful." : "Mission saved as failed.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleStartNewMission = () => {
    const currentStatus: RoadmapMissionRecord["status"] =
      roadmap.missionProgressToTargetPct >= 100 ? "success" : "failed";
    archiveCurrentMission(currentStatus);

    const nextSettings: RoadmapSettings = {
      targetAmount: parsedInputs.targetAmount,
      targetDays: parsedInputs.targetDays,
      startedAt: new Date().toISOString(),
    };

    saveRoadmapSettings(nextSettings);
    overwriteRoadmapDayMemories([]);
    setSettings(nextSettings);
    setDayMemories([]);
    setMissionHistory(getRoadmapMissions());
    setSavedMessage("New mission started.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleDeleteMission = (missionId: string) => {
    deleteRoadmapMission(missionId);
    setMissionHistory(getRoadmapMissions());
    setSavedMessage("Mission deleted.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleOpenRadarPick = (pick: {
    id: string;
    market: string;
    odds: number;
    suggestedStake: number;
  }) => {
    const params = new URLSearchParams({
      analysisId: pick.id,
      prepareBet: "1",
      market: pick.market,
      stake: String(pick.suggestedStake),
      odd: String(pick.odds),
    });

    navigate(`/history?${params.toString()}`);
  };

  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-8 p-6">
        <MatchdayHero
          eyebrow="Mission Control"
          tone={roadmap.systemCommand.tone === "negative" ? "red" : roadmap.systemCommand.tone === "positive" ? "emerald" : "cyan"}
          statusIcon={<HudStateIcon state={roadmap.systemCommand.tone === "negative" ? "risk" : roadmap.systemCommand.tone === "positive" ? "execution" : "scanning"} />}
          title={
            <>
              <span className="text-white">Intelligent </span>
              <span className="bg-[linear-gradient(90deg,rgba(103,232,249,0.98)_0%,rgba(52,211,153,0.98)_100%)] bg-clip-text text-transparent">
                Roadmap
              </span>
            </>
          }
          description="Know the target, the stake, and the next move."
          statusItems={
            <>
              <HudStatusPill
                label={roadmap.systemCommand.label}
                tone={roadmap.systemCommand.tone === "negative" ? "red" : roadmap.systemCommand.tone === "positive" ? "emerald" : "cyan"}
                icon={<HudStateIcon state={roadmap.systemCommand.tone === "negative" ? "risk" : "execution"} />}
              />
              <HudStatusPill
                label={roadmap.targetRealism}
                tone={roadmap.targetRealism === "Demanding" ? "amber" : roadmap.targetRealism === "Unrealistic" ? "red" : "cyan"}
                icon={<HudStateIcon state="scanning" />}
                pulse={roadmap.targetRealism !== "Realistic"}
              />
              <HudStatusPill label={`Day ${roadmap.currentPlanDay}`} tone="cyan" pulse={false} />
            </>
          }
          visual={
            <SystemPulse3D
              label="Mission Pulse"
              value={`${roadmap.bankrollProgressToTargetPct.toFixed(0)}%`}
              detail={`${formatCurrency(roadmap.availableTargetGap)} left from free bankroll to target.`}
              tone={roadmapPulseTone}
            />
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Free Bankroll"
            value={formatCurrency(roadmap.availableBankroll)}
            change={`${formatCurrency(roadmap.openExposure)} still open`}
          />
          <MetricCard
            label="Target Gap"
            value={formatCurrency(roadmap.availableTargetGap)}
            change={`${formatPct(roadmap.bankrollProgressToTargetPct)} reached from free bankroll`}
            tone={roadmap.availableTargetGap <= 0 ? "positive" : "neutral"}
          />
          <MetricCard
            label="Plan Day"
            value={`${roadmap.currentPlanDay}/${parsedInputs.targetDays}`}
            change={`${roadmap.remainingDays} days remaining`}
          />
          <MetricCard
            label="Profit Target"
            value={formatCurrency(roadmap.requiredProfitToday)}
            change={`${formatCurrency(roadmap.missionStake)} planned stake · ${roadmap.oddsRange}`}
            tone={roadmap.targetRealism === "Realistic" ? "positive" : roadmap.targetRealism === "Demanding" ? "neutral" : "negative"}
          />
        </div>

        <div className="space-y-6">
          <PremiumCard
            title="Mission Control"
            description="Manage the active mission and keep a record of completed plans."
            badge="Control"
          >
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className={compactSurfaceCardClass}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/40">
                  Active Mission
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {formatCurrency(roadmap.startingBankroll)} to {formatCurrency(roadmap.targetAmount)}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/46">
                  Day {roadmap.currentPlanDay} of {parsedInputs.targetDays} · started {effectiveStartedAt}
                </p>
              </div>
              <div className={compactSurfaceCardClass}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/40">
                  Mission Status
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {missionTracker.state.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-white/46">
                  {formatPct(missionTracker.completionRate)} complete
                </p>
              </div>
              <div className={compactSurfaceCardClass}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/40">
                  Mission History
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {missionHistory.length} saved
                </p>
                <p className="mt-2 text-xs leading-5 text-white/46">
                  {missionHistory.filter((mission) => mission.status === "success").length} successful · {missionHistory.filter((mission) => mission.status === "failed").length} failed
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InputField
                label="Target Amount"
                value={inputs.targetAmount}
                suffix="EUR"
                onChange={(value) =>
                  setInputs((prev) => ({ ...prev, targetAmount: value }))
                }
              />
              <InputField
                label="Target Days"
                value={inputs.targetDays}
                suffix="days"
                onChange={(value) =>
                  setInputs((prev) => ({ ...prev, targetDays: value }))
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSavePlan}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition hover:bg-emerald-400/15"
              >
                Save Active Mission
              </button>
              <button
                type="button"
                onClick={() => archiveCurrentMission("success")}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-100 transition hover:bg-cyan-400/15"
              >
                Close As Success
              </button>
              <button
                type="button"
                onClick={() => archiveCurrentMission("failed")}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-red-200 transition hover:bg-red-400/15"
              >
                Close As Failed
              </button>
              <button
                type="button"
                onClick={handleStartNewMission}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/78 transition hover:bg-white/[0.1]"
              >
                Start New Mission
              </button>
              <button
                type="button"
                onClick={() =>
                  setInputs({
                    targetAmount: String(DEFAULT_ROADMAP_SETTINGS.targetAmount),
                    targetDays: String(DEFAULT_ROADMAP_SETTINGS.targetDays),
                  })
                }
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/[0.08]"
              >
                Reset Inputs
              </button>
              {savedMessage ? (
                <span className="text-sm text-emerald-300">{savedMessage}</span>
              ) : null}
            </div>

            <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-white/42">
              Mission started on {effectiveStartedAt}.
            </p>

            <div className="mt-4 rounded-[22px] border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                  Recent Missions
                </p>
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/34">
                  Last {Math.min(3, missionHistory.length)}
                </p>
              </div>
              {missionHistory.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-white/52">
                  No closed missions yet. When a plan ends, close it as success or failed and it will appear here.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {missionHistory.slice(0, 3).map((mission) => (
                    <div
                      key={mission.id}
                      className="grid grid-cols-1 gap-2 rounded-2xl border border-white/8 bg-white/[0.035] p-3 md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {formatCurrency(mission.startingBankroll)} to {formatCurrency(mission.targetAmount)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/46">
                          {getIsoDateOnly(mission.startedAt)} to {getIsoDateOnly(mission.endedAt)} · {formatPct(mission.progressPct)} complete
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            mission.status === "success"
                              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                              : "border-red-300/25 bg-red-300/10 text-red-200"
                          }`}
                        >
                          {mission.status}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteMission(mission.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/54 transition hover:border-red-300/20 hover:bg-red-400/10 hover:text-red-200"
                          aria-label="Delete mission"
                          title="Delete mission"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PremiumCard>

          <PremiumCard
            title="Today's Orders"
            description="Today's stake plan, profit target, and execution range."
            badge="Orders"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className={surfaceCardClass}>
                <div className="flex items-center gap-2 text-emerald-200">
                  <Wallet className="h-4 w-4" strokeWidth={1.6} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                    Planned Stake
                  </p>
                </div>
                <p className="mt-3 text-[1.18rem] font-semibold tracking-[-0.02em] text-white md:text-[1.28rem]">
                  {formatCurrency(roadmap.missionStake)}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/56">
                  Up to {formatPct(roadmap.recommendedDailyStakePct)} of free bankroll.
                </p>
              </div>

              <div className={surfaceCardClass}>
                <div className="flex items-center gap-2 text-cyan-200">
                  <TrendingUp className="h-4 w-4" strokeWidth={1.6} />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                    Profit Target
                  </p>
                </div>
                <p className="mt-3 text-[1.18rem] font-semibold tracking-[-0.02em] text-white md:text-[1.28rem]">
                  {formatCurrency(roadmap.requiredProfitToday)}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/56">
                  Needs about {formatPct(roadmap.practicalReturnOnStakePct)} return on planned stake.
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-[22px] border border-emerald-300/12 bg-emerald-300/[0.055] p-4 shadow-[0_10px_24px_rgba(0,0,0,0.14)] backdrop-blur-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/48">
                    Radar Execution
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/62">
                    Highest-probability radar events above {ROADMAP_RADAR_MIN_MODEL_PROB}% and the stake each one needs to hit the daily profit target.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/40">
                    {roadmap.isRadarExecutionFromToday
                      ? "Using today's radar board."
                      : `Using latest available radar board from ${roadmap.radarExecutionSourceDate}.`}
                  </p>
                </div>
                <div
                  className={`rounded-2xl border px-3 py-2 text-right ${
                    roadmap.radarExecutionPlan.fullyCovered
                      ? "border-emerald-300/20 bg-emerald-300/10"
                      : "border-amber-300/20 bg-amber-300/10"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                    Fit
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {roadmap.radarExecutionPlan.fullyCovered ? "Ready" : "Short"}
                  </p>
                </div>
              </div>

              {roadmap.radarExecutionPlan.picks.length > 0 ? (
                <div className="mt-4 space-y-2.5">
                  {roadmap.radarExecutionPlan.picks.map((pick, index) => (
                    <button
                      type="button"
                      key={`${pick.id}-${pick.market}`}
                      onClick={() => handleOpenRadarPick(pick)}
                      className="grid w-full grid-cols-1 gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-left transition hover:border-emerald-300/25 hover:bg-emerald-300/[0.06] md:grid-cols-[1fr_auto]"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">
                            {index + 1}. {pick.match}
                          </p>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${
                              pick.guardrail.tone === "positive"
                                ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
                                : pick.guardrail.tone === "negative"
                                ? "border-red-300/25 bg-red-300/10 text-red-200"
                                : "border-amber-300/25 bg-amber-300/10 text-amber-200"
                            }`}
                          >
                            {pick.guardrail.label}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-white/52">
                          {pick.market} · model {formatPct(normalizeProbabilityPct(pick.modelProb))} · odds {pick.odds.toFixed(2)} · {pick.decision}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-white/38">
                          {pick.guardrail.reason}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 md:justify-end">
                        <div
                          className={`rounded-xl border px-3 py-2 ${
                            pick.fitsCapacity
                              ? "border-emerald-300/20 bg-emerald-300/10"
                              : "border-amber-300/20 bg-amber-300/10"
                          }`}
                        >
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
                            Required Stake
                          </p>
                          <p className="mt-1 text-sm font-semibold text-white">
                            {formatCurrency(pick.suggestedStake)}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                          <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
                            Profit
                          </p>
                          <p className="mt-1 text-sm font-semibold text-emerald-200">
                            {formatCurrency(pick.projectedProfit)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  <p className="text-xs leading-5 text-white/42">
                    Green highlight means the required stake fits inside today's remaining planned stake.
                  </p>
                  {!roadmap.radarExecutionPlan.fullyCovered ? (
                    <p className="text-xs leading-5 text-amber-200/72">
                      None of the highest-probability radar events can hit today's profit target inside the remaining stake capacity.
                    </p>
                  ) : null}
                  {roadmap.radarExecutionPlan.picks.every(
                    (pick) => pick.guardrail.label !== "Clean"
                  ) ? (
                    <p className="text-xs leading-5 text-red-200/72">
                      No clean execution is available. The roadmap is showing the board, but not giving a strong entry signal.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 rounded-2xl border border-white/8 bg-white/[0.035] p-3 text-sm leading-6 text-white/54">
                  No radar events above {ROADMAP_RADAR_MIN_MODEL_PROB}% are available in the latest board. Keep the plan on hold instead of forcing lower-probability picks.
                </p>
              )}
            </div>
          </PremiumCard>
        </div>

          <PremiumCard
            title="Mission Tracker"
            description="Mission status."
            badge="Progress"
          >
          <div
            className={`rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(0,0,0,0.14)] ${
              missionTracker.state.tone === "positive"
                ? "border-emerald-400/20 bg-emerald-400/10"
                : missionTracker.state.tone === "negative"
                ? "border-red-400/20 bg-red-400/10"
                : "border-cyan-400/20 bg-cyan-400/10"
            }`}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${
                    missionTracker.state.tone === "positive"
                      ? "bg-emerald-400/15 text-emerald-200"
                      : missionTracker.state.tone === "negative"
                      ? "bg-red-400/15 text-red-200"
                      : "bg-cyan-400/15 text-cyan-200"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    Primary Mission
                  </p>
                  <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-white">
                    {missionTracker.state.label}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                    {missionTracker.state.description}
                  </p>
                </div>
              </div>

              <div className="min-w-[180px]">
                <AnalyticOrb
                  label="Mission"
                  value={missionTracker.completionRate}
                  tone={
                    missionTracker.state.tone === "positive"
                      ? "emerald"
                      : missionTracker.state.tone === "negative"
                      ? "red"
                      : "cyan"
                  }
                  detail="completion"
                />
              </div>
            </div>
          </div>

          <div
            className={`mt-4 rounded-[24px] border p-4 shadow-[0_10px_24px_rgba(0,0,0,0.14)] ${
              roadmap.systemCommand.tone === "positive"
                ? "border-emerald-400/20 bg-emerald-400/10"
                : roadmap.systemCommand.tone === "negative"
                ? "border-red-400/20 bg-red-400/10"
                : "border-cyan-400/20 bg-cyan-400/10"
            }`}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/48">
                  System Command
                </p>
                <h3 className="mt-1 text-base font-semibold tracking-[-0.02em] text-white">
                  {roadmap.systemCommand.label}
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
                  {roadmap.systemCommand.body}
                </p>
              </div>

              <div
                className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  roadmap.systemCommand.tone === "positive"
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                    : roadmap.systemCommand.tone === "negative"
                    ? "border-red-300/30 bg-red-300/10 text-red-200"
                    : "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                }`}
              >
                {roadmap.systemCommand.tone === "positive"
                  ? "Go"
                  : roadmap.systemCommand.tone === "negative"
                  ? "Protect"
                  : "Hold"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Target Gap"
              value={formatCurrency(roadmap.availableTargetGap)}
              change={`${formatCurrency(roadmap.targetGap)} incl. mission capital`}
              tone={roadmap.availableTargetGap <= 0 ? "positive" : "neutral"}
            />
            <MetricCard
              label="Discipline Score"
              value={formatPct(roadmap.disciplineProfile.score)}
              change={`${roadmap.disciplineProfile.label} · ${roadmap.disciplineProfile.note}`}
              tone={
                roadmap.disciplineProfile.score >= 70
                  ? "positive"
                  : roadmap.disciplineProfile.score < 50
                  ? "negative"
                  : "neutral"
              }
            />
            <MetricCard
              label="Open Exposure"
              value={formatCurrency(roadmap.openExposure)}
              change={`${formatPct(Math.min(999, roadmap.exposurePctOfMission))} of today's cap`}
              tone={roadmap.missionStatus === "Overexposed" ? "negative" : "neutral"}
            />
          </div>
          <div className="mt-4">
            <RiskBar
              label="Daily Risk Load"
              value={roadmap.exposurePctOfMission}
              maxLabel="Daily Cap"
            />
          </div>
        </PremiumCard>

        <div className="space-y-6">
          <PremiumCard title="Recalibrated Plan" description="Adjust the plan from today's bankroll state." badge="Adaptive">
            <div className="space-y-4">
              <div className={surfaceCardClass}>
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-emerald-200" strokeWidth={1.6} />
                  <p className="text-sm font-medium tracking-[-0.01em] text-white">Target pressure</p>
                </div>
                <p className="mt-3 text-sm leading-7 text-white/60">
                  To move from {formatCurrency(roadmap.availableBankroll)} to {formatCurrency(roadmap.targetAmount)} in {roadmap.remainingDays} days, the plan needs about {formatPct(roadmap.requiredDailyGrowthRate * 100)} growth per day.
                </p>
                <p className="mt-3 text-xs leading-6 text-white/44">
                  Open exposure is separate at {formatCurrency(roadmap.openExposure)}.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Best Market"
                  value={roadmap.favoredMarket?.market ?? "Still forming"}
                  change={
                    roadmap.favoredMarket
                      ? `${formatPct(roadmap.favoredMarket.roi)} ROI · ${roadmap.favoredMarket.bets} bets`
                      : "Need more settled market data"
                  }
                  tone={roadmap.favoredMarket ? "positive" : "neutral"}
                />
                <MetricCard
                  label="Confidence Lead"
                  value={roadmap.favoredConfidenceZone?.bucket ?? "Under sample"}
                  change={
                    roadmap.favoredConfidenceZone
                      ? `${formatPct(roadmap.favoredConfidenceZone.roi)} ROI · ${roadmap.favoredConfidenceZone.bets} bets`
                      : "No validated confidence lead yet"
                  }
                  tone={roadmap.favoredConfidenceZone ? "positive" : "neutral"}
                />
                <MetricCard
                  label="Edge Lead"
                  value={roadmap.favoredEdgeZone?.bucket ?? "Under sample"}
                  change={
                    roadmap.favoredEdgeZone
                      ? `${formatPct(roadmap.favoredEdgeZone.roi)} ROI · ${roadmap.favoredEdgeZone.bets} bets`
                      : "No validated edge lead yet"
                  }
                  tone={roadmap.favoredEdgeZone ? "positive" : "neutral"}
                />
                <MetricCard
                  label="Multiple Stance"
                  value={roadmap.multipleStance.label}
                  change={roadmap.multipleStance.detail}
                  tone={roadmap.multipleStance.tone}
                />
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.05fr_0.95fr]">
                <div className={surfaceCardClass}>
                  <div className="flex items-center gap-2">
                    <Goal className="h-4 w-4 text-emerald-200" strokeWidth={1.6} />
                    <p className="text-sm font-medium tracking-[-0.01em] text-white">Mission bias</p>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-white/64">
                    {roadmap.missionIntelligenceSummary}
                  </p>
                  <p className="mt-3 text-xs leading-6 text-white/44">
                    {roadmap.missionIntelligenceNote}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className={surfaceCardClass}>
                    <div className="flex items-center gap-2">
                      <Route className="h-4 w-4 text-cyan-200" strokeWidth={1.6} />
                      <p className="text-sm font-medium tracking-[-0.01em] text-white">Essential actions</p>
                    </div>
                    <div className="mt-3 space-y-2.5 text-sm leading-7 text-white/60">
                      {roadmap.nextActions.slice(0, 3).map((action, index) => (
                        <p key={action}>
                          <span className="mr-2 text-white/38">{index + 1}.</span>
                          {action}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className={surfaceCardClass}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/40">Tomorrow's mission</p>
                    <p className="mt-3 text-[1.22rem] font-semibold tracking-[-0.03em] text-white">{formatCurrency(roadmap.tomorrowStakeAmount)}</p>
                    <p className="mt-3 text-sm leading-7 text-white/60">
                      About {formatPct(roadmap.tomorrowStakePct)} of bankroll for {formatCurrency(roadmap.tomorrowTargetProfit)} profit.
                    </p>
                    {roadmap.suggestedExtraDays > 0 ? (
                      <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-red-300">
                        Extend by about {roadmap.suggestedExtraDays} days.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

            </div>
          </PremiumCard>

          <PremiumCard title="Daily Log" description="Compact mission log. Showing the current mission window by default." badge="Log">
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100/42">
                  Mission Window
                </p>
                <p className="mt-1 text-sm text-white/62">
                  Showing {visibleLog.length} of {roadmap.dailyLog.length} days around plan day {roadmap.currentPlanDay}.
                </p>
              </div>
              {roadmap.dailyLog.length > 5 ? (
                <button
                  type="button"
                  onClick={() => setShowFullDailyLog((current) => !current)}
                  className="rounded-full border border-cyan-100/12 bg-cyan-100/[0.045] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-50/68 transition hover:border-cyan-100/22 hover:bg-cyan-100/[0.07]"
                >
                  {showFullDailyLog ? "Show 5 Lines" : `Show ${hiddenDailyLogRows} More`}
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="border-b border-white/5">
                  <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                    <th className="py-3 pr-4">Day</th>
                    <th className="py-3 pr-4">Target Stake</th>
                    <th className="py-3 pr-4">Placed Stake</th>
                    <th className="py-3 pr-4">Profit Target</th>
                    <th className="py-3 pr-4">Settled P/L</th>
                    <th className="py-3 pr-4">Settled Bets</th>
                    <th className="py-3 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLog.map((row) => (
                    <tr key={`${row.day}-${row.date}`} className="border-t border-white/5">
                      <td className="py-3 pr-4 font-medium text-white">D{row.day}</td>
                      <td className="py-3 pr-4 text-white">{formatCurrency(row.targetStake)}</td>
                      <td className="py-3 pr-4 text-white">{formatCurrency(row.actualStake)}</td>
                      <td className="py-3 pr-4 text-white">{formatCurrency(row.targetProfit)}</td>
                      <td className="py-3 pr-4 text-white">{formatCurrency(row.actualProfit)}</td>
                      <td className="py-3 pr-4 text-white">{row.settledBets}</td>
                      <td className="py-3 pr-4 text-white/70">{row.status}</td>
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




