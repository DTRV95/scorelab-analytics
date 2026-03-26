import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { useMemo } from "react";
import { getAnalyses } from "@/lib/analysisStorage";
import type { SavedAnalysis, AnalysisResult } from "@/types/analysis";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Target, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

function isTodayLocal(dateString: string) {
  const d = new Date(dateString);
  const now = new Date();

  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function getBestBet(results: AnalysisResult[]) {
  if (!Array.isArray(results) || results.length === 0) return null;

  const positiveBets = results.filter((r) => r.valueBet > 0);
  if (!positiveBets.length) return null;

  return positiveBets.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
}

export default function ValueRadar() {
  const navigate = useNavigate();
  const analyses = getAnalyses();

  const radarData = useMemo(() => {
    const validAnalyses = analyses.filter(
      (analysis) =>
        analysis &&
        Array.isArray(analysis.results) &&
        analysis.results.length > 0 &&
        isTodayLocal(analysis.createdAt)
    );

    const allTodayBestBets = validAnalyses
      .map((analysis) => {
        const bestBet = getBestBet(analysis.results);
        if (!bestBet) return null;

        return {
          analysis,
          bestBet,
        };
      })
      .filter(Boolean) as { analysis: SavedAnalysis; bestBet: AnalysisResult }[];

    const topPick =
      allTodayBestBets.length > 0
        ? allTodayBestBets.reduce((a, b) =>
            a.bestBet.valueBet > b.bestBet.valueBet ? a : b
          )
        : null;

    const todayMatches = validAnalyses.map((analysis) => {
      const bestBet = getBestBet(analysis.results);

      return {
        id: analysis.id,
        homeTeam: analysis.homeTeam,
        awayTeam: analysis.awayTeam,
        createdAt: analysis.createdAt,
        bestBet,
        totalXg: analysis.summary.totalXg,
      };
    });

    return {
      totalAnalysesToday: validAnalyses.length,
      totalPositiveBestBets: allTodayBestBets.length,
      topPick,
      todayMatches,
    };
  }, [analyses]);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8"
      >
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-foreground">Value Radar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Best pick of the day and all matches analyzed today.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Analyses Today
              </p>
              <BarChart3
                className="w-4 h-4 text-muted-foreground"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {radarData.totalAnalysesToday}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Positive Picks
              </p>
              <TrendingUp
                className="w-4 h-4 text-muted-foreground"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {radarData.totalPositiveBestBets}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                Best Edge Today
              </p>
              <Target
                className="w-4 h-4 text-muted-foreground"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {radarData.topPick
                ? `${radarData.topPick.bestBet.valueBet.toFixed(1)}%`
                : "-"}
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          onClick={() =>
            radarData.topPick
              ? navigate(`/history?analysisId=${radarData.topPick.analysis.id}`)
              : undefined
          }
          className={`rounded-2xl bg-card ring-1 ring-primary/10 p-6 card-shadow card-glow relative overflow-hidden transition-colors ${
            radarData.topPick
              ? "cursor-pointer hover:bg-white/[0.02]"
              : ""
          }`}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(142,71%,45%,0.04)_0%,_transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Best Pick of the Day
              </h2>
              <span className="px-2 py-1 rounded-md gradient-primary text-xs font-bold text-primary-foreground">
                HOT
              </span>
            </div>

            {radarData.topPick ? (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">
                    {radarData.topPick.analysis.homeTeam} vs{" "}
                    {radarData.topPick.analysis.awayTeam}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {radarData.topPick.bestBet.market}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {[
                      {
                        label: "Model Prob.",
                        value: `${radarData.topPick.bestBet.modelProb.toFixed(1)}%`,
                        color: "text-foreground",
                      },
                      {
                        label: "Implied Prob.",
                        value: `${radarData.topPick.bestBet.impliedProb.toFixed(1)}%`,
                        color: "text-muted-foreground",
                      },
                      {
                        label: "Value Edge",
                        value: `+${radarData.topPick.bestBet.valueBet.toFixed(1)}%`,
                        color: "text-primary",
                      },
                      {
                        label: "Kelly",
                        value: `${radarData.topPick.bestBet.kelly.toFixed(1)}%`,
                        color: "text-foreground",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-xl bg-white/[0.03] ring-1 ring-white/5 p-3"
                      >
                        <p className="text-xs text-muted-foreground">
                          {item.label}
                        </p>
                        <p
                          className={`text-xl font-bold font-mono-data ${item.color}`}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex-1">
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Confidence
                    </p>
                    <ConfidenceMeter
                      score={radarData.topPick.bestBet.confidence}
                    />
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Decision
                    </p>
                    <DecisionBadge
                      decision={radarData.topPick.bestBet.decision}
                    />
                  </div>

                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">
                      Expected Goals
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {radarData.topPick.analysis.summary.totalXg.toFixed(2)}
                    </p>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Click anywhere on this card to open the analysis.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No positive value pick found today yet.
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="rounded-2xl bg-card ring-surface card-shadow overflow-hidden"
        >
          <div className="p-6 pb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Matches Analyzed Today
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Match
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Best Market
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Edge
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Confidence
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Decision
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    xG
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {radarData.todayMatches.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-sm text-muted-foreground text-center"
                    >
                      No matches analyzed today yet.
                    </td>
                  </tr>
                ) : (
                  radarData.todayMatches.map((item, i) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.04 }}
                      onClick={() => navigate(`/history?analysisId=${item.id}`)}
                      className="border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer"
                    >
                      <td className="px-6 py-3.5 text-sm font-medium text-foreground">
                        {item.homeTeam} vs {item.awayTeam}
                      </td>

                      <td className="px-6 py-3.5 text-sm text-muted-foreground">
                        {item.bestBet ? item.bestBet.market : "-"}
                      </td>

                      <td className="px-6 py-3.5">
                        {item.bestBet ? (
                          <ValueBadge value={item.bestBet.valueBet} />
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-6 py-3.5">
                        {item.bestBet ? (
                          <ConfidenceMeter
                            score={item.bestBet.confidence}
                            className="w-24"
                          />
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-6 py-3.5">
                        {item.bestBet ? (
                          <DecisionBadge decision={item.bestBet.decision} />
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-6 py-3.5 text-sm text-foreground font-mono-data">
                        {item.totalXg.toFixed(2)}
                      </td>

                      <td className="px-6 py-3.5 text-sm text-primary font-medium">
                        Open
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}