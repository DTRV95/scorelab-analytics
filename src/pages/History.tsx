import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAnalyses,
  updateAnalysisTracking,
  deleteAnalysis,
} from "@/lib/analysisStorage";
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
      className="relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="relative mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            History
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

function MetricBlock({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
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
  const [searchParams] = useSearchParams();
  const highlightedAnalysisId = searchParams.get("analysisId");
  const analysisRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
          description="Refine the history and focus only on the analyses that matter."
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
                  className={`relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition-all duration-300 ${
                    highlightedAnalysisId === analysis.id
                      ? "ring-2 ring-emerald-500/30"
                      : ""
                  }`}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />

                  <div className="relative space-y-5">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(analysis.id)}
                      className="w-full rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.05]"
                    >
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                              Saved Analysis
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
                          <h3 className="mt-2 truncate text-xl font-semibold text-white">
                            {matchLabel}
                          </h3>
                          <p className="mt-1 text-sm text-white/55">
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
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                            <MetricBlock
                              label={tracking.selectedMarket ? "Selected" : "Best"}
                              value={displayBet ? displayBet.market : "-"}
                            />
                            <MetricBlock
                              label="Edge"
                              value={displayBet ? <ValueBadge value={displayBet.valueBet} /> : "-"}
                            />
                            <MetricBlock
                              label="Confidence"
                              value={
                                displayBet ? (
                                  <ConfidenceMeter score={displayBet.confidence} className="w-24" />
                                ) : (
                                  "-"
                                )
                              }
                            />
                            <MetricBlock
                              label="P/L"
                              value={`EUR ${tracking.profitLoss.toFixed(2)}`}
                            />
                            <MetricBlock
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
                        <p className="text-sm text-white/50">
                          {isExpanded
                            ? "Expanded tracking details"
                            : "Expand to update stake, result, bankroll impact and notes."}
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
                      <div className="space-y-5 pt-1">
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
