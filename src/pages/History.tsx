import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { useEffect, useMemo, useState } from "react";
import { getAnalyses, updateAnalysisTracking } from "@/lib/analysisStorage";
import type { SavedAnalysis, BetStatus } from "@/types/analysis";

function getBestBet(results: SavedAnalysis["results"]) {
  if (!Array.isArray(results) || results.length === 0) return null;
  return results.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
}

export default function History() {
  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);

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

  const handleTrackingChange = (
    analysisId: string,
    updates: Partial<SavedAnalysis["tracking"]>
  ) => {
    const updatedAnalyses = updateAnalysisTracking(analysisId, updates);
    setAnalyses(updatedAnalyses);
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Analysis History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review your past analyses and track your bets.
          </p>
        </div>

        <div className="space-y-6">
          {safeAnalyses.length === 0 ? (
            <div className="rounded-xl bg-card ring-surface card-shadow p-8 text-center text-sm text-muted-foreground">
              No analyses found yet. Run your first analysis in Match Analysis.
            </div>
          ) : (
            safeAnalyses.map((analysis) => {
              const bestBet = getBestBet(analysis.results);
              const tracking = analysis.tracking;

              return (
                <div
                  key={analysis.id}
                  className="rounded-xl bg-card ring-surface card-shadow p-5 space-y-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {analysis.homeTeam} vs {analysis.awayTeam}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(analysis.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {bestBet && (
                      <div className="flex flex-wrap gap-3 items-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Best Market</p>
                          <p className="text-sm font-medium text-foreground">{bestBet.market}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Edge</p>
                          <ValueBadge value={bestBet.valueBet} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                          <ConfidenceMeter score={bestBet.confidence} className="w-20" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Decision</p>
                          <DecisionBadge decision={bestBet.decision} />
                        </div>
                      </div>
                    )}
                  </div>

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
                        <option value="" className="bg-card text-foreground">Select market</option>
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
                        className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none"
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
                        className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none"
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
                      <option value="pending" className="bg-card text-foreground">Pending</option>
                      <option value="green" className="bg-card text-foreground">Green</option>
                      <option value="red" className="bg-card text-foreground">Red</option>
                      <option value="void" className="bg-card text-foreground">Void</option>
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
                        className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none"
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