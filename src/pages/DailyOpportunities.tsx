import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, RiskBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { motion } from "framer-motion";
import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getAnalyses } from "@/lib/analysisStorage";
import type { SavedAnalysis, AnalysisResult } from "@/types/analysis";
import { useNavigate } from "react-router-dom";

interface OpportunityItem {
  analysisId: string;
  id: string;
  match: string;
  league: string;
  market: string;
  odds: number;
  modelProb: number;
  valueBet: number;
  confidence: number;
  decision: "Bet" | "No Bet" | "Caution";
  risk: "Low" | "Medium" | "High";
}

function buildOpportunities(analyses: SavedAnalysis[]): OpportunityItem[] {
  const items: OpportunityItem[] = [];

  analyses.forEach((analysis) => {
    analysis.results.forEach((result, index) => {
      items.push({
        analysisId: analysis.id,
        id: `${analysis.id}-${index}-${result.market}`,
        match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
        league: "Saved Analysis",
        market: result.market,
        odds: result.odds,
        modelProb: result.modelProb,
        valueBet: result.valueBet,
        confidence: result.confidence,
        decision: result.decision,
        risk: result.risk,
      });
    });
  });

  return items.sort((a, b) => b.valueBet - a.valueBet);
}

export default function DailyOpportunities() {
  const [minValue, setMinValue] = useState("");
  const [minConf, setMinConf] = useState("");
  const [league, setLeague] = useState("");
  const navigate = useNavigate();
  const analyses = useMemo(() => {
  const allAnalyses = getAnalyses();
  const now = new Date();

  return allAnalyses.filter((analysis) => {
    const analysisDate = new Date(analysis.createdAt);

    return (
      analysisDate.getDate() === now.getDate() &&
      analysisDate.getMonth() === now.getMonth() &&
      analysisDate.getFullYear() === now.getFullYear()
    );
  });
}, []);

  const opportunities = useMemo(() => buildOpportunities(analyses), [analyses]);

  const filtered = useMemo(() => {
  return opportunities
    // 🔥 FILTRO PRINCIPAL (apenas bets)
    .filter((o) => o.decision === "Bet")

    // filtros adicionais
    .filter((o) => {
      if (minValue && o.valueBet < parseFloat(minValue)) return false;
      if (minConf && o.confidence < parseInt(minConf)) return false;
      if (league && !o.league.toLowerCase().includes(league.toLowerCase())) return false;
      return true;
    });
}, [opportunities, minValue, minConf, league]);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Daily Opportunities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ranked opportunities built from analyses saved today.
          </p>
        </div>

        <div className="rounded-xl bg-card ring-surface p-4 card-shadow mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />

            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
                strokeWidth={1.5}
              />
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

            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} opportunities
            </span>
          </div>
        </div>

        <div className="rounded-xl bg-card ring-surface card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Match", "League", "Market", "Odds", "Model %", "Edge", "Conf.", "Risk", "Decision"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-sm text-muted-foreground"
                    >
                      No saved opportunities match your filters yet.
                    </td>
                  </tr>
                ) : (
                  filtered.map((o) => (
                    <tr
                      key={o.id}
                      onClick={() => navigate(`/history?analysisId=${o.analysisId}`)}
                      className="border-t border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3.5 font-medium text-foreground">{o.match}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{o.league}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{o.market}</td>
                      <td className="px-5 py-3.5 font-mono-data text-muted-foreground">
                        {o.odds.toFixed(2)}
                      </td>
                      <td className="px-5 py-3.5 font-mono-data text-foreground">
                        {o.modelProb.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3.5">
                        <ValueBadge value={o.valueBet} />
                      </td>
                      <td className="px-5 py-3.5">
                        <ConfidenceMeter score={o.confidence} className="w-16" />
                      </td>
                      <td className="px-5 py-3.5">
                        <RiskBadge risk={o.risk} />
                      </td>
                      <td className="px-5 py-3.5">
                        <DecisionBadge decision={o.decision} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
