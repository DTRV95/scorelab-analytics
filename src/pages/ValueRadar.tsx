import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
import { ValueBadge, DecisionBadge, SpecialBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Radar, TrendingUp, Filter, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

interface RadarMatch {
  id: number;
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

const radarData: RadarMatch[] = [
  { id: 1, match: "Arsenal vs Chelsea", league: "Premier League", market: "Over 2.5", odds: 1.80, modelProb: 67.4, impliedProb: 55.6, valueBet: 11.8, confidence: 9, decision: "Bet", badge: "premium-pick", time: "15:00" },
  { id: 2, match: "Liverpool vs Man City", league: "Premier League", market: "BTTS Yes", odds: 1.75, modelProb: 62.1, impliedProb: 57.1, valueBet: 5.0, confidence: 7, decision: "Bet", badge: "high-value", time: "17:30" },
  { id: 3, match: "Barcelona vs Real Madrid", league: "La Liga", market: "Over 3.5", odds: 2.80, modelProb: 42.3, impliedProb: 35.7, valueBet: 6.6, confidence: 7, decision: "Bet", badge: "high-value", time: "20:00" },
  { id: 4, match: "Bayern vs Dortmund", league: "Bundesliga", market: "Over 2.5", odds: 1.55, modelProb: 72.8, impliedProb: 64.5, valueBet: 8.3, confidence: 8, decision: "Bet", time: "18:30" },
  { id: 5, match: "PSG vs Lyon", league: "Ligue 1", market: "BTTS Yes", odds: 1.90, modelProb: 58.4, impliedProb: 52.6, valueBet: 5.8, confidence: 6, decision: "Caution", time: "21:00" },
  { id: 6, match: "Juventus vs AC Milan", league: "Serie A", market: "Under 2.5", odds: 1.95, modelProb: 54.2, impliedProb: 51.3, valueBet: 2.9, confidence: 5, decision: "Caution", time: "20:45" },
  { id: 7, match: "Tottenham vs Newcastle", league: "Premier League", market: "Over 2.5", odds: 2.10, modelProb: 51.8, impliedProb: 47.6, valueBet: 4.2, confidence: 6, decision: "Caution", time: "15:00" },
  { id: 8, match: "Everton vs Brighton", league: "Premier League", market: "BTTS No", odds: 2.15, modelProb: 37.9, impliedProb: 46.5, valueBet: -8.6, confidence: 4, decision: "No Bet", time: "15:00" },
  { id: 9, match: "Man Utd vs Wolves", league: "Premier League", market: "Over 2.5", odds: 1.90, modelProb: 56.2, impliedProb: 52.6, valueBet: 3.6, confidence: 5, decision: "Caution", time: "17:30" },
  { id: 10, match: "Atletico vs Sevilla", league: "La Liga", market: "Under 2.5", odds: 1.70, modelProb: 60.1, impliedProb: 58.8, valueBet: 1.3, confidence: 4, decision: "No Bet", time: "16:00" },
];

type SortKey = "valueBet" | "confidence";
type MarketFilter = "All" | "Over 2.5" | "Over 3.5" | "Under 2.5" | "BTTS Yes" | "BTTS No";

export default function ValueRadar() {
  const [sortBy, setSortBy] = useState<SortKey>("valueBet");
  const [minValue, setMinValue] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("All");
  const [showFilters, setShowFilters] = useState(false);

  const topValue = radarData.reduce((a, b) => a.valueBet > b.valueBet ? a : b);

  const filtered = useMemo(() => {
    return radarData
      .filter(m => m.valueBet >= minValue && m.confidence >= minConfidence)
      .filter(m => marketFilter === "All" || m.market === marketFilter)
      .sort((a, b) => b[sortBy] - a[sortBy]);
  }, [sortBy, minValue, minConfidence, marketFilter]);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Radar className="w-6 h-6 text-primary" strokeWidth={1.5} />
              Value Radar
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time market scanner for betting opportunities.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-1" strokeWidth={1.5} /> Filters
          </Button>
        </div>

        {/* Top Value Today */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-2xl bg-card ring-1 ring-primary/20 p-6 card-glow mb-6 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(142,71%,45%,0.06)_0%,_transparent_70%)]" />
          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Top Value Today</p>
              </div>
              <h3 className="text-xl font-bold text-foreground">{topValue.match}</h3>
              <p className="text-sm text-muted-foreground">{topValue.market} · {topValue.league} · {topValue.time}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Edge</p>
                <p className="text-2xl font-bold font-mono-data text-primary">+{topValue.valueBet}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className="text-2xl font-bold font-mono-data text-foreground">{topValue.confidence}/10</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Odds</p>
                <p className="text-2xl font-bold font-mono-data text-foreground">{topValue.odds}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Matches Scanned" value={radarData.length} mono change="Live" changeType="positive" />
          <StatCard label="Value Bets" value={radarData.filter(m => m.decision === "Bet").length} mono change={`${((radarData.filter(m => m.decision === "Bet").length / radarData.length) * 100).toFixed(0)}% hit rate`} changeType="positive" />
          <StatCard label="Avg. Edge" value={`${(radarData.filter(m => m.valueBet > 0).reduce((s, m) => s + m.valueBet, 0) / radarData.filter(m => m.valueBet > 0).length).toFixed(1)}%`} mono changeType="neutral" />
          <StatCard label="Avg. Confidence" value={(radarData.reduce((s, m) => s + m.confidence, 0) / radarData.length).toFixed(1)} mono changeType="neutral" />
        </div>

        {/* Filters */}
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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filter & Sort</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Sort By</label>
                    <select value={sortBy} onChange={e => setSortBy(e.target.value as SortKey)} className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground bg-transparent focus:outline-none">
                      <option value="valueBet">Highest Value</option>
                      <option value="confidence">Highest Confidence</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Min Value %</label>
                    <input type="number" value={minValue} onChange={e => setMinValue(Number(e.target.value))} className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Min Confidence</label>
                    <input type="number" value={minConfidence} onChange={e => setMinConfidence(Number(e.target.value))} min={0} max={10} className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Market</label>
                    <select value={marketFilter} onChange={e => setMarketFilter(e.target.value as MarketFilter)} className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground bg-transparent focus:outline-none">
                      {["All", "Over 2.5", "Over 3.5", "Under 2.5", "BTTS Yes", "BTTS No"].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Radar Table */}
        <div className="rounded-2xl bg-card ring-surface card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Match", "League", "Market", "Odds", "Model %", "Edge", "Confidence", "Decision", ""].map(h => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3.5">{h}</th>
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
                    className={`border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer group ${m.decision === "Bet" && m.valueBet > 8 ? "bg-primary/[0.02]" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{m.match}</p>
                      <p className="text-xs text-muted-foreground">{m.time}</p>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{m.league}</td>
                    <td className="px-5 py-4 text-sm text-muted-foreground">{m.market}</td>
                    <td className="px-5 py-4 font-mono-data text-sm text-foreground">{m.odds.toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono-data text-sm text-foreground">{m.modelProb.toFixed(1)}%</td>
                    <td className="px-5 py-4"><ValueBadge value={m.valueBet} /></td>
                    <td className="px-5 py-4"><ConfidenceMeter score={m.confidence} className="w-20" /></td>
                    <td className="px-5 py-4"><DecisionBadge decision={m.decision} /></td>
                    <td className="px-5 py-4">{m.badge && <SpecialBadge type={m.badge} />}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-muted-foreground text-sm">No matches match your filters.</p>
            </div>
          )}
        </div>
      </motion.div>
    </AppLayout>
  );
}
