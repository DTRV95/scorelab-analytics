import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge, TierBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildRadarOpportunities, type RadarOpportunity } from "@/lib/valueRadar";
import { useScoreLabData } from "@/hooks/useScoreLabData";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  readCachedBoard,
  writeCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";
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

const BOARD_DAYS = 7;

type RadarPoint = RadarOpportunity;

type ChartRow = Record<string, string | number | null | undefined>;

const tierOrder: Record<NonNullable<RadarPoint["tier"]> | "unclassified", number> = {
  premium: 0,
  elite: 1,
  bet: 2,
  watchlist: 3,
  discard: 4,
  unclassified: 5,
};

function getTierRank(point: RadarPoint) {
  return tierOrder[point.tier ?? "unclassified"];
}

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
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-6"
    >
      <div className="relative z-10 mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Value Radar
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {badge && (
          <div className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-3 py-1 text-xs text-muted-foreground">
            {badge}
          </div>
        )}
      </div>

      <div className="relative z-10">{children}</div>
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
    <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium text-foreground">{value}</div>
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
    <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-2xl backdrop-blur-md max-w-[260px]">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Radar Point</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{point.match}</p>
      <p className="mt-1 text-sm text-muted-foreground">{point.market}</p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-[hsl(var(--sl-surface))] p-2">
          <p className="text-muted-foreground">Edge</p>
          <p className="font-mono-data text-foreground">{point.edge.toFixed(2)}%</p>
        </div>
        <div className="rounded-lg bg-[hsl(var(--sl-surface))] p-2">
          <p className="text-muted-foreground">Model</p>
          <p className="font-mono-data text-foreground">{point.modelProb.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg bg-[hsl(var(--sl-surface))] p-2">
          <p className="text-muted-foreground">Learned</p>
          <p className="font-mono-data text-foreground">{point.calibratedProb.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg bg-[hsl(var(--sl-surface))] p-2">
          <p className="text-muted-foreground">Confidence</p>
          <p className="font-mono-data text-foreground">{point.confidence.toFixed(1)}</p>
        </div>
        <div className="rounded-lg bg-[hsl(var(--sl-surface))] p-2">
          <p className="text-muted-foreground">Odds</p>
          <p className="font-mono-data text-foreground">{point.odds.toFixed(2)}</p>
        </div>
        <div className="rounded-lg bg-[hsl(var(--sl-surface))] p-2">
          <p className="text-muted-foreground">Kelly</p>
          <p className="font-mono-data text-foreground">{point.kelly.toFixed(2)}%</p>
        </div>
      </div>
    </div>
  );
}

function getResultColor(point: RadarPoint) {
  if (point.calibrationLabel === "Boosted") return "rgba(52,211,153,0.98)";
  if (point.calibrationLabel === "Avoid") return "rgba(248,113,113,0.95)";
  if (point.tier === "premium") return "rgba(168,85,247,0.95)";
  if (point.tier === "elite") return "rgba(56,189,248,0.95)";
  if (point.decision === "Bet") return "rgba(34,197,94,0.95)";
  if (point.decision === "Caution") return "rgba(234,179,8,0.95)";
  return "rgba(148,163,184,0.9)";
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

function RadarLegend() {
  const items = [
    { label: "Learned Boost", color: "rgba(52,211,153,0.98)" },
    { label: "Learned Avoid", color: "rgba(248,113,113,0.95)" },
    { label: "Premium", color: "rgba(168,85,247,0.95)" },
    { label: "Elite", color: "rgba(56,189,248,0.95)" },
    { label: "Bet", color: "rgba(34,197,94,0.95)" },
    { label: "Caution", color: "rgba(234,179,8,0.95)" },
    { label: "No Bet / Other", color: "rgba(148,163,184,0.9)" },
  ];

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2 rounded-full border border-border bg-[hsl(var(--sl-surface))] px-3 py-1.5 text-xs text-muted-foreground"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ValueRadar() {
  const navigate = useNavigate();
  const { analyses, calibrationModel } = useScoreLabData();
  const [tierFilter, setTierFilter] = useState<
    "all" | "premium" | "elite" | "bet" | "watchlist" | "discard"
  >("all");
  const [decisionFilter, setDecisionFilter] = useState<
    "all" | "Bet" | "Caution" | "No Bet"
  >("all");
  const [marketSearch, setMarketSearch] = useState("");
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const todayAnalyses = useMemo(
    () => analyses.filter((analysis) => isToday(analysis.createdAt)),
    [analyses]
  );

  // Same forecast board the Probability page renders, read from its cache
  // first so opening this tab costs nothing when it was computed recently.
  const [board, setBoard] = useState<BoardMatch[]>(
    () => readCachedBoard(BOARD_DAYS)?.matches ?? []
  );
  const [boardLoading, setBoardLoading] = useState(false);

  useEffect(() => {
    if (board.length > 0) return;

    let cancelled = false;
    const controller = new AbortController();
    setBoardLoading(true);

    fetch(buildApiUrl(`/data/probability-board?days=${BOARD_DAYS}`), {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const matches = data.matches ?? [];
        setBoard(matches);
        writeCachedBoard({
          days: BOARD_DAYS,
          matches,
          unavailable: data.unavailable ?? [],
          skipped: data.skipped ?? 0,
        });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBoardLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topProbabilities = useMemo(
    () => [...board].sort((a, b) => b.headline_pct - a.headline_pct).slice(0, 5),
    [board]
  );

  const radarPoints = useMemo<RadarPoint[]>(() => {
    return buildRadarOpportunities(todayAnalyses, calibrationModel);
  }, [calibrationModel, todayAnalyses]);

  const filteredPoints = useMemo(() => {
    return radarPoints
      .filter((point) => {
        if (tierFilter !== "all" && point.tier !== tierFilter) return false;
        if (decisionFilter !== "all" && point.decision !== decisionFilter) return false;

        const search = marketSearch.trim().toLowerCase();
        if (search) {
          const haystack =
            `${point.match} ${point.market} ${point.homeTeam} ${point.awayTeam}`.toLowerCase();
          if (!haystack.includes(search)) return false;
        }

        return true;
      })
      .sort(
        (a, b) =>
          getTierRank(a) - getTierRank(b) ||
          b.calibratedProb - a.calibratedProb ||
          b.edge - a.edge ||
          b.confidence - a.confidence
      );
  }, [radarPoints, tierFilter, decisionFilter, marketSearch]);

  const selectedPoint =
    filteredPoints.find((point) => point.id === selectedPointId) || filteredPoints[0] || null;

  const openPointInSimpleBet = (point: RadarPoint) => {
    const params = new URLSearchParams({
      analysisId: point.id,
      prepareBet: "1",
      market: point.market,
      stake: String(Number(point.stake.toFixed(2))),
      odd: String(Number(point.odds.toFixed(2))),
    });

    navigate(`/history?${params.toString()}`);
  };

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
    const avgLearnedProb =
      total > 0
        ? filteredPoints.reduce((sum, p) => sum + p.calibratedProb, 0) / total
        : 0;

    return {
      total,
      bets,
      cautions,
      avgEdge,
      avgConfidence,
      avgLearnedProb,
    };
  }, [filteredPoints]);

  const tierBreakdown: ChartRow[] = useMemo(() => {
    const map = new Map<string, number>();

    filteredPoints.forEach((point) => {
      const key = point.tier || "unclassified";
      map.set(key, (map.get(key) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([tier, count]) => ({
        tier,
        count,
      }))
      .sort(
        (a, b) =>
          (tierOrder[(a.tier as keyof typeof tierOrder) ?? "unclassified"] ?? 99) -
          (tierOrder[(b.tier as keyof typeof tierOrder) ?? "unclassified"] ?? 99)
      );
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
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="sl-section-title">Value Radar</h1>
            <p className="sl-meta mt-1">
              As previsões mais fortes do modelo, e o edge das análises de hoje
              onde já tens odds.
            </p>
          </div>
        </motion.div>

        {/* The radar below needs odds to compute edge, so it is empty until you
            analyse something. This section is not: it reads the same forecast
            board the Probability page builds, so the page always opens with
            the model's strongest calls and a way into pricing them. */}
        <motion.div variants={fadeUp} className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="sl-section-title text-[15px]">
              Top 5 probabilidades
            </h2>
            <button
              type="button"
              onClick={() => navigate("/probability")}
              className="text-[12px] font-semibold text-primary"
            >
              Ver todos
            </button>
          </div>

          {topProbabilities.length === 0 ? (
            <p className="sl-card px-4 py-4 text-sm text-muted-foreground">
              {boardLoading
                ? "A carregar as previsões dos próximos dias..."
                : "Ainda sem previsões guardadas. Abre a aba Jogos para as calcular."}
            </p>
          ) : (
            <div className="space-y-2">
              {topProbabilities.map((match) => (
                <article
                  key={match.fixture_id}
                  className="sl-card sl-card-interactive flex items-center gap-3 px-4 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {match.home_name} vs {match.away_name}
                    </p>
                    <p className="sl-meta truncate text-[11px]">{match.league}</p>
                  </div>
                  <div className="max-w-[45%] flex-none text-right">
                    <p className="sl-meta text-[11px] leading-snug">
                      {MARKET_LABELS[match.headline_market] ?? match.headline_market}
                    </p>
                    <p className="font-mono-data text-lg font-bold text-[hsl(var(--sl-green))]">
                      {match.headline_pct.toFixed(1)}%
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-2 gap-4 xl:grid-cols-6"
        >
          <MetricBlock label="Visible Points" value={summary.total} />
          <MetricBlock label="Bets" value={summary.bets} />
          <MetricBlock label="Cautions" value={summary.cautions} />
          <MetricBlock label="Avg Edge" value={`${summary.avgEdge.toFixed(2)}%`} />
          <MetricBlock label="Avg Learned %" value={`${summary.avgLearnedProb.toFixed(1)}%`} />
          <MetricBlock label="Avg Confidence" value={summary.avgConfidence.toFixed(2)} />
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
              className="h-11 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              className="h-11 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              className="h-11 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
              className="h-11 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-4 text-sm text-foreground transition hover:bg-[hsl(var(--sl-surface))]"
            >
              Reset Filters
            </button>
          </div>
        </PremiumCard>

        <PremiumCard
          title="Visible Opportunities"
          description="Compact table of today's visible radar points."
          badge="Table"
        >
          {filteredPoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No opportunities from today match the current filters.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-3 pr-4">Match</th>
                    <th className="py-3 pr-4">Market</th>
                    <th className="py-3 pr-4">Model %</th>
                    <th className="py-3 pr-4">Learned %</th>
                    <th className="py-3 pr-4">Learning</th>
                    <th className="py-3 pr-4">Edge</th>
                    <th className="py-3 pr-4">Confidence</th>
                    <th className="py-3 pr-4">Odds</th>
                    <th className="py-3 pr-4">Kelly</th>
                    <th className="py-3 pr-4">Decision</th>
                    <th className="py-3 pr-4">Tier</th>
                    <th className="py-3 pr-4">Track</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPoints.map((point) => (
                    <tr
                      key={point.id}
                      onClick={() => setSelectedPointId(point.id)}
                      className={`cursor-pointer border-t border-border transition-colors hover:bg-[hsl(var(--sl-surface))] ${
                        selectedPoint?.id === point.id ? "bg-[hsl(var(--sl-surface))]" : ""
                      }`}
                    >
                      <td className="py-3 pr-4 font-medium text-foreground">{point.match}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{point.market}</td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {point.modelProb.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-emerald-700">
                        {point.calibratedProb.toFixed(1)}%
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full border border-border bg-[hsl(var(--sl-surface))] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {point.calibrationLabel}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <ValueBadge value={point.edge} />
                      </td>
                      <td className="py-3 pr-4">
                        <ConfidenceMeter score={point.confidence} className="w-24" />
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {point.odds.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 font-mono-data text-foreground">
                        {point.kelly.toFixed(2)}%
                      </td>
                      <td className="py-3 pr-4">
                        <DecisionBadge decision={point.decision} />
                      </td>
                      <td className="py-3 pr-4">
                        {point.tier ? <TierBadge tier={point.tier} /> : "-"}
                      </td>
                      <td className="py-3 pr-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openPointInSimpleBet(point);
                          }}
                          className="h-9 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-400/15"
                        >
                          Simple Bet
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PremiumCard>

        <PremiumCard
          title="Edge vs Confidence Radar"
          description="Bubble position shows edge and confidence. Bubble size scales with Kelly."
          badge="Core View"
        >
          <RadarLegend />
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid
                  stroke="hsl(var(--border))"
                  strokeDasharray="3 3"
                />
                <XAxis
                  type="number"
                  dataKey="edge"
                  name="Edge"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  label={{
                    value: "Edge %",
                    position: "insideBottom",
                    offset: -4,
                    fill: "hsl(var(--muted-foreground))",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="confidence"
                  name="Confidence"
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  label={{
                    value: "Confidence",
                    angle: -90,
                    position: "insideLeft",
                    offset: 8,
                    fill: "hsl(var(--muted-foreground))",
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
                    stroke="hsl(var(--border))"
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="tier"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222,47%,7%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 16,
                      color: "hsl(var(--foreground))",
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
                    stroke="hsl(var(--border))"
                    vertical={false}
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="decision"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222,47%,7%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 16,
                      color: "hsl(var(--foreground))",
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
            <p className="text-sm text-muted-foreground">
              No visible radar points with the current filters.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    Selected Match
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    {selectedPoint.match}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {new Date(selectedPoint.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedPoint.tier && <TierBadge tier={selectedPoint.tier} />}
                  <DecisionBadge decision={selectedPoint.decision} />
                  <ValueBadge value={selectedPoint.edge} />
                  <button
                    type="button"
                    onClick={() => openPointInSimpleBet(selectedPoint)}
                    className="h-9 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-400/15"
                  >
                    Open In Simple Bet
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
                <MetricBlock label="Market" value={selectedPoint.market} />
                <MetricBlock
                  label="Model Probability"
                  value={`${selectedPoint.modelProb.toFixed(1)}%`}
                />
                <MetricBlock
                  label="Learned Probability"
                  value={`${selectedPoint.calibratedProb.toFixed(1)}% · ${selectedPoint.calibrationLabel}`}
                />
                <MetricBlock
                  label="Confidence"
                  value={<ConfidenceMeter score={selectedPoint.confidence} className="w-24" />}
                />
                <MetricBlock label="Odds" value={selectedPoint.odds.toFixed(2)} />
                <MetricBlock label="Kelly" value={`${selectedPoint.kelly.toFixed(2)}%`} />
                <MetricBlock label="Total xG" value={selectedPoint.xg.toFixed(2)} />
                <MetricBlock label="Risk" value={selectedPoint.risk} />
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Learning Read
                </p>
                <p className="mt-2 text-sm leading-6 text-white/68">
                  {selectedPoint.calibrationReasons[0]}
                </p>
              </div>
            </div>
          )}
        </PremiumCard>

      </motion.div>
    </AppLayout>
  );
}
