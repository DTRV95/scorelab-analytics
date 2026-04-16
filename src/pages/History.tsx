import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { ChevronDown, Layers3, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAnalyses,
  updateAnalysisTracking,
  deleteAnalysis,
} from "@/lib/analysisStorage";
import {
  addLegToMultipleDraft,
  clearMultipleDraft,
  createMultipleLeg,
  deleteMultipleBet,
  getMultipleDraft,
  getMultipleMetrics,
  getSavedMultiples,
  removeLegFromMultipleDraft,
  saveMultipleFromDraft,
  updateMultipleTracking,
} from "@/lib/multipleStorage";
import type { SavedAnalysis, BetStatus } from "@/types/analysis";
import { useSearchParams } from "react-router-dom";

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
      className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">
            History
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
    <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        {label}
      </p>
      <div className="mt-1.5 text-sm font-medium text-white">{value}</div>
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
    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function needsTrackingAttention(analysis: SavedAnalysis) {
  const tracking = analysis.tracking;

  if (!tracking.betPlaced) return false;
  if (!tracking.selectedMarket) return true;
  if (tracking.stakeUsed === null || tracking.stakeUsed <= 0) return true;
  if (tracking.oddUsed === null || tracking.oddUsed <= 1) return true;
  return false;
}

function getTrackingMissingFields(analysis: SavedAnalysis) {
  const tracking = analysis.tracking;
  const missing: string[] = [];

  if (!tracking.betPlaced) return missing;
  if (!tracking.selectedMarket) missing.push("market");
  if (tracking.stakeUsed === null || tracking.stakeUsed <= 0) missing.push("stake");
  if (tracking.oddUsed === null || tracking.oddUsed <= 1) missing.push("odd");
  if (!tracking.notes.trim()) missing.push("notes");

  return missing;
}

export default function History() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [multipleDraft, setMultipleDraft] = useState(getMultipleDraft());
  const [savedMultiples, setSavedMultiples] = useState<ReturnType<typeof getSavedMultiples>>([]);
  const [multipleStakeInput, setMultipleStakeInput] = useState("");
  const [showResolvedMultiples, setShowResolvedMultiples] = useState(false);
  const [searchParams] = useSearchParams();
  const highlightedAnalysisId = searchParams.get("analysisId");
  const analysisRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const savedMultiplesRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    setAnalyses(getAnalyses());
    setMultipleDraft(getMultipleDraft());
    setSavedMultiples(getSavedMultiples());
  }, []);

  const refreshMultiples = () => {
    setMultipleDraft(getMultipleDraft());
    setSavedMultiples(getSavedMultiples());
  };

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
          .map((analysis) => analysis.tracking.selectedMarket)
          .filter(Boolean)
      )
    ) as string[];
  }, [safeAnalyses]);

  const filteredAnalyses = useMemo(() => {
    let items = [...safeAnalyses];

    items = items.filter((analysis) => {
      const match = `${analysis.homeTeam} vs ${analysis.awayTeam}`.toLowerCase();
      const market = (analysis.tracking.selectedMarket || "").toLowerCase();
      const search = searchTerm.trim().toLowerCase();

      const matchesSearch =
        search === "" ||
        match.includes(search) ||
        analysis.homeTeam.toLowerCase().includes(search) ||
        analysis.awayTeam.toLowerCase().includes(search) ||
        market.includes(search);

      if (!matchesSearch) return false;

      if (
        statusFilter !== "all" &&
        analysis.tracking.resultStatus !== statusFilter
      ) {
        return false;
      }

      if (betPlacedFilter === "placed" && !analysis.tracking.betPlaced) {
        return false;
      }

      if (betPlacedFilter === "not-placed" && analysis.tracking.betPlaced) {
        return false;
      }

      if (
        marketFilter !== "all" &&
        analysis.tracking.selectedMarket !== marketFilter
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
        return (b.tracking.profitLoss || 0) - (a.tracking.profitLoss || 0);
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

  const handleTrackingChange = (
    analysisId: string,
    updates: Partial<SavedAnalysis["tracking"]>
  ) => {
    const updatedAnalyses = updateAnalysisTracking(analysisId, updates);
    setAnalyses(updatedAnalyses);
  };

  const handleBetPlacedToggle = (analysis: SavedAnalysis, betPlaced: boolean) => {
    if (!betPlaced) {
      handleTrackingChange(analysis.id, { betPlaced: false });
      return;
    }

    const bestBet = getBestBet(analysis.results);

    handleTrackingChange(analysis.id, {
      betPlaced: true,
      selectedMarket: bestBet?.market ?? null,
      stakeUsed: bestBet ? Number(bestBet.stake.toFixed(2)) : null,
      oddUsed: bestBet ? Number(bestBet.odds.toFixed(2)) : null,
    });
  };

  const handleSelectedMarketChange = (
    analysis: SavedAnalysis,
    selectedMarket: string
  ) => {
    const selectedResult =
      analysis.results.find((result) => result.market === selectedMarket) || null;

    handleTrackingChange(analysis.id, {
      selectedMarket: selectedMarket || null,
      oddUsed: selectedResult ? Number(selectedResult.odds.toFixed(2)) : null,
      stakeUsed: selectedResult ? Number(selectedResult.stake.toFixed(2)) : null,
    });
  };

  const autofillTrackingFromBestBet = (analysis: SavedAnalysis) => {
    const bestBet = getBestBet(analysis.results);
    if (!bestBet) return;

    handleTrackingChange(analysis.id, {
      betPlaced: true,
      selectedMarket: bestBet.market,
      oddUsed: Number(bestBet.odds.toFixed(2)),
      stakeUsed: Number(bestBet.stake.toFixed(2)),
    });
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
    const total = filteredAnalyses.length;
    const placed = filteredAnalyses.filter((a) => a.tracking.betPlaced).length;
    const settled = filteredAnalyses.filter((a) =>
      ["green", "red", "void"].includes(a.tracking.resultStatus)
    ).length;
    const greens = filteredAnalyses.filter(
      (a) => a.tracking.resultStatus === "green"
    ).length;
    const reds = filteredAnalyses.filter(
      (a) => a.tracking.resultStatus === "red"
    ).length;
    const needsUpdate = filteredAnalyses.filter(needsTrackingAttention).length;

    return { total, placed, settled, greens, reds, needsUpdate };
  }, [filteredAnalyses]);

  const multipleMetrics = useMemo(
    () => getMultipleMetrics(multipleDraft),
    [multipleDraft]
  );
  const visibleSavedMultiples = useMemo(
    () =>
      showResolvedMultiples
        ? savedMultiples
        : savedMultiples.filter(
            (multiple) => multiple.tracking.resultStatus === "pending"
          ),
    [savedMultiples, showResolvedMultiples]
  );
  const hiddenResolvedMultiplesCount = Math.max(
    0,
    savedMultiples.length - visibleSavedMultiples.length
  );

  const handleAddToMultiple = (
    analysis: SavedAnalysis,
    result: SavedAnalysis["results"][number] | null
  ) => {
    if (!result) return;
    addLegToMultipleDraft(createMultipleLeg(analysis, result));
    refreshMultiples();
  };

  const handleRemoveMultipleLeg = (analysisId: string, market: string) => {
    removeLegFromMultipleDraft(analysisId, market);
    refreshMultiples();
  };

  const handleSaveMultiple = () => {
    const parsedStake =
      multipleStakeInput.trim() === ""
        ? null
        : Number(multipleStakeInput.trim());
    const saved = saveMultipleFromDraft(parsedStake);
    if (!saved) return;
    refreshMultiples();
    setMultipleStakeInput("");
    requestAnimationFrame(() => {
      savedMultiplesRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleMultipleTrackingChange = (
    multipleId: string,
    updates: Partial<ReturnType<typeof getSavedMultiples>[number]["tracking"]>
  ) => {
    updateMultipleTracking(multipleId, updates);
    refreshMultiples();
  };

  const handleDeleteMultiple = (multipleId: string) => {
    deleteMultipleBet(multipleId);
    refreshMultiples();
  };

  const handleMultipleStakeInputChange = (
    multipleId: string,
    rawValue: string,
    fallbackOdds: number
  ) => {
    if (rawValue === "") {
      handleMultipleTrackingChange(multipleId, {
        stakeUsed: null,
      });
      return;
    }

    const parsedStake = Number(rawValue);
    if (Number.isNaN(parsedStake)) return;

    handleMultipleTrackingChange(multipleId, {
      betPlaced: true,
      stakeUsed: parsedStake,
      oddUsed: fallbackOdds,
    });
  };

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-foreground">Analysis History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, filter and track all your saved analyses with the same premium workflow.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
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
          title="Filters & Search"
          description="Filter first, then focus on the picks and tracking states that actually need attention."
          badge="Controls"
        >
          <div className="space-y-4">
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
                onClick={() => setStatusFilter("pending")}
                className="rounded-full border border-yellow-500/20 bg-yellow-500/10 px-3 py-1.5 text-xs text-yellow-300 transition hover:bg-yellow-500/15"
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter("green")}
                className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/15"
              >
                Greens
              </button>
              <button
                onClick={() => setStatusFilter("red")}
                className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/15"
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

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <PremiumCard
            title="Multiple Builder"
            description="Build multiples from saved analyses, check correlation and save the combo only when it still looks disciplined."
            badge="Multiples"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-white">Current legs</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    {multipleDraft.length} selected
                  </span>
                </div>

                {multipleDraft.length === 0 ? (
                  <p className="text-sm text-white/55">
                    Add picks from the analysis cards below to start building a multiple.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {multipleDraft.map((leg) => (
                      <div
                        key={`${leg.analysisId}-${leg.market}`}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium text-white">{leg.match}</p>
                          <p className="mt-1 text-xs text-white/55">
                            {leg.market} · {leg.odds.toFixed(2)} · {leg.confidence.toFixed(1)}/10 confidence
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveMultipleLeg(leg.analysisId, leg.market)
                          }
                          className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/15"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricBlock label="Combined Odds" value={multipleMetrics.combinedOdds ? multipleMetrics.combinedOdds.toFixed(2) : "-"} />
                <MetricBlock label="Model %" value={multipleMetrics.combinedModelProb ? `${multipleMetrics.combinedModelProb.toFixed(2)}%` : "-"} />
                <MetricBlock label="Implied %" value={multipleMetrics.combinedImpliedProb ? `${multipleMetrics.combinedImpliedProb.toFixed(2)}%` : "-"} />
                <MetricBlock label="Confidence" value={multipleMetrics.adjustedConfidence ? `${multipleMetrics.adjustedConfidence.toFixed(1)}/10` : "-"} />
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                  Correlation
                </p>
                <p className="mt-1.5 text-sm font-medium text-white">
                  {multipleMetrics.correlationLevel} ({multipleMetrics.correlationScore})
                </p>
                {multipleMetrics.correlationReasons.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {multipleMetrics.correlationReasons.map((reason) => (
                      <p key={reason} className="text-xs leading-5 text-white/55">
                        {reason}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    No same-game correlation warning detected.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                  Stake To Place (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={multipleStakeInput}
                  onChange={(e) => setMultipleStakeInput(e.target.value)}
                  placeholder={multipleMetrics.recommendedStakeAmount
                    ? multipleMetrics.recommendedStakeAmount.toFixed(2)
                    : "0.00"}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <p className="mt-2 text-xs leading-5 text-white/50">
                  If you enter a stake here, the multiple is saved as already placed and tracking starts immediately.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveMultiple}
                  disabled={multipleDraft.length < 2}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save Multiple
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearMultipleDraft();
                    refreshMultiples();
                  }}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                >
                  Clear Builder
                </button>
              </div>
            </div>
          </PremiumCard>

          <div ref={savedMultiplesRef}>
            <PremiumCard
              title="Saved Multiples"
              description="Your saved combos stay here in order, ready for quick updates without getting buried below the whole history list."
              badge="Tracking"
            >
              {savedMultiples.length === 0 ? (
                <p className="text-sm text-white/55">
                  No saved multiples yet. Build one from your saved analyses.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-sm text-white/60">
                      {showResolvedMultiples
                        ? "Showing all saved multiples."
                        : hiddenResolvedMultiplesCount > 0
                        ? `${hiddenResolvedMultiplesCount} resolved multiples hidden.`
                        : "Showing only open multiples."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowResolvedMultiples((prev) => !prev)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/[0.08]"
                    >
                      {showResolvedMultiples ? "Hide Resolved" : "Show All"}
                    </button>
                  </div>

                  {visibleSavedMultiples.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/55">
                      No open multiples right now.
                    </div>
                  ) : (
                    visibleSavedMultiples.map((multiple) => (
                      <div
                        key={multiple.id}
                        className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                              {multiple.legs.length} legs
                            </span>
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                              {multiple.correlationLevel} correlation
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <MetricBlock
                              label="Combined Odds"
                              value={multiple.combinedOdds.toFixed(2)}
                            />
                            <MetricBlock
                              label="Confidence"
                              value={`${multiple.adjustedConfidence.toFixed(1)}/10`}
                            />
                            <MetricBlock
                              label="P/L"
                              value={`EUR ${multiple.tracking.profitLoss.toFixed(2)}`}
                            />
                          </div>

                          <div className="space-y-1">
                            {multiple.legs.map((leg) => (
                              <p
                                key={`${leg.analysisId}-${leg.market}`}
                                className="text-sm text-white/72"
                              >
                                {leg.match} · {leg.market}
                              </p>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <label className="flex items-center gap-3 text-sm text-white">
                                <input
                                  type="checkbox"
                                  checked={multiple.tracking.betPlaced}
                                  onChange={(e) =>
                                    handleMultipleTrackingChange(multiple.id, {
                                      betPlaced: e.target.checked,
                                      stakeUsed: e.target.checked
                                        ? multiple.tracking.stakeUsed ??
                                          Number(multiple.recommendedStakeAmount.toFixed(2))
                                        : null,
                                      oddUsed: e.target.checked
                                        ? multiple.tracking.oddUsed ??
                                          Number(multiple.combinedOdds.toFixed(2))
                                        : null,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                                />
                                I placed this multiple
                              </label>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                                Stake Used
                              </label>
                              <input
                                type="number"
                                value={multiple.tracking.stakeUsed ?? ""}
                                onChange={(e) =>
                                  handleMultipleStakeInputChange(
                                    multiple.id,
                                    e.target.value,
                                    multiple.tracking.oddUsed ??
                                      Number(multiple.combinedOdds.toFixed(2))
                                  )
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                              />
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                                Result Status
                              </label>
                              <select
                                value={multiple.tracking.resultStatus}
                                onChange={(e) =>
                                  handleMultipleTrackingChange(multiple.id, {
                                    betPlaced: true,
                                    resultStatus: e.target.value as BetStatus,
                                  })
                                }
                                className={`${darkSelectClass} w-full`}
                                style={darkSelectStyle}
                              >
                                <option value="pending" className="bg-slate-900 text-white">Pending</option>
                                <option value="green" className="bg-slate-900 text-white">Green</option>
                                <option value="red" className="bg-slate-900 text-white">Red</option>
                                <option value="void" className="bg-slate-900 text-white">Void</option>
                              </select>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                              <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                                Delete
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteMultiple(multiple.id)}
                                className="h-11 w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/15"
                              >
                                Delete Multiple
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </PremiumCard>
          </div>
        </div>

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
              const selectedMarketData = analysis.tracking.selectedMarket
                ? analysis.results.find(
                    (r) => r.market === analysis.tracking.selectedMarket
                  )
                : null;

              const displayBet = selectedMarketData || getBestBet(analysis.results);
              const tracking = analysis.tracking;
              const matchLabel = `${analysis.homeTeam} vs ${analysis.awayTeam}`;
              const isExpanded = expandedIds.includes(analysis.id);
              const needsAttention = needsTrackingAttention(analysis);
              const missingFields = getTrackingMissingFields(analysis);

              return (
                <motion.div
                  variants={fadeUp}
                  key={analysis.id}
                  ref={(el) => {
                    analysisRefs.current[analysis.id] = el;
                  }}
                  className={`relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.94)_0%,rgba(5,13,30,0.98)_100%)] p-4 shadow-[0_10px_36px_rgba(0,0,0,0.28)] transition-all duration-300 ${
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
                            {tracking.betPlaced ? (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                                Bet Tracked
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
                              label={tracking.selectedMarket ? "Selected" : "Best"}
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
                              value={`EUR ${tracking.profitLoss.toFixed(2)}`}
                            />
                            <InlineStat
                              label="Status"
                              value={<span className="capitalize">{tracking.resultStatus}</span>}
                            />
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {tracking.betPlaced && missingFields.length > 0 ? (
                          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                            Missing: {missingFields.join(", ")}
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
                        {tracking.betPlaced ? (
                          <button
                            type="button"
                            onClick={() => autofillTrackingFromBestBet(analysis)}
                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.08]"
                          >
                            Quick Fill From Best Bet
                          </button>
                        ) : null}
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
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                            <MetricBlock
                              label={tracking.selectedMarket ? "Selected Market" : "Best Market"}
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

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <label className="flex items-center gap-3 text-sm text-white">
                          <input
                            type="checkbox"
                            checked={tracking.betPlaced}
                            onChange={(e) =>
                              handleBetPlacedToggle(analysis, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-white/20 bg-transparent"
                          />
                          I placed this bet
                        </label>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                          Selected Market
                        </label>
                        <select
                          value={tracking.selectedMarket ?? ""}
                          onChange={(e) =>
                            handleSelectedMarketChange(analysis, e.target.value)
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
                              key={result.market}
                              value={result.market}
                              className="bg-slate-900 text-white"
                            >
                              {result.market}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                          Stake Used
                        </label>
                        <input
                          type="number"
                          value={tracking.stakeUsed ?? ""}
                          onChange={(e) =>
                            handleTrackingChange(analysis.id, {
                              stakeUsed:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          disabled={!tracking.betPlaced}
                        />
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                          Odd Used
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={tracking.oddUsed ?? ""}
                          onChange={(e) =>
                            handleTrackingChange(analysis.id, {
                              oddUsed:
                                e.target.value === "" ? null : Number(e.target.value),
                            })
                          }
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          disabled={!tracking.betPlaced}
                        />
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                          Result Status
                        </label>
                        <select
                          value={tracking.resultStatus}
                          onChange={(e) =>
                            handleTrackingChange(analysis.id, {
                              resultStatus: e.target.value as BetStatus,
                            })
                          }
                          className={`${darkSelectClass} w-full`}
                          style={darkSelectStyle}
                          disabled={!tracking.betPlaced}
                        >
                          <option value="pending" className="bg-slate-900 text-white">
                            Pending
                          </option>
                          <option value="green" className="bg-slate-900 text-white">
                            Green
                          </option>
                          <option value="red" className="bg-slate-900 text-white">
                            Red
                          </option>
                          <option value="void" className="bg-slate-900 text-white">
                            Void
                          </option>
                        </select>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <label className="mb-2 block text-xs uppercase tracking-wider text-white/45">
                          Notes
                        </label>
                        <input
                          type="text"
                          value={tracking.notes}
                          onChange={(e) =>
                            handleTrackingChange(analysis.id, {
                              notes: e.target.value,
                            })
                          }
                          className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                          disabled={!tracking.betPlaced}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
