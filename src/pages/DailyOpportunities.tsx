import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, RiskBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { motion } from "framer-motion";
import { Filter, Search } from "lucide-react";
import { useState } from "react";

const opportunities = [
  { match: "Arsenal vs Chelsea", league: "Premier League", market: "Over 2.5", odds: 1.80, modelProb: 67.4, valueBet: 11.8, confidence: 9, decision: "Bet" as const, risk: "Low" as const },
  { match: "Liverpool vs Man City", league: "Premier League", market: "BTTS", odds: 1.75, modelProb: 62.1, valueBet: 5.0, confidence: 7, decision: "Bet" as const, risk: "Low" as const },
  { match: "Bayern vs Dortmund", league: "Bundesliga", market: "Over 3.5", odds: 2.60, modelProb: 45.2, valueBet: 7.1, confidence: 7, decision: "Bet" as const, risk: "Medium" as const },
  { match: "Barcelona vs Real Madrid", league: "La Liga", market: "Over 2.5", odds: 1.65, modelProb: 72.8, valueBet: 8.3, confidence: 8, decision: "Bet" as const, risk: "Low" as const },
  { match: "PSG vs Marseille", league: "Ligue 1", market: "BTTS", odds: 2.00, modelProb: 54.3, valueBet: 4.2, confidence: 6, decision: "Caution" as const, risk: "Medium" as const },
  { match: "Juventus vs AC Milan", league: "Serie A", market: "Under 2.5", odds: 1.90, modelProb: 58.4, valueBet: 5.8, confidence: 7, decision: "Bet" as const, risk: "Low" as const },
  { match: "Tottenham vs Newcastle", league: "Premier League", market: "Over 2.5", odds: 2.10, modelProb: 49.8, valueBet: -2.1, confidence: 4, decision: "No Bet" as const, risk: "High" as const },
  { match: "Ajax vs PSV", league: "Eredivisie", market: "Over 3.5", odds: 2.80, modelProb: 42.0, valueBet: 9.6, confidence: 8, decision: "Bet" as const, risk: "Medium" as const },
];

export default function DailyOpportunities() {
  const [minValue, setMinValue] = useState("");
  const [minConf, setMinConf] = useState("");
  const [league, setLeague] = useState("");

  const filtered = opportunities.filter((o) => {
    if (minValue && o.valueBet < parseFloat(minValue)) return false;
    if (minConf && o.confidence < parseInt(minConf)) return false;
    if (league && !o.league.toLowerCase().includes(league.toLowerCase())) return false;
    return true;
  });

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Daily Opportunities</h1>
          <p className="text-sm text-muted-foreground mt-1">Today's best value bets ranked by edge and confidence.</p>
        </div>

        {/* Filters */}
        <div className="rounded-xl bg-card ring-surface p-4 card-shadow mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Filter by league..."
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                className="h-8 w-40 pl-8 pr-3 rounded-md input-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <input
              type="number"
              placeholder="Min value %"
              value={minValue}
              onChange={(e) => setMinValue(e.target.value)}
              className="h-8 w-28 px-3 rounded-md input-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <input
              type="number"
              placeholder="Min conf."
              value={minConf}
              onChange={(e) => setMinConf(e.target.value)}
              className="h-8 w-28 px-3 rounded-md input-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} opportunities</span>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl bg-card ring-surface card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Match", "League", "Market", "Odds", "Model %", "Edge", "Conf.", "Risk", "Decision"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o, i) => (
                  <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 font-medium text-foreground">{o.match}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-xs">{o.league}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{o.market}</td>
                    <td className="px-5 py-3.5 font-mono-data text-muted-foreground">{o.odds.toFixed(2)}</td>
                    <td className="px-5 py-3.5 font-mono-data text-foreground">{o.modelProb.toFixed(1)}%</td>
                    <td className="px-5 py-3.5"><ValueBadge value={o.valueBet} /></td>
                    <td className="px-5 py-3.5"><ConfidenceMeter score={o.confidence} className="w-16" /></td>
                    <td className="px-5 py-3.5"><RiskBadge risk={o.risk} /></td>
                    <td className="px-5 py-3.5"><DecisionBadge decision={o.decision} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
