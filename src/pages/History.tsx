import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { AITypewriter } from "@/components/AITypewriter";
import { buildApiUrl } from "@/lib/apiConfig";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ANALYSES_UPDATED_EVENT,
  addExtraTrackedBet,
  deleteExtraTrackedBet,
  getAnalyses,
  getAnalysisTrackingEntries,
  updateAnalysisTracking,
  updateTrackedBet,
  deleteAnalysis,
} from "@/lib/analysisStorage";
import {
  MULTIPLES_UPDATED_EVENT,
  addLegToMultipleDraft,
  createMultipleLeg,
  getMultipleDraft,
  getSavedMultiples,
} from "@/lib/multipleStorage";
import type { SavedAnalysis, BetStatus, TrackedAnalysisBet } from "@/types/analysis";
import { useSearchParams } from "react-router-dom";

interface HistoryAISummary {
  configured: boolean;
  summary: string;
  strengths: string[];
  risks: string[];
  next_actions: string[];
  disclaimer: string;
}

interface HistoryAISummaryPayload {
  visible_analyses: number;
  placed_bets: number;
  settled_bets: number;
  pending_bets: number;
  greens: number;
  reds: number;
  needs_update: number;
  avg_confidence: number;
  avg_edge: number;
  filter_summary: string;
  strongest_market: string | null;
  weakest_market: string | null;
  top_markets: Array<{
    market: string;
    bets: number;
    roi: number;
    hit_rate: number;
    profit_loss: number;
  }>;
  recent_matches: string[];
  multiple_draft_legs: number;
  pending_multiples: number;
  settled_multiples: number;
}

const darkSelectClass =
  "h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

const darkSelectStyle = {
  backgroundColor: "#0f172a",
  color: "white",
  colorScheme: "dark" as const,
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function getBestBet(results: SavedAnalysis["results"]) {
  if (!Array.isArray(results) || results.length === 0) return null;
  return results.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
}

function isToday(dateString: string) {
  const d = new Date(dateString);
  const now = new Date();

  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function isWithinLast7Days(dateString: string) {
  const d = new Date(dateString).getTime();
  const now = new Date().getTime();
  const diff = now - d;
  return diff <= 7 * 24 * 60 * 60 * 1000;
}

function isThisMonth(dateString: string) {
  const d = new Date(dateString);
  const now = new Date();

  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString();
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
      className="scorelab-stage-3d scorelab-board-3d relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="scorelab-depth-grid pointer-events-none absolute inset-x-8 bottom-0 h-24 opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">
            Simple Bet
          </p>
          <h2 className="mt-2 text-base font-semibold text-white md:text-lg">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-white/58">
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

function MetricBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="scorelab-board-3d scorelab-tilt-3d rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.025)_100%)] px-3.5 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
      <div className="mb-2 h-1.5 w-10 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9)_0%,rgba(34,197,94,0.8)_100%)]" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
        {label}
      </p>
      <div className="mt-1.5 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function InlineStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="scorelab-board-3d scorelab-tilt-3d rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function ActiveFilterPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "emerald" | "amber" | "red" | "cyan";
}) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "amber"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : tone === "red"
      ? "border-red-400/20 bg-red-400/10 text-red-200"
      : tone === "cyan"
      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
      : "border-white/10 bg-white/[0.04] text-white/65";

  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.04em] ${toneClasses}`}
    >
      {label}
    </span>
  );
}

function DetailSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scorelab-board-3d rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-white/50">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scorelab-board-3d rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
        {label}
      </label>
      {children}
    </div>
  );
}

function needsTrackedBetAttention(tracking: TrackedAnalysisBet) {
  if (!tracking.betPlaced) return false;
  if (!tracking.selectedMarket) return true;
  if (tracking.stakeUsed === null || tracking.stakeUsed <= 0) return true;
  if (tracking.oddUsed === null || tracking.oddUsed <= 1) return true;
  return false;
}

function getTrackedBetMissingFields(tracking: TrackedAnalysisBet) {
  const missing: string[] = [];

  if (!tracking.betPlaced) return missing;
  if (!tracking.selectedMarket) missing.push("market");
  if (tracking.stakeUsed === null || tracking.stakeUsed <= 0) missing.push("stake");
  if (tracking.oddUsed === null || tracking.oddUsed <= 1) missing.push("odd");
  if (!tracking.notes.trim()) missing.push("notes");

  return missing;
}

function buildHistoryFallbackSummary(
  payload: HistoryAISummaryPayload
): HistoryAISummary {
  const strengths: string[] = [];
  const risks: string[] = [];
  const nextActions: string[] = [];

  if (payload.strongest_market) {
    strengths.push(
      `${payload.strongest_market} is the strongest visible market inside the current history view.`
    );
  }

  if (payload.settled_bets > 0) {
    strengths.push(
      `This filtered history already contains ${payload.settled_bets} settled bets, so it can start validating real patterns.`
    );
  }

  if (payload.needs_update > 0) {
    risks.push(
      `${payload.needs_update} tracked bets still need cleanup, so the review is not fully clean yet.`
    );
  }

  if (payload.weakest_market) {
    risks.push(
      `${payload.weakest_market} is the weakest visible market right now, so it deserves more caution.`
    );
  }

  if (
    payload.pending_bets > payload.settled_bets &&
    payload.pending_bets > 0
  ) {
    risks.push(
      `There are more pending bets than settled ones in this view, so recent conclusions are still fragile.`
    );
  }

  if (payload.multiple_draft_legs > 0) {
    nextActions.push(
      `You already have ${payload.multiple_draft_legs} legs in the multiple builder, so compare them against the strongest history zones before saving.`
    );
  }

  nextActions.push(
    "Keep the tracking fields clean first so the history review reflects the real decision quality."
  );
  nextActions.push(
    "Use the strongest visible markets as the base for the next selections."
  );

  return {
    configured: false,
    summary: `This history view shows ${payload.visible_analyses} analyses, ${payload.placed_bets} tracked bets and ${payload.settled_bets} settled results, with ${payload.avg_confidence.toFixed(1)} average confidence and ${payload.avg_edge.toFixed(1)}% average edge.`,
    strengths: strengths.slice(0, 3),
    risks: risks.slice(0, 3),
    next_actions: nextActions.slice(0, 3),
    disclaimer:
      "This review interprets the visible history and tracking data. It supports review discipline, but it does not replace the betting model.",
  };
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
          <div
            key={`${title}-${index}`}
            className="flex items-start gap-2 text-sm leading-6"
          >
            <span className="mt-[2px] inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-current/20 text-[10px] font-semibold opacity-80">
              {index + 1}
            </span>
            <p className="text-current/90">
              <AITypewriter text={item} startDelay={startDelay + index * 220} />
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function History() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [multipleDraft, setMultipleDraft] = useState(getMultipleDraft());
  const [savedMultiples, setSavedMultiples] = useState<ReturnType<typeof getSavedMultiples>>([]);
  const [searchParams] = useSearchParams();
  const highlightedAnalysisId = searchParams.get("analysisId");
  const prepareBetFromRoadmap = searchParams.get("prepareBet") === "1";
  const preparedMarket = searchParams.get("market");
  const preparedStake = searchParams.get("stake");
  const preparedOdd = searchParams.get("odd");
  const analysisRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const preparedBetAppliedRef = useRef<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "green" | "red" | "void"
  >("all");
  const [betPlacedFilter, setBetPlacedFilter] = useState<
    "all" | "placed" | "not-placed"
  >("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<
    "all" | "today" | "last7" | "month"
  >("all");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "edge" | "confidence" | "profitLoss"
  >("newest");
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [aiSummary, setAiSummary] = useState<HistoryAISummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const hasLoadedAiReviewRef = useRef(false);

  const refreshAnalyses = () => {
    setAnalyses(getAnalyses());
  };

  useEffect(() => {
    refreshAnalyses();
    setMultipleDraft(getMultipleDraft());
    setSavedMultiples(getSavedMultiples());

    const handleAnalysesUpdated = () => refreshAnalyses();
    const handleMultiplesUpdated = () => {
      setMultipleDraft(getMultipleDraft());
      setSavedMultiples(getSavedMultiples());
    };

    window.addEventListener(ANALYSES_UPDATED_EVENT, handleAnalysesUpdated);
    window.addEventListener(MULTIPLES_UPDATED_EVENT, handleMultiplesUpdated);

    return () => {
      window.removeEventListener(ANALYSES_UPDATED_EVENT, handleAnalysesUpdated);
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, handleMultiplesUpdated);
    };
  }, []);

  const safeAnalyses = useMemo(() => {
    return analyses.filter(
      (analysis) =>
        analysis &&
        typeof analysis.id === "string" &&
        typeof analysis.homeTeam === "string" &&
        typeof analysis.awayTeam === "string" &&
        analysis.summary &&
        Array.isArray(analysis.results)
    );
  }, [analyses]);

  const availableMarkets = useMemo(() => {
    return Array.from(
      new Set(
        safeAnalyses
          .flatMap((analysis) =>
            getAnalysisTrackingEntries(analysis).map((entry) => entry.tracking.selectedMarket)
          )
          .filter(Boolean)
      )
    ) as string[];
  }, [safeAnalyses]);

  const filteredAnalyses = useMemo(() => {
    let items = [...safeAnalyses];

    items = items.filter((analysis) => {
      const match = `${analysis.homeTeam} vs ${analysis.awayTeam}`.toLowerCase();
      const trackedEntries = getAnalysisTrackingEntries(analysis);
      const trackedMarkets = trackedEntries
        .map((entry) => (entry.tracking.selectedMarket || "").toLowerCase())
        .filter(Boolean);
      const search = searchTerm.trim().toLowerCase();

      const matchesSearch =
        search === "" ||
        match.includes(search) ||
        analysis.homeTeam.toLowerCase().includes(search) ||
        analysis.awayTeam.toLowerCase().includes(search) ||
        trackedMarkets.some((market) => market.includes(search));

      if (!matchesSearch) return false;

      if (
        statusFilter !== "all" &&
        !trackedEntries.some((entry) => entry.tracking.resultStatus === statusFilter)
      ) {
        return false;
      }

      if (betPlacedFilter === "placed" && !trackedEntries.some((entry) => entry.tracking.betPlaced)) {
        return false;
      }

      if (
        betPlacedFilter === "not-placed" &&
        trackedEntries.some((entry) => entry.tracking.betPlaced)
      ) {
        return false;
      }

      if (
        marketFilter !== "all" &&
        !trackedEntries.some((entry) => entry.tracking.selectedMarket === marketFilter)
      ) {
        return false;
      }

      if (dateFilter === "today" && !isToday(analysis.createdAt)) {
        return false;
      }

      if (dateFilter === "last7" && !isWithinLast7Days(analysis.createdAt)) {
        return false;
      }

      if (dateFilter === "month" && !isThisMonth(analysis.createdAt)) {
        return false;
      }

      return true;
    });

    items.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (sortBy === "profitLoss") {
        const aProfit = getAnalysisTrackingEntries(a).reduce(
          (sum, entry) => sum + (entry.tracking.profitLoss || 0),
          0
        );
        const bProfit = getAnalysisTrackingEntries(b).reduce(
          (sum, entry) => sum + (entry.tracking.profitLoss || 0),
          0
        );
        return bProfit - aProfit;
      }

      if (sortBy === "edge") {
        const aResult = a.tracking.selectedMarket
          ? a.results.find((r) => r.market === a.tracking.selectedMarket)
          : getBestBet(a.results);

        const bResult = b.tracking.selectedMarket
          ? b.results.find((r) => r.market === b.tracking.selectedMarket)
          : getBestBet(b.results);

        return (bResult?.valueBet || 0) - (aResult?.valueBet || 0);
      }

      if (sortBy === "confidence") {
        const aResult = a.tracking.selectedMarket
          ? a.results.find((r) => r.market === a.tracking.selectedMarket)
          : getBestBet(a.results);

        const bResult = b.tracking.selectedMarket
          ? b.results.find((r) => r.market === b.tracking.selectedMarket)
          : getBestBet(b.results);

        return (bResult?.confidence || 0) - (aResult?.confidence || 0);
      }

      return 0;
    });

    return items;
  }, [
    safeAnalyses,
    searchTerm,
    statusFilter,
    betPlacedFilter,
    marketFilter,
    dateFilter,
    sortBy,
  ]);

  useEffect(() => {
    if (!highlightedAnalysisId) return;

    const target = analysisRefs.current[highlightedAnalysisId];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setExpandedIds((prev) =>
      prev.includes(highlightedAnalysisId) ? prev : [...prev, highlightedAnalysisId]
    );
  }, [highlightedAnalysisId, filteredAnalyses]);

  useEffect(() => {
    if (!highlightedAnalysisId || !prepareBetFromRoadmap) return;
    if (preparedBetAppliedRef.current === highlightedAnalysisId) return;

    const targetAnalysis = analyses.find((analysis) => analysis.id === highlightedAnalysisId);
    if (!targetAnalysis) return;

    const selectedResult = targetAnalysis.results.find(
      (result) => result.market === preparedMarket
    );
    if (!selectedResult) return;

    const parsedStake = preparedStake === null ? Number.NaN : Number(preparedStake);
    const parsedOdd = preparedOdd === null ? Number.NaN : Number(preparedOdd);

    const updatedAnalyses = updateAnalysisTracking(highlightedAnalysisId, {
      betPlaced: true,
      selectedMarket: selectedResult.market,
      stakeUsed: Number.isFinite(parsedStake)
        ? Number(parsedStake.toFixed(2))
        : Number(selectedResult.stake.toFixed(2)),
      oddUsed: Number.isFinite(parsedOdd)
        ? Number(parsedOdd.toFixed(2))
        : Number(selectedResult.odds.toFixed(2)),
    });

    preparedBetAppliedRef.current = highlightedAnalysisId;
    setAnalyses(updatedAnalyses);
  }, [
    analyses,
    highlightedAnalysisId,
    prepareBetFromRoadmap,
    preparedMarket,
    preparedOdd,
    preparedStake,
  ]);

  const handleTrackingChange = (
    analysisId: string,
    betId: string,
    updates: Partial<SavedAnalysis["tracking"]>
  ) => {
    const updatedAnalyses =
      betId === "primary"
        ? updateAnalysisTracking(analysisId, updates)
        : updateTrackedBet(analysisId, betId, updates);
    setAnalyses(updatedAnalyses);
  };

  const handleBetPlacedToggle = (
    analysis: SavedAnalysis,
    betId: string,
    betPlaced: boolean
  ) => {
    if (!betPlaced) {
      handleTrackingChange(analysis.id, betId, { betPlaced: false });
      return;
    }

    const bestBet = getBestBet(analysis.results);

    handleTrackingChange(analysis.id, betId, {
      betPlaced: true,
      selectedMarket: bestBet?.market ?? null,
      stakeUsed: bestBet ? Number(bestBet.stake.toFixed(2)) : null,
      oddUsed: bestBet ? Number(bestBet.odds.toFixed(2)) : null,
    });
  };

  const handleSelectedMarketChange = (
    analysis: SavedAnalysis,
    betId: string,
    selectedMarket: string
  ) => {
    const selectedResult =
      analysis.results.find((result) => result.market === selectedMarket) || null;

    handleTrackingChange(analysis.id, betId, {
      selectedMarket: selectedMarket || null,
      oddUsed: selectedResult ? Number(selectedResult.odds.toFixed(2)) : null,
      stakeUsed: selectedResult ? Number(selectedResult.stake.toFixed(2)) : null,
    });
  };

  const autofillTrackingFromBestBet = (analysis: SavedAnalysis, betId = "primary") => {
    const bestBet = getBestBet(analysis.results);
    if (!bestBet) return;

    handleTrackingChange(analysis.id, betId, {
      betPlaced: true,
      selectedMarket: bestBet.market,
      oddUsed: Number(bestBet.odds.toFixed(2)),
      stakeUsed: Number(bestBet.stake.toFixed(2)),
    });
  };

  const handleAddSecondBet = (analysis: SavedAnalysis) => {
    const bestBet = getBestBet(analysis.results);
    const updatedAnalyses = addExtraTrackedBet(analysis.id, {
      betPlaced: true,
      selectedMarket: bestBet?.market ?? null,
      stakeUsed: bestBet ? Number(bestBet.stake.toFixed(2)) : null,
      oddUsed: bestBet ? Number(bestBet.odds.toFixed(2)) : null,
    });
    setAnalyses(updatedAnalyses);
    setExpandedIds((prev) => (prev.includes(analysis.id) ? prev : [...prev, analysis.id]));
  };

  const handleDeleteTrackedBet = (analysis: SavedAnalysis, betId: string) => {
    const updatedAnalyses = deleteExtraTrackedBet(analysis.id, betId);
    setAnalyses(updatedAnalyses);
  };

  const handleDeleteAnalysis = (analysisId: string, matchLabel: string) => {
    const confirmed = window.confirm(
      `Delete analysis for ${matchLabel}? This action cannot be undone.`
    );

    if (!confirmed) return;

    const updatedAnalyses = deleteAnalysis(analysisId);
    setAnalyses(updatedAnalyses);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setBetPlacedFilter("all");
    setMarketFilter("all");
    setDateFilter("all");
    setSortBy("newest");
  };

  const toggleExpanded = (analysisId: string) => {
    setExpandedIds((prev) =>
      prev.includes(analysisId)
        ? prev.filter((id) => id !== analysisId)
        : [...prev, analysisId]
    );
  };

  const summary = useMemo(() => {
    const trackedEntries = filteredAnalyses.flatMap((analysis) =>
      getAnalysisTrackingEntries(analysis)
    );
    const total = filteredAnalyses.length;
    const placed = trackedEntries.filter((entry) => entry.tracking.betPlaced).length;
    const settled = trackedEntries.filter((entry) =>
      ["green", "red", "void"].includes(entry.tracking.resultStatus)
    ).length;
    const greens = trackedEntries.filter(
      (entry) => entry.tracking.resultStatus === "green"
    ).length;
    const reds = trackedEntries.filter(
      (entry) => entry.tracking.resultStatus === "red"
    ).length;
    const needsUpdate = trackedEntries.filter((entry) =>
      needsTrackedBetAttention(entry.tracking)
    ).length;

    return { total, placed, settled, greens, reds, needsUpdate };
  }, [filteredAnalyses]);

  const historyAiPayload = useMemo<HistoryAISummaryPayload>(() => {
    const trackedEntries = filteredAnalyses.flatMap((analysis) =>
      getAnalysisTrackingEntries(analysis)
    );
    const viewBets = trackedEntries.filter((entry) => entry.tracking.betPlaced);
    const settledBets = viewBets.filter((entry) =>
      ["green", "red", "void"].includes(entry.tracking.resultStatus)
    );
    const pendingBets = viewBets.filter(
      (entry) => entry.tracking.resultStatus === "pending"
    );

    const displayResults = viewBets
      .map((entry) => {
        const result = entry.tracking.selectedMarket
          ? entry.analysis.results.find((item) => item.market === entry.tracking.selectedMarket)
          : getBestBet(entry.analysis.results);

        return result ? { entry, result } : null;
      })
      .filter(
        (
          item
        ): item is {
          entry: ReturnType<typeof getAnalysisTrackingEntries>[number];
          result: NonNullable<ReturnType<typeof getBestBet>>;
        } => item !== null
      );

    const avgConfidence =
      displayResults.length > 0
        ? displayResults.reduce((sum, item) => sum + item.result.confidence, 0) /
          displayResults.length
        : 0;
    const avgEdge =
      displayResults.length > 0
        ? displayResults.reduce((sum, item) => sum + item.result.valueBet, 0) /
          displayResults.length
        : 0;

    const marketMap = new Map<
      string,
      {
        market: string;
        bets: number;
        greens: number;
        reds: number;
        profit_loss: number;
        hit_rate: number;
        roi: number;
        totalStake: number;
      }
    >();

    settledBets.forEach((entry) => {
      const market = entry.tracking.selectedMarket;
      if (!market) return;

      const current = marketMap.get(market) || {
        market,
        bets: 0,
        greens: 0,
        reds: 0,
        profit_loss: 0,
        hit_rate: 0,
        roi: 0,
        totalStake: 0,
      };

      current.bets += 1;
      current.profit_loss += entry.tracking.profitLoss || 0;
      current.totalStake += entry.tracking.stakeUsed || 0;
      if (entry.tracking.resultStatus === "green") current.greens += 1;
      if (entry.tracking.resultStatus === "red") current.reds += 1;

      const settled = current.greens + current.reds;
      current.hit_rate = settled > 0 ? (current.greens / settled) * 100 : 0;
      current.roi =
        current.totalStake > 0
          ? (current.profit_loss / current.totalStake) * 100
          : 0;

      marketMap.set(market, current);
    });

    const rankedMarkets = Array.from(marketMap.values())
      .filter((item) => item.bets > 0)
      .sort((a, b) => b.roi - a.roi);

    const strongestMarket = rankedMarkets[0]?.market ?? null;
    const weakestMarket =
      rankedMarkets.length > 1
        ? rankedMarkets[rankedMarkets.length - 1]?.market ?? null
        : null;

    const filterSummary = [
      `status:${statusFilter}`,
      `bet:${betPlacedFilter}`,
      `market:${marketFilter}`,
      `date:${dateFilter}`,
      `sort:${sortBy}`,
      searchTerm.trim() ? `search:${searchTerm.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      visible_analyses: filteredAnalyses.length,
      placed_bets: viewBets.length,
      settled_bets: settledBets.length,
      pending_bets: pendingBets.length,
      greens: filteredAnalyses.filter((analysis) => analysis.tracking.resultStatus === "green").length,
      reds: filteredAnalyses.filter((analysis) => analysis.tracking.resultStatus === "red").length,
      needs_update: filteredAnalyses.filter((analysis) =>
        getAnalysisTrackingEntries(analysis).some((entry) =>
          needsTrackedBetAttention(entry.tracking)
        )
      ).length,
      avg_confidence: Number(avgConfidence.toFixed(1)),
      avg_edge: Number(avgEdge.toFixed(2)),
      filter_summary: filterSummary,
      strongest_market: strongestMarket,
      weakest_market: weakestMarket,
      top_markets: rankedMarkets.slice(0, 3).map((item) => ({
        market: item.market,
        bets: item.bets,
        roi: Number(item.roi.toFixed(2)),
        hit_rate: Number(item.hit_rate.toFixed(2)),
        profit_loss: Number(item.profit_loss.toFixed(2)),
      })),
      recent_matches: filteredAnalyses
        .slice(0, 3)
        .map((analysis) => `${analysis.homeTeam} vs ${analysis.awayTeam}`),
      multiple_draft_legs: multipleDraft.length,
      pending_multiples: savedMultiples.filter(
        (multiple) =>
          multiple.tracking.betPlaced &&
          multiple.tracking.resultStatus === "pending"
      ).length,
      settled_multiples: savedMultiples.filter((multiple) =>
        ["green", "red", "void"].includes(multiple.tracking.resultStatus)
      ).length,
    };
  }, [
    filteredAnalyses,
    multipleDraft.length,
    savedMultiples,
    statusFilter,
    betPlacedFilter,
    marketFilter,
    dateFilter,
    sortBy,
    searchTerm,
  ]);

  const historyAiPayloadKey = useMemo(
    () => JSON.stringify(historyAiPayload),
    [historyAiPayload]
  );

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 8000);
    const showLoadingState = !hasLoadedAiReviewRef.current;

    const run = async () => {
      if (showLoadingState) {
        setAiLoading(true);
      }
      try {
        const response = await fetch(buildApiUrl("/ai/history-review"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: historyAiPayloadKey,
        });

        if (!response.ok) {
          throw new Error(`Failed to load history AI review (${response.status})`);
        }

        const data = (await response.json()) as HistoryAISummary;
        if (!isCancelled) {
          setAiSummary(data);
          hasLoadedAiReviewRef.current = true;
        }
      } catch {
        if (!isCancelled) {
          const parsedPayload = JSON.parse(
            historyAiPayloadKey
          ) as HistoryAISummaryPayload;
          setAiSummary(buildHistoryFallbackSummary(parsedPayload));
          hasLoadedAiReviewRef.current = true;
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!isCancelled && showLoadingState) {
          setAiLoading(false);
        }
      }
    };

    run();

    return () => {
      isCancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [historyAiPayloadKey]);

  const handleAddToMultiple = (
    analysis: SavedAnalysis,
    result: SavedAnalysis["results"][number] | null
  ) => {
    if (!result) return;
    addLegToMultipleDraft(createMultipleLeg(analysis, result));
  };

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
                Simple Bet Workspace
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Simple Bet
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">
                Review saved analyses, update tracking, build disciplined multiples and use the filtered history to understand what is really validating.
              </p>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-2 gap-3 xl:grid-cols-5"
        >
          <MetricBlock label="Visible Analyses" value={summary.total} />
          <MetricBlock label="Bets Placed" value={summary.placed} />
          <MetricBlock label="Settled" value={summary.settled} />
          <MetricBlock label="Greens" value={summary.greens} />
          <MetricBlock
            label="Needs Update"
            value={
              <span
                className={
                  summary.needsUpdate > 0 ? "text-amber-300" : "text-white"
                }
              >
                {summary.needsUpdate}
              </span>
            }
          />
        </motion.div>

        <PremiumCard
          title="AI History Review"
          description="A quick reading of what the current history view is validating, where the tracking still needs work and what deserves more care next."
          badge={aiSummary?.configured ? "AI Live" : "Fallback"}
        >
          {aiLoading ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-4 text-sm text-white/55">
              Building history review...
            </div>
          ) : aiSummary ? (
            <div className="space-y-3.5">
              <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                    History Read
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
                      : ["No clear strength is standing out strongly enough yet."]
                  }
                />
                <AIReviewColumn
                  title="Risks"
                  tone="red"
                  startDelay={760}
                  items={
                    aiSummary.risks.length
                      ? aiSummary.risks
                      : ["No major history risk is standing out strongly right now."]
                  }
                />
                <AIReviewColumn
                  title="Next Actions"
                  tone="cyan"
                  startDelay={1140}
                  items={
                    aiSummary.next_actions.length
                      ? aiSummary.next_actions
                      : ["Keep logging results cleanly so the history read stays useful."]
                  }
                />
              </div>

              <p className="text-xs leading-6 text-white/40">
                {aiSummary.disclaimer}
              </p>
            </div>
          ) : null}
        </PremiumCard>

        <PremiumCard
          title="Filters & Search"
          description="Filter first, then focus on the picks and tracking states that actually need attention."
          badge="Controls"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ActiveFilterPill label={`Sort · ${sortBy}`} tone="cyan" />
              {statusFilter !== "all" && (
                <ActiveFilterPill label={`Status · ${statusFilter}`} tone="amber" />
              )}
              {betPlacedFilter !== "all" && (
                <ActiveFilterPill
                  label={betPlacedFilter === "placed" ? "Tracked Only" : "Analysis Only"}
                  tone="emerald"
                />
              )}
              {marketFilter !== "all" && (
                <ActiveFilterPill label={`Market · ${marketFilter}`} tone="cyan" />
              )}
              {dateFilter !== "all" && (
                <ActiveFilterPill label={`Date · ${dateFilter}`} tone="neutral" />
              )}
              {searchTerm.trim() && (
                <ActiveFilterPill label={`Search · ${searchTerm.trim()}`} tone="neutral" />
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <input
                type="text"
                placeholder="Search team or market..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as "all" | "pending" | "green" | "red" | "void"
                  )
                }
                className={darkSelectClass}
                style={darkSelectStyle}
              >
                <option value="all" className="bg-slate-900 text-white">All Status</option>
                <option value="pending" className="bg-slate-900 text-white">Pending</option>
                <option value="green" className="bg-slate-900 text-white">Greens</option>
                <option value="red" className="bg-slate-900 text-white">Reds</option>
                <option value="void" className="bg-slate-900 text-white">Voids</option>
              </select>

              <select
                value={betPlacedFilter}
                onChange={(e) =>
                  setBetPlacedFilter(
                    e.target.value as "all" | "placed" | "not-placed"
                  )
                }
                className={darkSelectClass}
                style={darkSelectStyle}
              >
                <option value="all" className="bg-slate-900 text-white">All Bets</option>
                <option value="placed" className="bg-slate-900 text-white">Bet Placed</option>
                <option value="not-placed" className="bg-slate-900 text-white">No Bet Placed</option>
              </select>

              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className={darkSelectClass}
                style={darkSelectStyle}
              >
                <option value="all" className="bg-slate-900 text-white">All Markets</option>
                {availableMarkets.map((market) => (
                  <option key={market} value={market} className="bg-slate-900 text-white">
                    {market}
                  </option>
                ))}
              </select>

              <select
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(
                    e.target.value as "all" | "today" | "last7" | "month"
                  )
                }
                className={darkSelectClass}
                style={darkSelectStyle}
              >
                <option value="all" className="bg-slate-900 text-white">All Dates</option>
                <option value="today" className="bg-slate-900 text-white">Today</option>
                <option value="last7" className="bg-slate-900 text-white">Last 7 Days</option>
                <option value="month" className="bg-slate-900 text-white">This Month</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | "newest"
                      | "oldest"
                      | "edge"
                      | "confidence"
                      | "profitLoss"
                  )
                }
                className={darkSelectClass}
                style={darkSelectStyle}
              >
                <option value="newest" className="bg-slate-900 text-white">Newest</option>
                <option value="oldest" className="bg-slate-900 text-white">Oldest</option>
                <option value="edge" className="bg-slate-900 text-white">Highest Edge</option>
                <option value="confidence" className="bg-slate-900 text-white">Highest Confidence</option>
                <option value="profitLoss" className="bg-slate-900 text-white">Highest P/L</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setBetPlacedFilter("placed")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  betPlacedFilter === "placed"
                    ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                }`}
              >
                Bet Placed
              </button>
              <button
                onClick={() => setStatusFilter("pending")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  statusFilter === "pending"
                    ? "border-yellow-400/30 bg-yellow-400/15 text-yellow-200"
                    : "border-yellow-500/20 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/15"
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter("green")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  statusFilter === "green"
                    ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                }`}
              >
                Greens
              </button>
              <button
                onClick={() => setStatusFilter("red")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  statusFilter === "red"
                    ? "border-red-400/30 bg-red-400/15 text-red-200"
                    : "border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                }`}
              >
                Reds
              </button>
              <button
                onClick={resetFilters}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/[0.08]"
              >
                Reset Filters
              </button>

              <span className="ml-auto text-sm text-white/50">
                Showing {filteredAnalyses.length} analyses
              </span>
            </div>
          </div>
        </PremiumCard>

        <div className="space-y-6">
          {filteredAnalyses.length === 0 ? (
            <PremiumCard
              title="No Results"
              description="No analyses match the selected filters."
              badge="Empty"
            >
              <p className="text-sm text-white/60">
                Try widening the date range, resetting filters, or searching by a team name.
              </p>
            </PremiumCard>
          ) : (
            filteredAnalyses.map((analysis) => {
              const trackedEntries = getAnalysisTrackingEntries(analysis);
              const primaryEntry = trackedEntries[0];
              const displayBet = primaryEntry?.tracking.selectedMarket
                ? analysis.results.find(
                    (r) => r.market === primaryEntry.tracking.selectedMarket
                  ) || getBestBet(analysis.results)
                : getBestBet(analysis.results);
              const matchLabel = `${analysis.homeTeam} vs ${analysis.awayTeam}`;
              const isExpanded = expandedIds.includes(analysis.id);
              const trackedBetCount = trackedEntries.filter((entry) => entry.tracking.betPlaced).length;
              const totalProfitLoss = trackedEntries.reduce(
                (sum, entry) => sum + (entry.tracking.profitLoss || 0),
                0
              );
              const openBets = trackedEntries.filter(
                (entry) =>
                  entry.tracking.betPlaced && entry.tracking.resultStatus === "pending"
              ).length;
              const needsAttention = trackedEntries.some((entry) =>
                needsTrackedBetAttention(entry.tracking)
              );
              const totalMissingFields = trackedEntries.reduce(
                (sum, entry) =>
                  sum +
                  (entry.tracking.betPlaced
                    ? getTrackedBetMissingFields(entry.tracking).length
                    : 0),
                0
              );

              return (
                <motion.div
                  variants={fadeUp}
                  key={analysis.id}
                  ref={(el) => {
                    analysisRefs.current[analysis.id] = el;
                  }}
                  className={`scorelab-board-3d scorelab-tilt-3d relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.94)_0%,rgba(5,13,30,0.98)_100%)] p-4 shadow-[0_10px_36px_rgba(0,0,0,0.28)] transition-all duration-300 ${
                    highlightedAnalysisId === analysis.id
                      ? "ring-2 ring-emerald-500/30"
                      : ""
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />

                  <div className="relative space-y-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(analysis.id)}
                      className="w-full rounded-[24px] border border-white/8 bg-white/[0.03] p-3.5 text-left transition hover:bg-white/[0.05]"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
                              Analysis
                            </p>
                            {needsAttention ? (
                              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-amber-300">
                                Needs Update
                              </span>
                            ) : null}
                            {trackedBetCount > 0 ? (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                                {trackedBetCount} Bet{trackedBetCount > 1 ? "s" : ""} Tracked
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/55">
                                Analysis Only
                              </span>
                            )}
                          </div>
                          <h3 className="mt-2 truncate text-[1.1rem] font-semibold text-white md:text-[1.2rem]">
                            {matchLabel}
                          </h3>
                          <p className="mt-1 text-[13px] text-white/52">
                            {formatDateTime(analysis.createdAt)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 xl:items-end">
                          <div className="flex flex-wrap items-center gap-2">
                            {displayBet?.tier && <TierBadge tier={displayBet.tier} />}
                            {displayBet && <DecisionBadge decision={displayBet.decision} />}
                            <div className="rounded-full border border-white/10 bg-white/5 p-2 text-white/55">
                              <ChevronDown
                                className={`h-4 w-4 transition-transform duration-300 ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 xl:justify-end">
                            <InlineStat
                              label={primaryEntry?.tracking.selectedMarket ? "Primary" : "Best"}
                              value={displayBet ? displayBet.market : "-"}
                            />
                            <InlineStat
                              label="Edge"
                              value={displayBet ? <ValueBadge value={displayBet.valueBet} /> : "-"}
                            />
                            <InlineStat
                              label="Confidence"
                              value={
                                displayBet ? (
                                  <ConfidenceMeter score={displayBet.confidence} className="w-24" />
                                ) : (
                                  "-"
                                )
                              }
                            />
                            <InlineStat
                              label="P/L"
                              value={`EUR ${totalProfitLoss.toFixed(2)}`}
                            />
                            <InlineStat
                              label="Open"
                              value={`${openBets}`}
                            />
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {totalMissingFields > 0 ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                            {totalMissingFields} missing field{totalMissingFields > 1 ? "s" : ""}
                          </span>
                        ) : null}
                        {displayBet ? (
                          <button
                            type="button"
                            onClick={() => handleAddToMultiple(analysis, displayBet)}
                            className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-xs text-cyan-200 transition hover:bg-cyan-400/15"
                          >
                            <span className="inline-flex items-center gap-1">
                              <Plus className="h-3.5 w-3.5" />
                              Add To Multiple
                            </span>
                          </button>
                        ) : null}
                        {trackedBetCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => autofillTrackingFromBestBet(analysis)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08]"
                          >
                            Quick Fill From Best Bet
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleAddSecondBet(analysis)}
                          className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08]"
                        >
                          Add Another Bet
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] text-white/48">
                          {isExpanded
                            ? "Tracking panel open"
                            : "Expand to update stake, result and bankroll impact."}
                        </p>
                        <button
                          onClick={() => handleDeleteAnalysis(analysis.id, matchLabel)}
                          className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/15"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <motion.div
                      initial={false}
                      animate={{
                        height: isExpanded ? "auto" : 0,
                        opacity: isExpanded ? 1 : 0,
                      }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 pt-1">
                        {displayBet && (
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                            <MetricBlock
                              label={
                                primaryEntry?.tracking.selectedMarket
                                  ? "Primary Market"
                                  : "Best Market"
                              }
                              value={displayBet.market}
                            />
                            <MetricBlock
                              label="Model Probability"
                              value={`${displayBet.modelProb.toFixed(1)}%`}
                            />
                            <MetricBlock
                              label="Implied Probability"
                              value={`${displayBet.impliedProb.toFixed(1)}%`}
                            />
                            <MetricBlock
                              label="Edge"
                              value={<ValueBadge value={displayBet.valueBet} />}
                            />
                            <MetricBlock
                              label="Confidence"
                              value={<ConfidenceMeter score={displayBet.confidence} className="w-24" />}
                            />
                            <MetricBlock
                              label="Decision"
                              value={<DecisionBadge decision={displayBet.decision} />}
                            />
                          </div>
                        )}

                        <div className="space-y-4">
                          {trackedEntries.map((entry) => {
                            const tracking = entry.tracking;
                            const missingFields = getTrackedBetMissingFields(tracking);
                            return (
                              <div
                                key={entry.betId}
                                className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                              >
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                                      {entry.label}
                                    </p>
                                    <p className="mt-1 text-sm text-white/55">
                                      {tracking.selectedMarket || "Select the market you actually placed."}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {missingFields.length > 0 && tracking.betPlaced ? (
                                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-300">
                                        Needs update
                                      </span>
                                    ) : null}
                                    {!entry.isPrimary ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTrackedBet(analysis, entry.betId)}
                                        className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-red-300 transition hover:bg-red-500/15"
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                                  <DetailSection
                                    title="Tracking Inputs"
                                    description="Update the actual details for this specific bet."
                                  >
                                    <div className="space-y-3.5">
                                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                                        <label className="flex items-center gap-3 text-sm text-white">
                                          <input
                                            type="checkbox"
                                            checked={tracking.betPlaced}
                                            onChange={(e) =>
                                              handleBetPlacedToggle(analysis, entry.betId, e.target.checked)
                                            }
                                            className="h-4 w-4 rounded border-white/20 bg-transparent"
                                          />
                                          I placed this bet
                                        </label>
                                      </div>

                                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <InputField label="Selected Market">
                                          <select
                                            value={tracking.selectedMarket ?? ""}
                                            onChange={(e) =>
                                              handleSelectedMarketChange(analysis, entry.betId, e.target.value)
                                            }
                                            className={`${darkSelectClass} w-full`}
                                            style={darkSelectStyle}
                                            disabled={!tracking.betPlaced}
                                          >
                                            <option value="" className="bg-slate-900 text-white">
                                              Select market
                                            </option>
                                            {analysis.results.map((result) => (
                                              <option
                                                key={`${entry.betId}-${result.market}`}
                                                value={result.market}
                                                className="bg-slate-900 text-white"
                                              >
                                                {result.market}
                                              </option>
                                            ))}
                                          </select>
                                        </InputField>

                                        <InputField label="Result Status">
                                          <select
                                            value={tracking.resultStatus}
                                            onChange={(e) =>
                                              handleTrackingChange(analysis.id, entry.betId, {
                                                resultStatus: e.target.value as BetStatus,
                                              })
                                            }
                                            className={`${darkSelectClass} w-full`}
                                            style={darkSelectStyle}
                                            disabled={!tracking.betPlaced}
                                          >
                                            <option value="pending" className="bg-slate-900 text-white">Pending</option>
                                            <option value="green" className="bg-slate-900 text-white">Green</option>
                                            <option value="red" className="bg-slate-900 text-white">Red</option>
                                            <option value="void" className="bg-slate-900 text-white">Void</option>
                                          </select>
                                        </InputField>

                                        <InputField label="Stake Used">
                                          <input
                                            type="number"
                                            value={tracking.stakeUsed ?? ""}
                                            onChange={(e) =>
                                              handleTrackingChange(analysis.id, entry.betId, {
                                                stakeUsed:
                                                  e.target.value === "" ? null : Number(e.target.value),
                                              })
                                            }
                                            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            disabled={!tracking.betPlaced}
                                          />
                                        </InputField>

                                        <InputField label="Odd Used">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={tracking.oddUsed ?? ""}
                                            onChange={(e) =>
                                              handleTrackingChange(analysis.id, entry.betId, {
                                                oddUsed:
                                                  e.target.value === "" ? null : Number(e.target.value),
                                              })
                                            }
                                            className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                            disabled={!tracking.betPlaced}
                                          />
                                        </InputField>
                                      </div>

                                      <InputField label="Notes">
                                        <input
                                          type="text"
                                          value={tracking.notes}
                                          onChange={(e) =>
                                            handleTrackingChange(analysis.id, entry.betId, {
                                              notes: e.target.value,
                                            })
                                          }
                                          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                          disabled={!tracking.betPlaced}
                                        />
                                      </InputField>
                                    </div>
                                  </DetailSection>

                                  <DetailSection
                                    title="Bankroll Impact"
                                    description="A compact read of how this tracked bet is affecting the bankroll flow."
                                  >
                                    <div className="grid grid-cols-2 gap-3">
                                      <MetricBlock
                                        label="Bankroll Before"
                                        value={
                                          tracking.bankrollBefore !== null
                                            ? `EUR ${tracking.bankrollBefore.toFixed(2)}`
                                            : "-"
                                        }
                                      />
                                      <MetricBlock
                                        label="Profit / Loss"
                                        value={`EUR ${tracking.profitLoss.toFixed(2)}`}
                                      />
                                      <MetricBlock
                                        label="Bankroll After"
                                        value={
                                          tracking.bankrollAfter !== null
                                            ? `EUR ${tracking.bankrollAfter.toFixed(2)}`
                                            : "-"
                                        }
                                      />
                                      <MetricBlock
                                        label="Tracked Status"
                                        value={<span className="capitalize">{tracking.resultStatus}</span>}
                                      />
                                    </div>
                                  </DetailSection>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

      </motion.div>
    </AppLayout>
  );
}
