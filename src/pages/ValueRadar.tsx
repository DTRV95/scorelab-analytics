import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
import { ValueBadge, DecisionBadge, SpecialBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Radar, Filter, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { getAnalyses } from "@/lib/analysisStorage";
import type { SavedAnalysis } from "@/types/analysis";
import { useNavigate } from "react-router-dom";

interface RadarMatch {
  id: string;
  analysisId: string;
  match: string;
  league: string;
  market: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  valueBet: number;
  confidence: number;
  decision: "Bet" | "No Bet" | "Caution";
  badge?: "high-value" | "premium-pick";
  time: string;
}

type SortKey = "valueBet" | "confidence";
type MarketFilter =
  | "All"
  | "Over 2.5"
  | "Over 3.5"
  | "Under 2.5"
  | "Under 3.5"
  | "BTTS Yes"
  | "BTTS No";

function getTimeFromCreatedAt(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRadarData(analyses: SavedAnalysis[]): RadarMatch[] {
  const items: RadarMatch[] = [];

  analyses.forEach((analysis) => {
    analysis.results.forEach((result, index) => {
      let badge: RadarMatch["badge"] | undefined;

      if (result.valueBet >= 8 && result.confidence >= 8 && result.decision === "Bet") {
        badge = "premium-pick";
      } else if (result.valueBet >= 5 && result.decision !== "No Bet") {
        badge = "high-value";
      }

      items.push({
        id: `${analysis.id}-${index}-${result.market}`,
        analysisId: analysis.id,
        match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
        league: "Saved Analysis",
        market: result.market,
        odds: result.odds,
        modelProb: result.modelProb,
        impliedProb: result.impliedProb,
        valueBet: result.valueBet,
        confidence: result.confidence,
        decision: result.decision,
        badge,
        time: getTimeFromCreatedAt(analysis.createdAt),
      });
    });
  });

  return items;
}

export default function ValueRadar() {
  const navigate = useNavigate();

  const [sortBy, setSortBy] = useState<SortKey>("valueBet");
  const [minValue, setMinValue] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("All");
  const [showFilters, setShowFilters] = useState(false);

  const analyses = getAnalyses();

  const radarData = useMemo(() => buildRadarData(analyses), [analyses]);

  const topValue = useMemo(() => {
    if (!radarData.length) return null;
    return radarData.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
  }, [radarData]);

  const filtered = useMemo(() => {
    return radarData
      .filter((m) => m.valueBet >= minValue && m.confidence >= minConfidence)
      .filter((m) => marketFilter === "All" || m.market === marketFilter)
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [radarData, sortBy, minValue, minConfidence, marketFilter]);

  const positiveRadarData = radarData.filter((m) => m.valueBet > 0);
  const betDecisions = radarData.filter((m) => m.decision === "Bet");

  const avgEdge =
    positiveRadarData.length > 0
      ? positiveRadarData.reduce((s, m) => s + m.valueBet, 0) / positiveRadarData.length
      : 0;

  const avgConfidence =
    radarData.length > 0
      ? radarData.reduce((s, m) => s + m.confidence, 0) / radarData.length
      : 0;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Radar className="w-6 h-6 text-primary" strokeWidth={1.5} />
              Value Radar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Live scanner built from your saved analyses.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-1" strokeWidth={1.5} /> Filters
          </Button>
        </div>

        {topValue && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => navigate(`/history?analysisId=${topValue.analysisId}`)}
            className="rounded-2xl bg-card ring-1 ring-primary/20 p-6 card-glow mb-6 relative overflow-hidden cursor-pointer hover:bg-white/[0.02] transition-colors"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(142,71%,45%,0.06)_0%,_transparent_70%)]" />
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                    Top Value Pick
                  </p>
                </div>
                <h3 className="text-xl font-bold text-foreground">{topValue.match}</h3>
                <p className="text-sm text-muted-foreground">
                  {topValue.market} · {topValue.league} · {topValue.time}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Edge</p>
                  <p className="text-2xl font-bold font-mono-data text-primary">
                    +{topValue.valueBet.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="text-2xl font-bold font-mono-data text-foreground">
                    {topValue.confidence}/10
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Odds</p>
                  <p className="text-2xl font-bold font-mono-data text-foreground">
                    {topValue.odds.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Markets Scanned"
            value={radarData.length}
            mono
            change={`${analyses.length} saved analyses`}
            changeType="neutral"
          />
          <StatCard
            label="Value Bets"
            value={betDecisions.length}
            mono
            change={
              radarData.length > 0
                ? `${((betDecisions.length / radarData.length) * 100).toFixed(0)}% signal rate`
                : "0% signal rate"
            }
            changeType="positive"
          />
          <StatCard
            label="Avg. Edge"
            value={`${avgEdge.toFixed(1)}%`}
            mono
            changeType="neutral"
          />
          <StatCard
            label="Avg. Confidence"
            value={avgConfidence.toFixed(1)}
            mono
            changeType="neutral"
          />
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mb-6"
            >
              <div className="rounded-2xl bg-card ring-surface p-5 card-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <SlidersHorizontal className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Filter & Sort
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortKey)}
                      className="w-full h-9 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
                    >
                      <option value="valueBet" className="bg-card text-foreground">Highest Value</option>
                      <option value="confidence" className="bg-card text-foreground">Highest Confidence</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Min Value %</label>
                    <input
                      type="number"
                      value={minValue}
                      onChange={(e) => setMinValue(Number(e.target.value))}
                      className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Min Confidence</label>
                    <input
                      type="number"
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(Number(e.target.value))}
                      min={0}
                      max={10}
                      className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Market</label>
                    <select
                      value={marketFilter}
                      onChange={(e) => setMarketFilter(e.target.value as MarketFilter)}
                      className="w-full h-9 px-3 rounded-lg input-surface bg-card text-foreground border border-white/10 focus:outline-none"
                    >
                      {["All", "Over 2.5", "Over 3.5", "Under 2.5", "Under 3.5", "BTTS Yes", "BTTS No"].map((m) => (
                        <option key={m} value={m} className="bg-card text-foreground">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-2xl bg-card ring-surface card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Match", "League", "Market", "Odds", "Model %", "Implied %", "Edge", "Confidence", "Decision", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3.5"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <motion.tr
                    key={m.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => navigate(`/history?analysisId=${m.analysisId}`)}
                    className={`border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer group ${
                      m.decision === "Bet" && m.valueBet > 8 ? "bg-primary/[0.02]" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {m.match}
                      </p>
                      <p className="text-xs text-muted-foreground">{m.time}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{m.league}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{m.market}</td>
                    <td className="px-5 py-4 font-mono-data text-sm text-foreground">
                      {m.odds.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 font-mono-data text-sm text-foreground">
                      {m.modelProb.toFixed(1)}%
                    </td>
                    <td className="px-5 py-4 font-mono-data text-sm text-muted-foreground">
                      {m.impliedProb.toFixed(1)}%
                    </td>
                    <td className="px-5 py-4">
                      <ValueBadge value={m.valueBet} />
                    </td>
                    <td className="px-5 py-4">
                      <ConfidenceMeter score={m.confidence} className="w-20" />
                    </td>
                    <td className="px-5 py-4">
                      <DecisionBadge decision={m.decision} />
                    </td>
                    <td className="px-5 py-4">
                      {m.badge && <SpecialBadge type={m.badge} />}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-muted-foreground text-sm">
                No saved opportunities match your filters yet.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AppLayout>
  );
}