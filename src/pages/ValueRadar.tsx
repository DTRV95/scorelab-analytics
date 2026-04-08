import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { getAnalyses } from "@/lib/analysisStorage";
import type { AnalysisResult, SavedAnalysis } from "@/types/analysis";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,
  ComposedChart,
  Bar,
} from "recharts";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

type RadarPoint = {
  id: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  edge: number;
  confidence: number;
  odds: number;
  kelly: number;
  decision: "Bet" | "Caution" | "No Bet";
  tier?: "premium" | "elite" | "bet" | "watchlist" | "discard";
  risk: "Low" | "Medium" | "High";
  createdAt: string;
  xg: number;
  profitLoss?: number;
};

type ChartRow = Record<string, string | number | null | undefined>;

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
            Value Radar
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

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: RadarPoint }>;
}) {
  if (!active || !payload || !payload.length || !payload[0]?.payload) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-2xl border border-white/10 bg-[hsl(222,47%,7%)] px-4 py-3 shadow-2xl backdrop-blur-md max-w-[260px]">
      <p className="text-xs uppercase tracking-wider text-white/45">Radar Point</p>
      <p className="mt-1 text-sm font-semibold text-white">{point.match}</p>
      <p className="mt-1 text-sm text-white/65">{point.market}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-white/[0.03] p-2">
          <p className="text-white/45">Edge</p>
          <p className="font-mono-data text-white">{point.edge.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2">
          <p className="text-white/45">Confidence</p>
          <p className="font-mono-data text-white">{point.confidence.toFixed(1)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2">
          <p className="text-white/45">Odds</p>
          <p className="font-mono-data text-white">{point.odds.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] p-2">
          <p className="text-white/45">Kelly</p>
          <p className="font-mono-data text-white">{point.kelly.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}

function getResultColor(point: RadarPoint) {
  if (point.tier === "premium") return "rgba(168,85,247,0.95)";
  if (point.tier === "elite") return "rgba(56,189,248,0.95)";
  if (point.decision === "Bet") return "rgba(34,197,94,0.95)";
  if (point.decision === "Caution") return "rgba(234,179,8,0.95)";
  return "rgba(148,163,184,0.9)";
}

function getTrackedOrBestResult(analysis: SavedAnalysis): AnalysisResult | null {
  if (analysis.tracking?.selectedMarket) {
    const tracked = analysis.results.find(
      (r) => r.market === analysis.tracking.selectedMarket
    );
    if (tracked) return tracked;
  }

  if (!analysis.results.length) return null;

  return analysis.results.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
}

export default function ValueRadar() {
  const [tierFilter, setTierFilter] = useState<
    "all" | "premium" | "elite" | "bet" | "watchlist" | "discard"
  >("all");
  const [decisionFilter, setDecisionFilter] = useState<
    "all" | "Bet" | "Caution" | "No Bet"
  >("all");
  const [marketSearch, setMarketSearch] = useState("");
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const analyses = getAnalyses();

  const radarPoints = useMemo<RadarPoint[]>(() => {
    return analyses
      .map((analysis) => {
        const result = getTrackedOrBestResult(analysis);
        if (!result) return null;

        return {
          id: analysis.id,
          match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
          homeTeam: analysis.homeTeam,
          awayTeam: analysis.awayTeam,
          market: result.market,
          edge: result.valueBet,
          confidence: result.confidence,
          odds: result.odds,
          kelly: result.kelly,
          decision: result.decision,
          tier: result.tier,
          risk: result.risk,
          createdAt: analysis.createdAt,
          xg: analysis.summary.totalXg,
          profitLoss: analysis.tracking?.profitLoss ?? 0,
        };
      })
      .filter(Boolean) as RadarPoint[];
  }, [analyses]);

  const filteredPoints = useMemo(() => {
    return radarPoints.filter((point) => {
      if (tierFilter !== "all" && point.tier !== tierFilter) return false;
      if (decisionFilter !== "all" && point.decision !== decisionFilter) return false;

      const search = marketSearch.trim().toLowerCase();
      if (search) {
        const haystack =
          `${point.match} ${point.market} ${point.homeTeam} ${point.awayTeam}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  }, [radarPoints, tierFilter, decisionFilter, marketSearch]);

  const selectedPoint =
    filteredPoints.find((point) => point.id === selectedPointId) || filteredPoints[0] || null;

  const summary = useMemo(() => {
    const total = filteredPoints.length;
    const bets = filteredPoints.filter((p) => p.decision === "Bet").length;
    const cautions = filteredPoints.filter((p) => p.decision === "Caution").length;
    const avgEdge =
      total > 0
        ? filteredPoints.reduce((sum, p) => sum + p.edge, 0) / total
        : 0;
    const avgConfidence =
      total > 0
        ? filteredPoints.reduce((sum, p) => sum + p.confidence, 0) / total
        : 0;

    return {
      total,
      bets,
      cautions,
      avgEdge,
      avgConfidence,
    };
  }, [filteredPoints]);

  const tierBreakdown: ChartRow[] = useMemo(() => {
    const map = new Map<string, number>();

    filteredPoints.forEach((point) => {
      const key = point.tier || "unclassified";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries()).map(([tier, count]) => ({
      tier,
      count,
    }));
  }, [filteredPoints]);

  const decisionBreakdown: ChartRow[] = useMemo(() => {
    const map = new Map<string, number>();

    filteredPoints.forEach((point) => {
      map.set(point.decision, (map.get(point.decision) || 0) + 1);
    });

    return Array.from(map.entries()).map(([decision, count]) => ({
      decision,
      count,
    }));
  }, [filteredPoints]);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <motion.div variants={fadeUp}>
          <h1 className="text-2xl font-bold text-foreground">Value Radar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualize your strongest opportunities and compare edge, confidence, odds and decision quality in one place.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5"
        >
          <MetricBlock label="Visible Points" value={summary.total} />
          <MetricBlock label="Bets" value={summary.bets} />
          <MetricBlock label="Cautions" value={summary.cautions} />
          <MetricBlock
            label="Avg Edge"
            value={`${summary.avgEdge.toFixed(2)}%`}
          />
          <MetricBlock
            label="Avg Confidence"
            value={summary.avgConfidence.toFixed(2)}
          />
        </motion.div>

        <PremiumCard
          title="Radar Filters"
          description="Filter the radar to isolate the strongest opportunity zones."
          badge="Controls"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <input
              type="text"
              value={marketSearch}
              onChange={(e) => setMarketSearch(e.target.value)}
              placeholder="Search match or market..."
              className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />

            <select
              value={tierFilter}
              onChange={(e) =>
                setTierFilter(
                  e.target.value as
                    | "all"
                    | "premium"
                    | "elite"
                    | "bet"
                    | "watchlist"
                    | "discard"
                )
              }
              className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="all">All Tiers</option>
              <option value="premium">Premium</option>
              <option value="elite">Elite</option>
              <option value="bet">Bet</option>
              <option value="watchlist">Watchlist</option>
              <option value="discard">Discard</option>
            </select>

            <select
              value={decisionFilter}
              onChange={(e) =>
                setDecisionFilter(e.target.value as "all" | "Bet" | "Caution" | "No Bet")
              }
              className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
              <option value="all">All Decisions</option>
              <option value="Bet">Bet</option>
              <option value="Caution">Caution</option>
              <option value="No Bet">No Bet</option>
            </select>

            <button
              onClick={() => {
                setTierFilter("all");
                setDecisionFilter("all");
                setMarketSearch("");
              }}
              className="h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white/70 transition hover:bg-white/[0.08]"
            >
              Reset Filters
            </button>
          </div>
        </PremiumCard>

        <PremiumCard
          title="Edge vs Confidence Radar"
          description="Bubble position shows edge and confidence. Bubble size scales with Kelly."
          badge="Core View"
        >
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  dataKey="edge"
                  name="Edge"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                  label={{
                    value: "Edge %",
                    position: "insideBottom",
                    offset: -4,
                    fill: "rgba(255,255,255,0.45)",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="confidence"
                  name="Confidence"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                  label={{
                    value: "Confidence",
                    angle: -90,
                    position: "insideLeft",
                    offset: 8,
                    fill: "rgba(255,255,255,0.45)",
                  }}
                />
                <ZAxis type="number" dataKey="kelly" range={[80, 420]} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<CustomTooltip />} />
                <Scatter
                  data={filteredPoints}
                  onClick={(data: RadarPoint) => setSelectedPointId(data.id)}
                >
                  {filteredPoints.map((entry) => (
                    <Cell key={entry.id} fill={getResultColor(entry)} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </PremiumCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <PremiumCard
            title="Tier Distribution"
            description="Shows how visible radar points are distributed by quality tier."
            badge="Breakdown"
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={tierBreakdown}
                  margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="tier"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222,47%,7%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 16,
                      color: "white",
                    }}
                  />
                  <Bar dataKey="count" radius={[12, 12, 12, 12]} maxBarSize={54}>
                    {tierBreakdown.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.tier === "premium"
                            ? "rgba(168,85,247,0.95)"
                            : entry.tier === "elite"
                            ? "rgba(56,189,248,0.95)"
                            : entry.tier === "bet"
                            ? "rgba(34,197,94,0.95)"
                            : entry.tier === "watchlist"
                            ? "rgba(234,179,8,0.95)"
                            : "rgba(148,163,184,0.9)"
                        }
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>

          <PremiumCard
            title="Decision Distribution"
            description="Quick view of how the radar is split across final decisions."
            badge="Decision"
          >
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={decisionBreakdown}
                  margin={{ top: 10, right: 8, left: -12, bottom: 0 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.06)"
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="decision"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "rgba(255,255,255,0.62)", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "rgba(255,255,255,0.50)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222,47%,7%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 16,
                      color: "white",
                    }}
                  />
                  <Bar dataKey="count" radius={[12, 12, 12, 12]} maxBarSize={54}>
                    {decisionBreakdown.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.decision === "Bet"
                            ? "rgba(34,197,94,0.95)"
                            : entry.decision === "Caution"
                            ? "rgba(234,179,8,0.95)"
                            : "rgba(148,163,184,0.9)"
                        }
                      />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </PremiumCard>
        </div>

        <PremiumCard
          title="Selected Opportunity"
          description="Inspect one radar point in detail."
          badge="Focus"
        >
          {!selectedPoint ? (
            <p className="text-sm text-white/60">
              No visible radar points with the current filters.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                    Selected Match
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-white">
                    {selectedPoint.match}
                  </h3>
                  <p className="mt-1 text-sm text-white/55">
                    {new Date(selectedPoint.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedPoint.tier && <TierBadge tier={selectedPoint.tier} />}
                  <DecisionBadge decision={selectedPoint.decision} />
                  <ValueBadge value={selectedPoint.edge} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
                <MetricBlock label="Market" value={selectedPoint.market} />
                <MetricBlock
                  label="Confidence"
                  value={<ConfidenceMeter score={selectedPoint.confidence} className="w-24" />}
                />
                <MetricBlock label="Odds" value={selectedPoint.odds.toFixed(2)} />
                <MetricBlock label="Kelly" value={`${selectedPoint.kelly.toFixed(2)}%`} />
                <MetricBlock label="Total xG" value={selectedPoint.xg.toFixed(2)} />
                <MetricBlock label="Risk" value={selectedPoint.risk} />
              </div>
            </div>
          )}
        </PremiumCard>

        <PremiumCard
          title="Visible Opportunities"
          description="Compact table of the currently visible radar points."
          badge="Table"
        >
          {filteredPoints.length === 0 ? (
            <p className="text-sm text-white/60">
              No opportunities match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-white/5">
                  <tr className="text-left text-xs uppercase tracking-wider text-white/45">
                    <th className="py-3 pr-4">Match</th>
                    <th className="py-3 pr-4">Market</th>
                    <th className="py-3 pr-4">Edge</th>
                    <th className="py-3 pr-4">Confidence</th>
                    <th className="py-3 pr-4">Odds</th>
                    <th className="py-3 pr-4">Kelly</th>
                    <th className="py-3 pr-4">Decision</th>
                    <th className="py-3 pr-4">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoints.map((point) => (
                    <tr
                      key={point.id}
                      onClick={() => setSelectedPointId(point.id)}
                      className={`cursor-pointer border-t border-white/5 transition-colors hover:bg-white/[0.03] ${
                        selectedPoint?.id === point.id ? "bg-white/[0.04]" : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium text-white">{point.match}</td>
                      <td className="py-3 pr-4 text-white/65">{point.market}</td>
                      <td className="py-3 pr-4">
                        <ValueBadge value={point.edge} />
                      </td>
                      <td className="py-3 pr-4">
                        <ConfidenceMeter score={point.confidence} className="w-24" />
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-white">
                        {point.odds.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-white">
                        {point.kelly.toFixed(2)}%
                      </td>
                      <td className="py-3 pr-4">
                        <DecisionBadge decision={point.decision} />
                      </td>
                      <td className="py-3 pr-4">
                        {point.tier ? <TierBadge tier={point.tier} /> : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>
      </motion.div>
    </AppLayout>
  );
}