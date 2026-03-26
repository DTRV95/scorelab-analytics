import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  getAnalyses,
  updateAnalysisTracking,
  deleteAnalysis,
} from "@/lib/analysisStorage";
import type { SavedAnalysis, BetStatus } from "@/types/analysis";
import { useSearchParams } from "react-router-dom";

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

  return (
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
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

  useEffect(() => {
    const data = getAnalyses();
    setAnalyses(data);
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
  }, [highlightedAnalysisId, filteredAnalyses]);

  const handleTrackingChange = (
    analysisId: string,
    updates: Partial<SavedAnalysis["tracking"]>
  ) => {
    const updatedAnalyses = updateAnalysisTracking(analysisId, updates);
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

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analysis History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review your past analyses and track your bets.
          </p>
        </div>

        <div className="rounded-xl bg-card ring-surface card-shadow p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <input
              type="text"
              placeholder="Search team or market..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
            />

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as "all" | "pending" | "green" | "red" | "void"
                )
              }
              className="h-10 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
            >
              <option value="all" className="bg-card text-foreground">
                All Status
              </option>
              <option value="pending" className="bg-card text-foreground">
                Pending
              </option>
              <option value="green" className="bg-card text-foreground">
                Greens
              </option>
              <option value="red" className="bg-card text-foreground">
                Reds
              </option>
              <option value="void" className="bg-card text-foreground">
                Voids
              </option>
            </select>

            <select
              value={betPlacedFilter}
              onChange={(e) =>
                setBetPlacedFilter(
                  e.target.value as "all" | "placed" | "not-placed"
                )
              }
              className="h-10 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
            >
              <option value="all" className="bg-card text-foreground">
                All Bets
              </option>
              <option value="placed" className="bg-card text-foreground">
                Bet Placed
              </option>
              <option value="not-placed" className="bg-card text-foreground">
                No Bet Placed
              </option>
            </select>

            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="h-10 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
            >
              <option value="all" className="bg-card text-foreground">
                All Markets
              </option>
              {availableMarkets.map((market) => (
                <option
                  key={market}
                  value={market}
                  className="bg-card text-foreground"
                >
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
              className="h-10 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
            >
              <option value="all" className="bg-card text-foreground">
                All Dates
              </option>
              <option value="today" className="bg-card text-foreground">
                Today
              </option>
              <option value="last7" className="bg-card text-foreground">
                Last 7 Days
              </option>
              <option value="month" className="bg-card text-foreground">
                This Month
              </option>
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
              className="h-10 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
            >
              <option value="newest" className="bg-card text-foreground">
                Newest
              </option>
              <option value="oldest" className="bg-card text-foreground">
                Oldest
              </option>
              <option value="edge" className="bg-card text-foreground">
                Highest Edge
              </option>
              <option value="confidence" className="bg-card text-foreground">
                Highest Confidence
              </option>
              <option value="profitLoss" className="bg-card text-foreground">
                Highest P/L
              </option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatusFilter("pending")}
              className="px-3 py-1 rounded-md text-xs bg-yellow-500/10 text-yellow-400"
            >
              Pending
            </button>
            <button
              onClick={() => setStatusFilter("green")}
              className="px-3 py-1 rounded-md text-xs bg-green-500/10 text-green-400"
            >
              Greens
            </button>
            <button
              onClick={() => setStatusFilter("red")}
              className="px-3 py-1 rounded-md text-xs bg-red-500/10 text-red-400"
            >
              Reds
            </button>
            <button
              onClick={resetFilters}
              className="px-3 py-1 rounded-md text-xs bg-white/5 text-muted-foreground"
            >
              Reset Filters
            </button>

            <span className="ml-auto text-sm text-muted-foreground">
              Showing {filteredAnalyses.length} analyses
            </span>
          </div>
        </div>

        <div className="space-y-6">
          {filteredAnalyses.length === 0 ? (
            <div className="rounded-xl bg-card ring-surface card-shadow p-8 text-center text-sm text-muted-foreground">
              No analyses match the selected filters.
            </div>
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

              return (
                <div
                  key={analysis.id}
                  ref={(el) => {
                    analysisRefs.current[analysis.id] = el;
                  }}
                  className={`rounded-xl bg-card ring-surface card-shadow p-5 space-y-4 transition-all duration-300 ${
                    highlightedAnalysisId === analysis.id
                      ? "ring-2 ring-primary/40 bg-primary/[0.04]"
                      : ""
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {matchLabel}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(analysis.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleDeleteAnalysis(analysis.id, matchLabel)}
                        className="h-9 px-4 rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 text-sm font-medium hover:bg-red-500/15 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {displayBet && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {analysis.tracking.selectedMarket ? "Selected Market" : "Best Market"}
                        </p>
                        <p className="text-sm font-medium text-foreground mt-1">
                          {displayBet.market}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Model Probability</p>
                        <p className="text-sm font-medium text-foreground mt-1">
                          {displayBet.modelProb.toFixed(1)}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Implied Probability</p>
                        <p className="text-sm font-medium text-foreground mt-1">
                          {displayBet.impliedProb.toFixed(1)}%
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Edge</p>
                        <div className="mt-1">
                          <ValueBadge value={displayBet.valueBet} />
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                        <ConfidenceMeter score={displayBet.confidence} className="w-20" />
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground">Decision</p>
                        <div className="mt-1">
                          <DecisionBadge decision={displayBet.decision} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={tracking.betPlaced}
                          onChange={(e) =>
                            handleTrackingChange(analysis.id, {
                              betPlaced: e.target.checked,
                            })
                          }
                        />
                        I placed this bet
                      </label>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Selected Market
                      </label>
                      <select
                        value={tracking.selectedMarket ?? ""}
                        onChange={(e) =>
                          handleTrackingChange(analysis.id, {
                            selectedMarket: e.target.value || null,
                          })
                        }
                        className="w-full h-9 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
                        disabled={!tracking.betPlaced}
                      >
                        <option value="" className="bg-card text-foreground">
                          Select market
                        </option>
                        {analysis.results.map((result) => (
                          <option
                            key={result.market}
                            value={result.market}
                            className="bg-card text-foreground"
                          >
                            {result.market}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
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
                        className="w-full h-9 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
                        disabled={!tracking.betPlaced}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
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
                        className="w-full h-9 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
                        disabled={!tracking.betPlaced}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Result Status
                      </label>
                      <select
                        value={tracking.resultStatus}
                        onChange={(e) =>
                          handleTrackingChange(analysis.id, {
                            resultStatus: e.target.value as BetStatus,
                          })
                        }
                        className="w-full h-9 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
                        disabled={!tracking.betPlaced}
                      >
                        <option value="pending" className="bg-card text-foreground">
                          Pending
                        </option>
                        <option value="green" className="bg-card text-foreground">
                          Green
                        </option>
                        <option value="red" className="bg-card text-foreground">
                          Red
                        </option>
                        <option value="void" className="bg-card text-foreground">
                          Void
                        </option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
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
                        className="w-full h-9 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
                        disabled={!tracking.betPlaced}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Bankroll Before</p>
                      <p className="text-sm font-medium text-foreground">
                        {tracking.bankrollBefore !== null
                          ? tracking.bankrollBefore.toFixed(2)
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Profit / Loss</p>
                      <p className="text-sm font-medium text-foreground">
                        {tracking.profitLoss.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Bankroll After</p>
                      <p className="text-sm font-medium text-foreground">
                        {tracking.bankrollAfter !== null
                          ? tracking.bankrollAfter.toFixed(2)
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tracked Status</p>
                      <p className="text-sm font-medium text-foreground capitalize">
                        {tracking.resultStatus}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}