import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ListChecks,
  Plus,
  TrendingUp,
  Trash2,
  Wallet,
} from "lucide-react";
import { motion } from "framer-motion";
import { MatchResultsPanel } from "@/components/MatchResultsPanel";
import { calculateBetQualityScore, type BetQualityScore } from "@/lib/betQualityScore";
import {
  buildDecisionMemorySnapshot,
  buildPostBetTruth,
  type PostBetTruth,
} from "@/lib/decisionMemory";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ANALYSES_UPDATED_EVENT,
  addExtraTrackedBet,
  createEmptyTracking,
  deleteExtraTrackedBet,
  getAnalyses,
  getAnalysisTrackingEntries,
  updateAnalysisTracking,
  updateAnalysisModelAudit,
  updateTrackedBet,
  deleteAnalysis,
  clearAnalysisModelAudit,
} from "@/lib/analysisStorage";
import { getModelAuditSummary } from "@/lib/modelAudit";
import {
  MULTIPLES_UPDATED_EVENT,
  addLegToMultipleDraft,
  createMultipleLeg,
  getMultipleDraft,
  getSavedMultiples,
} from "@/lib/multipleStorage";
import type { SavedAnalysis, BetStatus, TrackedAnalysisBet } from "@/types/analysis";
import { useSearchParams } from "react-router-dom";

const darkSelectClass =
  "h-11 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

const darkSelectStyle = {
  colorScheme: "light" as const,
};

const INITIAL_VISIBLE_ANALYSES = 18;

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
      className="relative overflow-hidden rounded-[28px] border border-border bg-card p-5"
    >
      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Simple Bet
          </p>
          <h2 className="mt-2 text-base font-semibold text-foreground md:text-lg">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {badge && (
          <div className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-3 py-1 text-xs text-muted-foreground">
            {badge}
          </div>
        )}
      </div>

      <div className="relative">{children}</div>
    </motion.div>
  );
}

const METRIC_TONE_CLASS = {
  cyan: "border-primary/30 bg-primary/10 text-primary",
  emerald: "border-emerald-300/25 bg-emerald-300/10 text-emerald-700",
  amber: "border-amber-300/25 bg-amber-300/10 text-amber-700",
};

function MetricBlock({
  label,
  value,
  icon: Icon,
  tone = "cyan",
}: {
  label: string;
  value: React.ReactNode;
  icon?: typeof ListChecks;
  tone?: "cyan" | "emerald" | "amber";
}) {
  return (
    <div className="rounded-2xl border border-border bg-[hsl(var(--sl-surface))] px-3.5 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="h-1.5 w-10 rounded-full bg-primary" />
        {Icon ? (
          <span
            className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border ${METRIC_TONE_CLASS[tone]}`}
          >
            <Icon className="h-3 w-3" strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1.5 text-base font-semibold text-foreground">{value}</div>
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
    <div className="rounded-2xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
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
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-700"
      : tone === "amber"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-700"
      : tone === "red"
      ? "border-red-400/20 bg-red-400/10 text-red-700"
      : tone === "cyan"
      ? "border-primary/30 bg-primary/10 text-primary"
      : "border-border bg-[hsl(var(--sl-surface))] text-muted-foreground";

  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.04em] ${toneClasses}`}
    >
      {label}
    </span>
  );
}

function QualityScoreBadge({ quality }: { quality: BetQualityScore }) {
  const toneClasses =
    quality.tone === "positive"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-700"
      : quality.tone === "negative"
      ? "border-red-400/25 bg-red-400/10 text-red-700"
      : "border-amber-400/25 bg-amber-400/10 text-amber-700";

  return (
    <div className={`rounded-2xl border px-3 py-2 text-right ${toneClasses}`}>
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] opacity-70">
        Quality Score
      </p>
      <p className="mt-1 text-lg font-semibold leading-none">{quality.score}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
        {quality.label}
      </p>
    </div>
  );
}

function PostBetTruthPanel({ truth }: { truth: PostBetTruth }) {
  const toneClasses =
    truth.tone === "positive"
      ? "border-emerald-400/14 bg-emerald-400/[0.055] text-emerald-50"
      : truth.tone === "negative"
      ? "border-red-400/14 bg-red-400/[0.055] text-red-50"
      : "border-primary/30 bg-primary/5 text-primary";

  return (
    <div className={`rounded-2xl border p-3 ${toneClasses}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-65">
          Post-Bet Truth
        </p>
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80">
          {truth.verdict}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 opacity-78">{truth.summary}</p>
      <p className="mt-2 text-xs leading-5 opacity-58">{truth.lesson}</p>
    </div>
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
    <div className="rounded-[24px] border border-border bg-[hsl(var(--sl-surface))] p-4">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
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
    <div className="rounded-2xl border border-border bg-[hsl(var(--sl-surface))] p-3.5">
      <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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

function buildQualitySnapshot(
  analysis: SavedAnalysis,
  tracking: SavedAnalysis["tracking"]
): Partial<SavedAnalysis["tracking"]> {
  if (!tracking.betPlaced) {
    return {
      qualityScore: null,
      qualityLabel: null,
      qualityTone: null,
      qualitySummary: null,
      qualitySnapshotAt: null,
      decisionMemory: null,
      postBetTruth: null,
    };
  }

  const selectedResult = tracking.selectedMarket
    ? analysis.results.find((result) => result.market === tracking.selectedMarket) ?? null
    : null;
  const quality = calculateBetQualityScore({ result: selectedResult, tracking });
  const qualitySnapshotAt = new Date().toISOString();
  const trackingWithQuality = {
    ...tracking,
    qualityScore: quality.score,
    qualityLabel: quality.label,
    qualityTone: quality.tone,
    qualitySummary: quality.summary,
    qualitySnapshotAt,
  };
  const decisionMemory = buildDecisionMemorySnapshot({
    result: selectedResult,
    tracking: trackingWithQuality,
    capturedAt: qualitySnapshotAt,
  });
  const postBetTruth = buildPostBetTruth({
    status: tracking.resultStatus,
    memory: decisionMemory,
    profitLoss: tracking.profitLoss,
  });

  return {
    qualityScore: quality.score,
    qualityLabel: quality.label,
    qualityTone: quality.tone,
    qualitySummary: quality.summary,
    qualitySnapshotAt,
    decisionMemory,
    postBetTruth,
  };
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
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ANALYSES);
  const [auditDrafts, setAuditDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const expandedIdSet = useMemo(() => new Set(expandedIds), [expandedIds]);

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

  const trackingEntriesByAnalysisId = useMemo(() => {
    const entries = new Map<string, ReturnType<typeof getAnalysisTrackingEntries>>();
    safeAnalyses.forEach((analysis) => {
      entries.set(analysis.id, getAnalysisTrackingEntries(analysis));
    });
    return entries;
  }, [safeAnalyses]);

  const availableMarkets = useMemo(() => {
    return Array.from(
      new Set(
        safeAnalyses
          .flatMap((analysis) =>
            (trackingEntriesByAnalysisId.get(analysis.id) ?? []).map(
              (entry) => entry.tracking.selectedMarket
            )
          )
          .filter(Boolean)
      )
    ) as string[];
  }, [safeAnalyses, trackingEntriesByAnalysisId]);

  const filteredAnalyses = useMemo(() => {
    let items = [...safeAnalyses];

    items = items.filter((analysis) => {
      const match = `${analysis.homeTeam} vs ${analysis.awayTeam}`.toLowerCase();
      const trackedEntries = trackingEntriesByAnalysisId.get(analysis.id) ?? [];
      const trackedMarkets = trackedEntries
        .map((entry) => (entry.tracking.selectedMarket || "").toLowerCase())
        .filter(Boolean);
      const search = deferredSearchTerm.trim().toLowerCase();

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
        const aProfit = (trackingEntriesByAnalysisId.get(a.id) ?? []).reduce(
          (sum, entry) => sum + (entry.tracking.profitLoss || 0),
          0
        );
        const bProfit = (trackingEntriesByAnalysisId.get(b.id) ?? []).reduce(
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
    trackingEntriesByAnalysisId,
    deferredSearchTerm,
    statusFilter,
    betPlacedFilter,
    marketFilter,
    dateFilter,
    sortBy,
  ]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_ANALYSES);
  }, [
    deferredSearchTerm,
    statusFilter,
    betPlacedFilter,
    marketFilter,
    dateFilter,
    sortBy,
  ]);

  const visibleAnalyses = useMemo(
    () => filteredAnalyses.slice(0, visibleCount),
    [filteredAnalyses, visibleCount]
  );
  const hasMoreAnalyses = visibleCount < filteredAnalyses.length;
  const modelAuditSummary = useMemo(
    () => getModelAuditSummary(safeAnalyses),
    [safeAnalyses]
  );

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

    const nextTracking = {
      ...targetAnalysis.tracking,
      betPlaced: true,
      selectedMarket: selectedResult.market,
      stakeUsed: Number.isFinite(parsedStake)
        ? Number(parsedStake.toFixed(2))
        : Number(selectedResult.stake.toFixed(2)),
      oddUsed: Number.isFinite(parsedOdd)
        ? Number(parsedOdd.toFixed(2))
        : Number(selectedResult.odds.toFixed(2)),
    };

    const updatedAnalyses = updateAnalysisTracking(highlightedAnalysisId, {
      ...nextTracking,
      ...buildQualitySnapshot(targetAnalysis, nextTracking),
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
    const targetAnalysis = analyses.find((analysis) => analysis.id === analysisId);
    const currentTracking =
      betId === "primary"
        ? targetAnalysis?.tracking
        : targetAnalysis?.extraBets?.find((bet) => bet.id === betId) ?? null;
    const qualityUpdates =
      targetAnalysis && currentTracking
        ? buildQualitySnapshot(targetAnalysis, {
            ...currentTracking,
            ...updates,
          })
        : {};
    const nextUpdates = {
      ...updates,
      ...qualityUpdates,
    };
    const updatedAnalyses =
      betId === "primary"
        ? updateAnalysisTracking(analysisId, nextUpdates)
        : updateTrackedBet(analysisId, betId, nextUpdates);
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
    const seed = {
      ...createEmptyTracking(),
      betPlaced: true,
      selectedMarket: bestBet?.market ?? null,
      stakeUsed: bestBet ? Number(bestBet.stake.toFixed(2)) : null,
      oddUsed: bestBet ? Number(bestBet.odds.toFixed(2)) : null,
    };
    const updatedAnalyses = addExtraTrackedBet(analysis.id, {
      ...seed,
      ...buildQualitySnapshot(analysis, seed),
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

  const updateAuditDraft = (
    analysis: SavedAnalysis,
    side: "home" | "away",
    value: string
  ) => {
    setAuditDrafts((prev) => {
      const current = prev[analysis.id] ?? {
        home:
          typeof analysis.modelAudit?.homeGoals === "number"
            ? String(analysis.modelAudit.homeGoals)
            : "",
        away:
          typeof analysis.modelAudit?.awayGoals === "number"
            ? String(analysis.modelAudit.awayGoals)
            : "",
      };

      return {
        ...prev,
        [analysis.id]: {
          ...current,
          [side]: value,
        },
      };
    });
  };

  const saveModelAudit = (analysis: SavedAnalysis) => {
    const draft = auditDrafts[analysis.id] ?? {
      home:
        typeof analysis.modelAudit?.homeGoals === "number"
          ? String(analysis.modelAudit.homeGoals)
          : "",
      away:
        typeof analysis.modelAudit?.awayGoals === "number"
          ? String(analysis.modelAudit.awayGoals)
          : "",
    };
    const homeGoals = Number(draft.home);
    const awayGoals = Number(draft.away);

    if (
      !Number.isInteger(homeGoals) ||
      !Number.isInteger(awayGoals) ||
      homeGoals < 0 ||
      awayGoals < 0
    ) {
      window.alert("Insert a valid final score, for example 2-1.");
      return;
    }

    const updatedAnalyses = updateAnalysisModelAudit(
      analysis.id,
      homeGoals,
      awayGoals
    );
    setAnalyses(updatedAnalyses);
  };

  const clearModelAudit = (analysisId: string) => {
    const updatedAnalyses = clearAnalysisModelAudit(analysisId);
    setAnalyses(updatedAnalyses);
    setAuditDrafts((prev) => {
      const next = { ...prev };
      delete next[analysisId];
      return next;
    });
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
      trackingEntriesByAnalysisId.get(analysis.id) ?? []
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
  }, [filteredAnalyses, trackingEntriesByAnalysisId]);

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
          className="relative overflow-hidden rounded-[32px] border border-border bg-card p-5"
        >
          <div className="relative max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Simple Bet Workspace
              </div>
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Simple Bet
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                Review saved analyses, update tracking, build disciplined multiples and use the filtered history to understand what is really validating.
              </p>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-2 gap-3 xl:grid-cols-5"
        >
          <MetricBlock label="Visible Analyses" value={summary.total} icon={ListChecks} tone="cyan" />
          <MetricBlock label="Bets Placed" value={summary.placed} icon={Wallet} tone="cyan" />
          <MetricBlock label="Settled" value={summary.settled} icon={CheckCircle2} tone="cyan" />
          <MetricBlock label="Greens" value={summary.greens} icon={TrendingUp} tone="emerald" />
          <MetricBlock
            label="Needs Update"
            value={
              <span
                className={
                  summary.needsUpdate > 0 ? "text-amber-700" : "text-foreground"
                }
              >
                {summary.needsUpdate}
              </span>
            }
            icon={AlertTriangle}
            tone="amber"
          />
        </motion.div>

        <motion.div variants={fadeUp}>
          <MatchResultsPanel analyses={analyses} onUpdated={setAnalyses} />
        </motion.div>

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
                className="h-11 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                <option value="all" className="bg-card text-foreground">All Status</option>
                <option value="pending" className="bg-card text-foreground">Pending</option>
                <option value="green" className="bg-card text-foreground">Greens</option>
                <option value="red" className="bg-card text-foreground">Reds</option>
                <option value="void" className="bg-card text-foreground">Voids</option>
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
                <option value="all" className="bg-card text-foreground">All Bets</option>
                <option value="placed" className="bg-card text-foreground">Bet Placed</option>
                <option value="not-placed" className="bg-card text-foreground">No Bet Placed</option>
              </select>

              <select
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
                className={darkSelectClass}
                style={darkSelectStyle}
              >
                <option value="all" className="bg-card text-foreground">All Markets</option>
                {availableMarkets.map((market) => (
                  <option key={market} value={market} className="bg-card text-foreground">
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
                <option value="all" className="bg-card text-foreground">All Dates</option>
                <option value="today" className="bg-card text-foreground">Today</option>
                <option value="last7" className="bg-card text-foreground">Last 7 Days</option>
                <option value="month" className="bg-card text-foreground">This Month</option>
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
                <option value="newest" className="bg-card text-foreground">Newest</option>
                <option value="oldest" className="bg-card text-foreground">Oldest</option>
                <option value="edge" className="bg-card text-foreground">Highest Edge</option>
                <option value="confidence" className="bg-card text-foreground">Highest Confidence</option>
                <option value="profitLoss" className="bg-card text-foreground">Highest P/L</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setBetPlacedFilter("placed")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  betPlacedFilter === "placed"
                    ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-700"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15"
                }`}
              >
                Bet Placed
              </button>
              <button
                onClick={() => setStatusFilter("pending")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  statusFilter === "pending"
                    ? "border-yellow-400/30 bg-yellow-400/15 text-yellow-700"
                    : "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/15"
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter("green")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  statusFilter === "green"
                    ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-700"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15"
                }`}
              >
                Greens
              </button>
              <button
                onClick={() => setStatusFilter("red")}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  statusFilter === "red"
                    ? "border-red-400/30 bg-red-400/15 text-red-700"
                    : "border-red-500/20 bg-red-500/10 text-red-700 hover:bg-red-500/15"
                }`}
              >
                Reds
              </button>
              <button
                onClick={resetFilters}
                className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-[hsl(var(--sl-surface))]"
              >
                Reset Filters
              </button>

              <span className="ml-auto text-sm text-muted-foreground">
                Showing {visibleAnalyses.length} of {filteredAnalyses.length} analyses
              </span>
            </div>
          </div>
        </PremiumCard>

        <PremiumCard
          title="Model Audit"
          description="Paper-tracks analysed matches without touching bankroll, ROI or financial performance."
          badge={`${modelAuditSummary.auditedMatches} audited`}
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricBlock
              label="Audited Markets"
              value={modelAuditSummary.auditedMarkets}
            />
            <MetricBlock
              label="Model Hit Rate"
              value={`${modelAuditSummary.hitRate.toFixed(1)}%`}
            />
            <MetricBlock
              label="Avg Model Prob."
              value={`${modelAuditSummary.avgModelProb.toFixed(1)}%`}
            />
            <MetricBlock
              label="Brier Score"
              value={modelAuditSummary.brierScore.toFixed(3)}
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Add final scores inside each analysis to measure whether markets were correctly
            priced, even when no money was placed.
          </p>
        </PremiumCard>

        <div className="space-y-6">
          {filteredAnalyses.length === 0 ? (
            <PremiumCard
              title="No Results"
              description="No analyses match the selected filters."
              badge="Empty"
            >
              <p className="text-sm text-muted-foreground">
                Try widening the date range, resetting filters, or searching by a team name.
              </p>
            </PremiumCard>
          ) : (
            <>
            {visibleAnalyses.map((analysis) => {
              const trackedEntries = trackingEntriesByAnalysisId.get(analysis.id) ?? [];
              const primaryEntry = trackedEntries[0];
              const displayBet = primaryEntry?.tracking.selectedMarket
                ? analysis.results.find(
                    (r) => r.market === primaryEntry.tracking.selectedMarket
                  ) || getBestBet(analysis.results)
                : getBestBet(analysis.results);
              const matchLabel = `${analysis.homeTeam} vs ${analysis.awayTeam}`;
              const isExpanded = expandedIdSet.has(analysis.id);
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
              const auditDraft = auditDrafts[analysis.id] ?? {
                home:
                  typeof analysis.modelAudit?.homeGoals === "number"
                    ? String(analysis.modelAudit.homeGoals)
                    : "",
                away:
                  typeof analysis.modelAudit?.awayGoals === "number"
                    ? String(analysis.modelAudit.awayGoals)
                    : "",
              };
              const auditedGreens =
                analysis.modelAudit?.outcomes.filter((item) => item.outcome === "green").length ?? 0;
              const auditedReds =
                analysis.modelAudit?.outcomes.filter((item) => item.outcome === "red").length ?? 0;
              const auditedTotal = auditedGreens + auditedReds;
              const cardAccent = needsAttention
                ? "border-l-amber-400"
                : trackedBetCount === 0
                ? "border-l-white/15"
                : totalProfitLoss > 0
                ? "border-l-emerald-400"
                : totalProfitLoss < 0
                ? "border-l-red-400"
                : "border-l-cyan-400";

              return (
                <motion.div
                  variants={fadeUp}
                  key={analysis.id}
                  ref={(el) => {
                    analysisRefs.current[analysis.id] = el;
                  }}
                  className={`relative overflow-hidden rounded-[28px] border border-border border-l-4 ${cardAccent} bg-card p-4 transition-all duration-300 ${
                    highlightedAnalysisId === analysis.id
                      ? "ring-2 ring-emerald-500/30"
                      : ""
                  }`}
                >

                  <div className="relative space-y-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(analysis.id)}
                      className="w-full rounded-[24px] border border-border bg-[hsl(var(--sl-surface))] p-3.5 text-left transition hover:bg-[hsl(var(--sl-surface))]"
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                              Analysis
                            </p>
                            {needsAttention ? (
                              <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-950">
                                Needs Update
                              </span>
                            ) : null}
                            {trackedBetCount > 0 ? (
                              <span className="rounded-full bg-emerald-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">
                                {trackedBetCount} Bet{trackedBetCount > 1 ? "s" : ""} Tracked
                              </span>
                            ) : (
                              <span className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                                Analysis Only
                              </span>
                            )}
                          </div>
                          <h3 className="mt-2 truncate text-[1.1rem] font-semibold text-foreground md:text-[1.2rem]">
                            {matchLabel}
                          </h3>
                          <p className="mt-1 text-[13px] text-muted-foreground">
                            {formatDateTime(analysis.createdAt)}
                          </p>
                        </div>

                        <div className="flex flex-col gap-3 xl:items-end">
                          <div className="flex flex-wrap items-center gap-2">
                            {displayBet?.tier && <TierBadge tier={displayBet.tier} />}
                            {displayBet && <DecisionBadge decision={displayBet.decision} />}
                            <div className="rounded-full border border-border bg-[hsl(var(--sl-surface))] p-2 text-muted-foreground">
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
                              value={
                                <span
                                  className={`font-bold ${
                                    totalProfitLoss > 0
                                      ? "text-emerald-700"
                                      : totalProfitLoss < 0
                                      ? "text-red-700"
                                      : "text-foreground"
                                  }`}
                                >
                                  EUR {totalProfitLoss.toFixed(2)}
                                </span>
                              }
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
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
                            {totalMissingFields} missing field{totalMissingFields > 1 ? "s" : ""}
                          </span>
                        ) : null}
                        {displayBet ? (
                          <button
                            type="button"
                            onClick={() => handleAddToMultiple(analysis, displayBet)}
                            className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-orange-400"
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
                            className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-3 py-1.5 text-xs text-foreground transition hover:bg-[hsl(var(--sl-surface))]"
                          >
                            Quick Fill From Best Bet
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => handleAddSecondBet(analysis)}
                          className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-3 py-1.5 text-xs text-foreground transition hover:bg-[hsl(var(--sl-surface))]"
                        >
                          Add Another Bet
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] text-muted-foreground">
                          {isExpanded
                            ? "Tracking panel open"
                            : "Expand to update stake, result and bankroll impact."}
                        </p>
                        <button
                          onClick={() => handleDeleteAnalysis(analysis.id, matchLabel)}
                          className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-medium text-red-700 transition hover:bg-red-500/15"
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
                      {isExpanded ? (
                      <div className="space-y-4 pt-1">
                        {displayBet && (
                          <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
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

                        <div className="rounded-[24px] border border-primary/30 bg-primary/5 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                                Model Audit
                              </p>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Insert the final score to audit every market in this analysis without
                                counting it as a real-money bet.
                              </p>
                              {analysis.modelAudit ? (
                                <p className="mt-2 text-xs text-primary">
                                  Current audit: {analysis.homeTeam} {analysis.modelAudit.homeGoals}-
                                  {analysis.modelAudit.awayGoals} {analysis.awayTeam} · {auditedGreens}/
                                  {auditedTotal} markets green.
                                </p>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[90px_90px_auto_auto]">
                              <InputField label={analysis.homeTeam || "Home"}>
                                <input
                                  type="number"
                                  min="0"
                                  value={auditDraft.home}
                                  onChange={(event) =>
                                    updateAuditDraft(analysis, "home", event.target.value)
                                  }
                                  className="h-11 w-full rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              </InputField>
                              <InputField label={analysis.awayTeam || "Away"}>
                                <input
                                  type="number"
                                  min="0"
                                  value={auditDraft.away}
                                  onChange={(event) =>
                                    updateAuditDraft(analysis, "away", event.target.value)
                                  }
                                  className="h-11 w-full rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                              </InputField>
                              <button
                                type="button"
                                onClick={() => saveModelAudit(analysis)}
                                className="h-11 self-end rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-primary/10"
                              >
                                Save Audit
                              </button>
                              {analysis.modelAudit ? (
                                <button
                                  type="button"
                                  onClick={() => clearModelAudit(analysis.id)}
                                  className="h-11 self-end rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition hover:bg-[hsl(var(--sl-surface))]"
                                >
                                  Clear
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {trackedEntries.map((entry) => {
                            const tracking = entry.tracking;
                            const missingFields = getTrackedBetMissingFields(tracking);
                            const selectedResult = tracking.selectedMarket
                              ? analysis.results.find((result) => result.market === tracking.selectedMarket) ?? null
                              : null;
                            const quality = calculateBetQualityScore({
                              result: selectedResult,
                              tracking,
                            });
                            return (
                              <div
                                key={entry.betId}
                                className="rounded-[24px] border border-border bg-[hsl(var(--sl-surface))] p-4"
                              >
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                      {entry.label}
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      {tracking.selectedMarket || "Select the market you actually placed."}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <QualityScoreBadge quality={quality} />
                                    {missingFields.length > 0 && tracking.betPlaced ? (
                                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-700">
                                        Needs update
                                      </span>
                                    ) : null}
                                    {!entry.isPrimary ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteTrackedBet(analysis, entry.betId)}
                                        className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-red-700 transition hover:bg-red-500/15"
                                      >
                                        Remove
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                                  <div className="rounded-2xl border border-border bg-[hsl(var(--sl-surface))] p-3">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                      Decision Memory
                                    </p>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                      {quality.summary}
                                    </p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                                      Action: {quality.actions.join(" ")}
                                    </p>
                                    {tracking.decisionMemory ? (
                                      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                                        Captured {tracking.decisionMemory.market} at {tracking.decisionMemory.odds.toFixed(2)} odds, {tracking.decisionMemory.edge.toFixed(1)}% edge and {tracking.decisionMemory.confidence.toFixed(1)}/10 confidence.
                                      </p>
                                    ) : null}
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    {(quality.strengths.length > 0
                                      ? quality.strengths
                                      : ["No strong positive signal yet."]
                                    ).slice(0, 2).map((item) => (
                                      <div
                                        key={`strength-${entry.betId}-${item}`}
                                        className="rounded-2xl border border-emerald-400/12 bg-emerald-400/[0.045] px-3 py-2 text-xs leading-5 text-emerald-700/72"
                                      >
                                        {item}
                                      </div>
                                    ))}
                                    {quality.risks.slice(0, 2).map((item) => (
                                      <div
                                        key={`risk-${entry.betId}-${item}`}
                                        className="rounded-2xl border border-amber-400/12 bg-amber-400/[0.045] px-3 py-2 text-xs leading-5 text-amber-700/72"
                                      >
                                        {item}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {tracking.postBetTruth ? (
                                  <div className="mb-4">
                                    <PostBetTruthPanel truth={tracking.postBetTruth} />
                                  </div>
                                ) : null}

                                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                                  <DetailSection
                                    title="Tracking Inputs"
                                    description="Update the actual details for this specific bet."
                                  >
                                    <div className="space-y-3.5">
                                      <div className="rounded-2xl border border-border bg-[hsl(var(--sl-surface))] p-3.5">
                                        <label className="flex items-center gap-3 text-sm text-foreground">
                                          <input
                                            type="checkbox"
                                            checked={tracking.betPlaced}
                                            onChange={(e) =>
                                              handleBetPlacedToggle(analysis, entry.betId, e.target.checked)
                                            }
                                            className="h-4 w-4 rounded border-border bg-transparent"
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
                                            <option value="" className="bg-card text-foreground">
                                              Select market
                                            </option>
                                            {analysis.results.map((result) => (
                                              <option
                                                key={`${entry.betId}-${result.market}`}
                                                value={result.market}
                                                className="bg-card text-foreground"
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
                                            <option value="pending" className="bg-card text-foreground">Pending</option>
                                            <option value="green" className="bg-card text-foreground">Green</option>
                                            <option value="red" className="bg-card text-foreground">Red</option>
                                            <option value="void" className="bg-card text-foreground">Void</option>
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
                                            className="h-11 w-full rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                                            className="h-11 w-full rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                                          className="h-11 w-full rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                      ) : null}
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
            {hasMoreAnalyses ? (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((current) => current + INITIAL_VISIBLE_ANALYSES)
                  }
                  className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 transition hover:bg-emerald-400/15"
                >
                  Load {Math.min(INITIAL_VISIBLE_ANALYSES, filteredAnalyses.length - visibleCount)} more
                </button>
              </div>
            ) : null}
            </>
          )}
        </div>

      </motion.div>
    </AppLayout>
  );
}
