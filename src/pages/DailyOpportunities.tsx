import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, RiskBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { getAnalyses } from "@/lib/analysisStorage";
import {
  buildRankedOpportunities,
  getUniqueBestPerMatch,
  isToday,
} from "@/lib/eliteBetSystem";
import { useNavigate } from "react-router-dom";

export default function DailyOpportunities() {
  const [minValue, setMinValue] = useState("0");
  const [minConf, setMinConf] = useState("0");
  const [league, setLeague] = useState("");
  const [eliteOnly, setEliteOnly] = useState(false);
  const [bestPerMatchOnly, setBestPerMatchOnly] = useState(true);

  const navigate = useNavigate();

  const analyses = useMemo(() => {
    return getAnalyses().filter((analysis) => isToday(analysis.createdAt));
  }, []);

  const opportunities = useMemo(() => {
    const ranked = buildRankedOpportunities(analyses);
    return bestPerMatchOnly ? getUniqueBestPerMatch(ranked) : ranked;
  }, [analyses, bestPerMatchOnly]);

  const filtered = useMemo(() => {
    return opportunities
      .filter((o) => {
        if (eliteOnly && o.tier !== "elite" && o.tier !== "premium") return false;
        if (minValue && o.valueBet < parseFloat(minValue)) return false;
        if (minConf && o.confidence < parseInt(minConf)) return false;
        if (league && !o.league.toLowerCase().includes(league.toLowerCase())) return false;
        return true;
      });
  }, [opportunities, eliteOnly, minValue, minConf, league]);

  const premiumCount = filtered.filter((o) => o.tier === "premium").length;
  const eliteCount = filtered.filter((o) => o.tier === "elite").length;
  const avgEliteScore =
    filtered.length > 0
      ? filtered.reduce((sum, o) => sum + o.eliteScore, 0) / filtered.length
      : 0;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Daily Opportunities</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Today’s ranked betting signals, sorted by quality instead of noise.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Signals Today</p>
            <p className="text-2xl font-bold font-mono-data text-foreground mt-1">{filtered.length}</p>
          </div>
          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Premium</p>
            <p className="text-2xl font-bold font-mono-data text-warning mt-1">{premiumCount}</p>
          </div>
          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Elite</p>
            <p className="text-2xl font-bold font-mono-data text-primary mt-1">{eliteCount}</p>
          </div>
          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Elite Score</p>
            <p className="text-2xl font-bold font-mono-data text-foreground mt-1">
              {avgEliteScore.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card ring-surface p-5 card-shadow mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Search className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filters
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Min Edge %</label>
              <input
                type="number"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Min Confidence</label>
              <input
                type="number"
                value={minConf}
                onChange={(e) => setMinConf(e.target.value)}
                className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">League</label>
              <input
                type="text"
                value={league}
                onChange={(e) => setLeague(e.target.value)}
                placeholder="Saved Analysis"
                className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10 focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground mt-6">
              <input
                type="checkbox"
                checked={eliteOnly}
                onChange={(e) => setEliteOnly(e.target.checked)}
              />
              Elite only
            </label>

            <label className="flex items-center gap-2 text-sm text-foreground mt-6">
              <input
                type="checkbox"
                checked={bestPerMatchOnly}
                onChange={(e) => setBestPerMatchOnly(e.target.checked)}
              />
              Best per match
            </label>
          </div>
        </div>

        <div className="rounded-2xl bg-card ring-surface overflow-hidden card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-sm">
              <thead className="bg-white/[0.02] border-b border-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Match</th>
                  <th className="px-5 py-3">Market</th>
                  <th className="px-5 py-3">Odds</th>
                  <th className="px-5 py-3">Model %</th>
                  <th className="px-5 py-3">Edge</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Risk</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3">Elite Score</th>
                  <th className="px-5 py-3">Decision</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      No ranked signals match your filters yet.
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
                      <td className="px-5 py-3.5 text-muted-foreground">{o.market}</td>
                      <td className="px-5 py-3.5 font-mono-data text-muted-foreground">{o.odds.toFixed(2)}</td>
                      <td className="px-5 py-3.5 font-mono-data text-foreground">{o.modelProb.toFixed(1)}%</td>
                      <td className="px-5 py-3.5"><ValueBadge value={o.valueBet} /></td>
                      <td className="px-5 py-3.5"><ConfidenceMeter score={o.confidence} className="w-16" /></td>
                      <td className="px-5 py-3.5"><RiskBadge risk={o.risk} /></td>
                      <td className="px-5 py-3.5"><TierBadge tier={o.tier} /></td>
                      <td className="px-5 py-3.5 font-mono-data text-foreground">{o.eliteScore.toFixed(1)}</td>
                      <td className="px-5 py-3.5"><DecisionBadge decision={o.decision} /></td>
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
