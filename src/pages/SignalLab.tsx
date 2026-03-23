import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { getAnalyses } from "@/lib/analysisStorage";
import * as EliteBetSystem from "@/lib/eliteBetSystem";
import { TierBadge, ValueBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";

export default function SignalLab() {
  const analyses = getAnalyses() || [];

  const [minEdge, setMinEdge] = useState(5);
  const [minConfidence, setMinConfidence] = useState(7);
  const [minKelly, setMinKelly] = useState(1.5);
  const [eliteOnly, setEliteOnly] = useState(false);

  const ranked = useMemo(() => {
    try {
      return EliteBetSystem.buildRankedOpportunities(analyses);
    } catch (error) {
      console.error("SignalLab ranking error:", error);
      return [];
    }
  }, [analyses]);

  const filtered = useMemo(() => {
    return ranked.filter((item) => {
      if (item.valueBet < minEdge) return false;
      if (item.confidence < minConfidence) return false;
      if (item.kelly < minKelly) return false;
      if (eliteOnly && item.tier !== "elite" && item.tier !== "premium") return false;
      return true;
    });
  }, [ranked, minEdge, minConfidence, minKelly, eliteOnly]);

  const premiumCount = filtered.filter((item) => item.tier === "premium").length;
  const eliteCount = filtered.filter((item) => item.tier === "elite").length;
  const avgScore =
    filtered.length > 0
      ? filtered.reduce((sum, item) => sum + item.eliteScore, 0) / filtered.length
      : 0;

  return (
    <AppLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Signal Lab</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test threshold combinations and see how they affect signal quality and volume.
          </p>
        </div>

        <div className="rounded-2xl bg-card ring-surface p-5 card-shadow mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Min Edge %
              </label>
              <input
                type="number"
                value={minEdge}
                onChange={(e) => setMinEdge(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Min Confidence
              </label>
              <input
                type="number"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">
                Min Kelly %
              </label>
              <input
                type="number"
                step="0.1"
                value={minKelly}
                onChange={(e) => setMinKelly(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg input-surface text-sm text-foreground border border-white/10"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground mt-7">
              <input
                type="checkbox"
                checked={eliteOnly}
                onChange={(e) => setEliteOnly(e.target.checked)}
              />
              Elite only
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Signals
            </p>
            <p className="text-2xl font-bold font-mono-data text-foreground mt-1">
              {filtered.length}
            </p>
          </div>

          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Premium
            </p>
            <p className="text-2xl font-bold font-mono-data text-warning mt-1">
              {premiumCount}
            </p>
          </div>

          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Elite
            </p>
            <p className="text-2xl font-bold font-mono-data text-primary mt-1">
              {eliteCount}
            </p>
          </div>

          <div className="rounded-2xl bg-card ring-surface p-4 card-shadow">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Avg Score
            </p>
            <p className="text-2xl font-bold font-mono-data text-foreground mt-1">
              {avgScore.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-card ring-surface overflow-hidden card-shadow">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-white/[0.02] border-b border-white/5">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">Match</th>
                  <th className="px-5 py-3">Market</th>
                  <th className="px-5 py-3">Tier</th>
                  <th className="px-5 py-3">Edge</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Kelly</th>
                  <th className="px-5 py-3">Elite Score</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((item) => (
                    <tr key={item.id} className="border-t border-white/5">
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {item.match}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {item.market}
                      </td>
                      <td className="px-5 py-3.5">
                        <TierBadge tier={item.tier} />
                      </td>
                      <td className="px-5 py-3.5">
                        <ValueBadge value={item.valueBet} />
                      </td>
                      <td className="px-5 py-3.5">
                        <ConfidenceMeter score={item.confidence} className="w-16" />
                      </td>
                      <td className="px-5 py-3.5 font-mono-data text-foreground">
                        {item.kelly.toFixed(1)}%
                      </td>
                      <td className="px-5 py-3.5 font-mono-data text-foreground">
                        {item.eliteScore.toFixed(1)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-sm text-muted-foreground"
                    >
                      No signals match the selected thresholds.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}