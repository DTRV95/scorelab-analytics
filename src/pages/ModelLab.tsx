import { AppLayout } from "@/components/layout/AppLayout";
import { HudStateIcon, HudStatusPill } from "@/components/HudLayer";
import { MatchdayHero } from "@/components/MatchdayHero";
import { SystemPulse3D } from "@/components/SystemPulse3D";
import { useScoreLabData } from "@/hooks/useScoreLabData";
import { getLearningDatasetSummary } from "@/lib/learningDataset";
import { getModelAuditSummary } from "@/lib/modelAudit";
import type { ModelAuditMarketResult, SavedAnalysis } from "@/types/analysis";
import { motion } from "framer-motion";
import { useMemo, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

interface AuditRow extends ModelAuditMarketResult {
  analysisId: string;
  match: string;
  league: string;
  createdAt: string;
  finalScore: string;
}

interface SegmentRow {
  label: string;
  samples: number;
  greens: number;
  reds: number;
  hitRate: number;
  avgModelProb: number;
  calibrationGap: number;
  brierScore: number;
  avgEdge: number;
  reliabilityScore: number;
  reliabilityLabel: "Reliable" | "Promising" | "Unstable" | "Learning";
}

interface RecalibrationRule {
  title: string;
  action: string;
  reason: string;
  tone: "emerald" | "amber" | "red" | "cyan";
}

interface DiagnosticCard {
  title: string;
  value: string;
  detail: string;
  tone: "emerald" | "amber" | "red" | "cyan";
}

function PremiumCard({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      variants={fadeUp}
      className="scorelab-stage-3d scorelab-board-3d relative overflow-hidden rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="relative z-10 mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            Model Calibration
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-white/60">
              {description}
            </p>
          ) : null}
        </div>
        {badge ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="relative z-10">{children}</div>
    </motion.section>
  );
}

function MetricBlock({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="scorelab-board-3d scorelab-tilt-3d rounded-2xl border border-white/8 bg-white/[0.035] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
        {label}
      </p>
      <div className="mt-2 font-mono-data text-xl font-semibold text-white">{value}</div>
      <p className="mt-1 text-xs leading-5 text-white/48">{hint}</p>
    </div>
  );
}

function getOddsBand(odds: number): string {
  if (odds < 1.5) return "1.00-1.49";
  if (odds < 1.8) return "1.50-1.79";
  if (odds < 2.2) return "1.80-2.19";
  if (odds < 3) return "2.20-2.99";
  return "3.00+";
}

function getProbabilityBucket(probability: number): string {
  if (probability < 45) return "<45%";
  if (probability < 55) return "45-54%";
  if (probability < 65) return "55-64%";
  if (probability < 75) return "65-74%";
  if (probability < 85) return "75-84%";
  return "85%+";
}

function getConfidenceBucket(confidence: number): string {
  if (confidence < 5) return "<5";
  if (confidence < 6) return "5-5.9";
  if (confidence < 7) return "6-6.9";
  if (confidence < 8) return "7-7.9";
  return "8+";
}

function getEdgeBucket(edge: number): string {
  if (edge < 0) return "<0%";
  if (edge < 3) return "0-2.9%";
  if (edge < 7) return "3-6.9%";
  if (edge < 12) return "7-11.9%";
  return "12%+";
}

function getReliabilityScore({
  samples,
  calibrationGap,
  brierScore,
}: {
  samples: number;
  calibrationGap: number;
  brierScore: number;
}) {
  const sampleScore = Math.min(samples / 20, 1) * 30;
  const gapScore = Math.max(0, 1 - Math.abs(calibrationGap) / 22) * 35;
  const brierScoreComponent = Math.max(0, 1 - brierScore / 0.34) * 35;

  return Number((sampleScore + gapScore + brierScoreComponent).toFixed(0));
}

function getReliabilityLabel(score: number, samples: number): SegmentRow["reliabilityLabel"] {
  if (samples < 8) return "Learning";
  if (score >= 78) return "Reliable";
  if (score >= 62) return "Promising";
  return "Unstable";
}

function flattenAuditRows(analyses: SavedAnalysis[]): AuditRow[] {
  return analyses.flatMap((analysis) => {
    const audit = analysis.modelAudit;
    if (!audit) return [];

    return audit.outcomes
      .filter((outcome) => outcome.outcome === "green" || outcome.outcome === "red")
      .map((outcome) => {
        const sourceResult = analysis.results.find((result) => result.market === outcome.market);
        return {
          ...outcome,
          odds: outcome.odds ?? sourceResult?.odds ?? 0,
          tier: outcome.tier ?? sourceResult?.tier,
          analysisId: analysis.id,
          match: `${analysis.homeTeam} vs ${analysis.awayTeam}`,
          league: analysis.league || "Unspecified",
          createdAt: analysis.createdAt,
          finalScore: `${audit.homeGoals}-${audit.awayGoals}`,
        };
      });
  });
}

function buildSegmentRows(
  rows: AuditRow[],
  getLabel: (row: AuditRow) => string
): SegmentRow[] {
  const map = new Map<string, AuditRow[]>();

  rows.forEach((row) => {
    const label = getLabel(row);
    map.set(label, [...(map.get(label) ?? []), row]);
  });

  return Array.from(map.entries())
    .map(([label, items]) => {
      const greens = items.filter((item) => item.outcome === "green").length;
      const reds = items.filter((item) => item.outcome === "red").length;
      const avgModelProb =
        items.reduce((sum, item) => sum + item.modelProb, 0) / Math.max(items.length, 1);
      const hitRate = (greens / Math.max(items.length, 1)) * 100;
      const brierScore =
        items.reduce((sum, item) => {
          const predicted = item.modelProb / 100;
          const actual = item.outcome === "green" ? 1 : 0;
          return sum + (predicted - actual) ** 2;
        }, 0) / Math.max(items.length, 1);
      const avgEdge = items.reduce((sum, item) => sum + item.valueBet, 0) / Math.max(items.length, 1);
      const calibrationGap = Number((hitRate - avgModelProb).toFixed(1));
      const reliabilityScore = getReliabilityScore({
        samples: items.length,
        calibrationGap,
        brierScore,
      });

      return {
        label,
        samples: items.length,
        greens,
        reds,
        hitRate: Number(hitRate.toFixed(1)),
        avgModelProb: Number(avgModelProb.toFixed(1)),
        calibrationGap,
        brierScore: Number(brierScore.toFixed(3)),
        avgEdge: Number(avgEdge.toFixed(1)),
        reliabilityScore,
        reliabilityLabel: getReliabilityLabel(reliabilityScore, items.length),
      };
    })
    .sort((a, b) => b.samples - a.samples || a.brierScore - b.brierScore);
}

function sortByHitRate(rows: SegmentRow[]): SegmentRow[] {
  return [...rows].sort(
    (a, b) => b.hitRate - a.hitRate || b.samples - a.samples || a.brierScore - b.brierScore
  );
}

function summarizeRows(label: string, rows: AuditRow[]): SegmentRow {
  return buildSegmentRows(rows, () => label)[0] ?? {
    label,
    samples: 0,
    greens: 0,
    reds: 0,
    hitRate: 0,
    avgModelProb: 0,
    calibrationGap: 0,
    brierScore: 0,
    avgEdge: 0,
    reliabilityScore: 0,
    reliabilityLabel: "Learning",
  };
}

function buildDiagnosticCards({
  rows,
  probabilityRows,
}: {
  rows: AuditRow[];
  probabilityRows: SegmentRow[];
}): DiagnosticCard[] {
  const sortedRows = [...rows].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const recentRows = sortedRows.slice(0, 30);
  const baselineRows = sortedRows.slice(30);
  const recent = summarizeRows("Last 30", recentRows);
  const baseline = summarizeRows("Previous", baselineRows.length > 0 ? baselineRows : sortedRows);
  const brierDelta = recent.brierScore - baseline.brierScore;
  const overconfident = probabilityRows
    .filter((row) => row.samples >= 5)
    .sort((a, b) => a.calibrationGap - b.calibrationGap)[0];
  const highEdge = summarizeRows("High edge", rows.filter((row) => row.valueBet >= 7));
  const lowEdge = summarizeRows(
    "Low/mid edge",
    rows.filter((row) => row.valueBet >= 0 && row.valueBet < 7)
  );
  const allAudits = summarizeRows("All audits", rows);
  const edgeLift = highEdge.samples >= 5 && lowEdge.samples >= 5
    ? highEdge.calibrationGap - lowEdge.calibrationGap
    : 0;

  return [
    {
      title: "Recent Calibration Drift",
      value:
        recent.samples < 8
          ? "Learning"
          : brierDelta <= -0.02
          ? "Improving"
          : brierDelta >= 0.02
          ? "Declining"
          : "Stable",
      detail:
        recent.samples < 8
          ? "Not enough recent audits to judge short-term model form."
          : `Last ${recent.samples} audits: ${recent.brierScore.toFixed(3)} Brier vs ${baseline.brierScore.toFixed(3)} baseline.`,
      tone:
        recent.samples < 8
          ? "cyan"
          : brierDelta <= -0.02
          ? "emerald"
          : brierDelta >= 0.02
          ? "red"
          : "amber",
    },
    {
      title: "Overconfidence Index",
      value: overconfident ? `${overconfident.calibrationGap.toFixed(1)}pp` : "Learning",
      detail: overconfident
        ? `${overconfident.label} is the most overconfident probability bucket with ${overconfident.samples} audits.`
        : "No probability bucket has enough sample to flag overconfidence.",
      tone: !overconfident ? "cyan" : overconfident.calibrationGap <= -12 ? "red" : "amber",
    },
    {
      title: "Edge Validation",
      value:
        highEdge.samples < 5 || lowEdge.samples < 5
          ? "Learning"
          : edgeLift >= 4
          ? "Validated"
          : edgeLift <= -4
          ? "Weak"
          : "Neutral",
      detail:
        highEdge.samples < 5 || lowEdge.samples < 5
          ? "High-edge and low-edge samples are still too thin to compare."
          : `High-edge gap is ${highEdge.calibrationGap.toFixed(1)}pp vs ${lowEdge.calibrationGap.toFixed(1)}pp on lower edge zones.`,
      tone:
        highEdge.samples < 5 || lowEdge.samples < 5
          ? "cyan"
          : edgeLift >= 4
          ? "emerald"
          : edgeLift <= -4
          ? "red"
          : "amber",
    },
    {
      title: "Market Reliability",
      value: `${allAudits.reliabilityScore}/100`,
      detail: "Reliability blends sample size, calibration gap and Brier score so hit rate does not dominate the read.",
      tone:
        allAudits.reliabilityScore >= 78
          ? "emerald"
          : allAudits.reliabilityScore >= 62
          ? "amber"
          : "cyan",
    },
  ];
}

function getSegmentTone(row: SegmentRow): "emerald" | "amber" | "red" | "cyan" {
  if (row.samples < 5) return "cyan";
  if (row.calibrationGap < -12 || row.brierScore > 0.28) return "red";
  if (Math.abs(row.calibrationGap) > 8) return "amber";
  return "emerald";
}

function buildInsights(rows: AuditRow[], segments: SegmentRow[]) {
  const strong = segments.filter((item) => item.samples >= 5 && item.calibrationGap >= -5 && item.hitRate >= item.avgModelProb - 5);
  const weak = segments.filter((item) => item.samples >= 5 && (item.calibrationGap < -12 || item.brierScore > 0.28));
  const highConfidence = buildSegmentRows(rows, (row) => getConfidenceBucket(row.confidence)).find(
    (item) => item.label === "8+"
  );
  const premiumRows = rows.filter((row) => row.decision === "Bet" || row.tier === "premium" || row.tier === "elite");
  const premiumSegment = buildSegmentRows(premiumRows, () => "Approved / Elite decisions")[0] ?? null;

  return [
    strong[0]
      ? `Best current calibration zone: ${strong[0].label} with ${strong[0].hitRate.toFixed(1)}% hit rate and ${strong[0].brierScore.toFixed(3)} Brier.`
      : "No strongly validated calibration zone yet. Keep adding final scores before trusting narrow conclusions.",
    weak[0]
      ? `Caution zone: ${weak[0].label} is underperforming its model probability by ${Math.abs(weak[0].calibrationGap).toFixed(1)} percentage points.`
      : "No major overconfidence pocket has enough sample yet.",
    highConfidence && highConfidence.samples >= 5
      ? `High confidence checks are running at ${highConfidence.hitRate.toFixed(1)}% versus ${highConfidence.avgModelProb.toFixed(1)}% expected.`
      : "High-confidence sample is still too small to judge calibration.",
    premiumSegment && premiumSegment.samples >= 5
      ? `Approved/elite decisions show ${premiumSegment.hitRate.toFixed(1)}% paper hit rate across ${premiumSegment.samples} audited markets.`
      : "Approved/elite paper sample is not deep enough yet.",
  ];
}

function buildRecalibrationRules({
  rows,
  marketRows,
  probabilityRows,
  confidenceRows,
  oddsRows,
  edgeRows,
}: {
  rows: AuditRow[];
  marketRows: SegmentRow[];
  probabilityRows: SegmentRow[];
  confidenceRows: SegmentRow[];
  oddsRows: SegmentRow[];
  edgeRows: SegmentRow[];
}): RecalibrationRule[] {
  if (rows.length === 0) {
    return [
      {
        title: "No audit base yet",
        action: "Add final scores before recalibrating the model.",
        reason: "The system needs audited outcomes to separate real edge from noise.",
        tone: "cyan",
      },
    ];
  }

  const allSegments = [...marketRows, ...probabilityRows, ...confidenceRows, ...oddsRows, ...edgeRows];
  const matureSegments = allSegments.filter((segment) => segment.samples >= 8);
  const weakSegments = matureSegments
    .filter((segment) => segment.calibrationGap <= -10 || segment.brierScore >= 0.28)
    .sort((a, b) => a.calibrationGap - b.calibrationGap || b.brierScore - a.brierScore);
  const strongSegments = matureSegments
    .filter((segment) => segment.calibrationGap >= -4 && segment.brierScore <= 0.23)
    .sort((a, b) => b.hitRate - a.hitRate || a.brierScore - b.brierScore);
  const overconfidentProbability = probabilityRows
    .filter((segment) => segment.samples >= 8 && segment.calibrationGap <= -10)
    .sort((a, b) => a.calibrationGap - b.calibrationGap)[0];
  const highEdgeFail = edgeRows
    .filter((segment) => segment.samples >= 8 && segment.avgEdge >= 7 && segment.calibrationGap <= -8)
    .sort((a, b) => a.calibrationGap - b.calibrationGap)[0];
  const thinSampleRate = allSegments.filter((segment) => segment.samples > 0 && segment.samples < 8).length;

  const rules: RecalibrationRule[] = [];

  if (weakSegments[0]) {
    rules.push({
      title: `Reduce trust in ${weakSegments[0].label}`,
      action: "Lower confidence or require stronger edge before approving this zone.",
      reason: `${weakSegments[0].samples} audited markets are running ${Math.abs(weakSegments[0].calibrationGap).toFixed(1)}pp below model expectation.`,
      tone: "red",
    });
  }

  if (strongSegments[0]) {
    rules.push({
      title: `Protect ${strongSegments[0].label}`,
      action: "Keep this zone eligible for premium recommendations while the sample keeps growing.",
      reason: `${strongSegments[0].hitRate.toFixed(1)}% hit rate with ${strongSegments[0].brierScore.toFixed(3)} Brier across ${strongSegments[0].samples} audits.`,
      tone: "emerald",
    });
  }

  if (overconfidentProbability) {
    rules.push({
      title: "Probability correction needed",
      action: "Apply a small probability haircut to this bucket until the gap closes.",
      reason: `${overconfidentProbability.label} predictions are converting below their expected probability.`,
      tone: "amber",
    });
  }

  if (highEdgeFail) {
    rules.push({
      title: "Edge is not enough here",
      action: "Do not promote this edge bucket unless confidence and odds zone also agree.",
      reason: `Average edge is ${highEdgeFail.avgEdge.toFixed(1)}%, but real conversion is lagging by ${Math.abs(highEdgeFail.calibrationGap).toFixed(1)}pp.`,
      tone: "amber",
    });
  }

  if (thinSampleRate > 0 || matureSegments.length < 4) {
    rules.push({
      title: "Sample discipline",
      action: "Treat high hit rates with fewer than 8 audits as exploratory, not proven.",
      reason: `${thinSampleRate} active segments still have a thin sample, so the model should avoid hard conclusions.`,
      tone: "cyan",
    });
  }

  return rules.slice(0, 4);
}

function SegmentTable({ rows }: { rows: SegmentRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-white/5">
            <tr className="text-left text-xs uppercase tracking-wide text-white/45">
              <th className="px-4 py-3">Segment</th>
              <th className="px-4 py-3">Samples</th>
              <th className="px-4 py-3">Hit</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Gap</th>
              <th className="px-4 py-3">Brier</th>
              <th className="px-4 py-3">Edge</th>
              <th className="px-4 py-3">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const tone = getSegmentTone(row);
              const toneClass =
                tone === "emerald"
                  ? "text-emerald-300"
                  : tone === "red"
                  ? "text-red-300"
                  : tone === "amber"
                  ? "text-amber-300"
                  : "text-cyan-300";

              return (
                <tr key={row.label} className="border-t border-white/5 text-white hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white/88">{row.label}</td>
                  <td className="px-4 py-3 font-mono-data">{row.samples}</td>
                  <td className="px-4 py-3 font-mono-data">{row.hitRate.toFixed(1)}%</td>
                  <td className="px-4 py-3 font-mono-data">{row.avgModelProb.toFixed(1)}%</td>
                  <td className={`px-4 py-3 font-mono-data ${toneClass}`}>
                    {row.calibrationGap > 0 ? "+" : ""}
                    {row.calibrationGap.toFixed(1)}pp
                  </td>
                  <td className="px-4 py-3 font-mono-data">{row.brierScore.toFixed(3)}</td>
                  <td className="px-4 py-3 font-mono-data">{row.avgEdge.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      row.reliabilityLabel === "Reliable"
                        ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200"
                        : row.reliabilityLabel === "Promising"
                        ? "border-cyan-300/20 bg-cyan-300/[0.08] text-cyan-200"
                        : row.reliabilityLabel === "Unstable"
                        ? "border-red-300/20 bg-red-300/[0.08] text-red-200"
                        : "border-white/10 bg-white/[0.04] text-white/50"
                    }`}>
                      {row.reliabilityLabel} · {row.reliabilityScore}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ModelLab() {
  const { analyses } = useScoreLabData();
  const summary = useMemo(() => getModelAuditSummary(analyses), [analyses]);
  const rows = useMemo(() => flattenAuditRows(analyses), [analyses]);
  const probabilityRows = useMemo(
    () => buildSegmentRows(rows, (row) => getProbabilityBucket(row.modelProb)),
    [rows]
  );
  const confidenceRows = useMemo(
    () => buildSegmentRows(rows, (row) => getConfidenceBucket(row.confidence)),
    [rows]
  );
  const oddsRows = useMemo(
    () => buildSegmentRows(rows, (row) => getOddsBand(row.odds ?? 0)),
    [rows]
  );
  const edgeRows = useMemo(
    () => buildSegmentRows(rows, (row) => getEdgeBucket(row.valueBet)),
    [rows]
  );
  const marketRows = useMemo(
    () => sortByHitRate(buildSegmentRows(rows, (row) => row.market)).slice(0, 12),
    [rows]
  );
  const confidenceTableRows = useMemo(() => sortByHitRate(confidenceRows), [confidenceRows]);
  const edgeTableRows = useMemo(() => sortByHitRate(edgeRows), [edgeRows]);
  const insights = useMemo(
    () => buildInsights(rows, [...marketRows, ...probabilityRows, ...confidenceRows, ...oddsRows]),
    [confidenceRows, marketRows, oddsRows, probabilityRows, rows]
  );
  const recalibrationRules = useMemo(
    () =>
      buildRecalibrationRules({
        rows,
        marketRows,
        probabilityRows,
        confidenceRows,
        oddsRows,
        edgeRows,
      }),
    [confidenceRows, edgeRows, marketRows, oddsRows, probabilityRows, rows]
  );
  const diagnosticCards = useMemo(
    () => buildDiagnosticCards({ rows, probabilityRows }),
    [probabilityRows, rows]
  );
  const learningSummary = useMemo(() => getLearningDatasetSummary(analyses), [analyses]);
  const calibrationTone =
    summary.auditedMarkets < 40
      ? "cyan"
      : summary.brierScore <= 0.21
      ? "emerald"
      : summary.brierScore <= 0.27
      ? "amber"
      : "red";

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <MatchdayHero
          eyebrow="Model Lab"
          tone={calibrationTone === "red" ? "amber" : "cyan"}
          statusIcon={<HudStateIcon state={summary.auditedMarkets > 0 ? "online" : "scanning"} />}
          title="Calibration Intelligence"
          description="Use final-score audits to understand where the model is sharp, overconfident, underpriced or still learning."
          statusItems={
            <>
              <HudStatusPill
                label={`${summary.auditedMatches} Matches`}
                tone="cyan"
                icon={<HudStateIcon state="scanning" />}
              />
              <HudStatusPill
                label={`${summary.hitRate.toFixed(1)}% Paper Hit`}
                tone={summary.hitRate >= summary.avgModelProb - 5 ? "emerald" : "amber"}
                icon={<HudStateIcon state={summary.hitRate >= summary.avgModelProb - 5 ? "online" : "risk"} />}
              />
              <HudStatusPill
                label={`Brier ${summary.brierScore.toFixed(3)}`}
                tone={calibrationTone}
                icon={<HudStateIcon state={calibrationTone === "red" ? "risk" : "online"} />}
              />
            </>
          }
          visual={
            <SystemPulse3D
              label="Calibration Pulse"
              value={`${summary.brierScore.toFixed(3)} Brier`}
              detail={`${summary.auditedMarkets} audited market outcomes. Lower Brier means tighter probability calibration.`}
              tone={calibrationTone}
            />
          }
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <MetricBlock
            label="Audited Markets"
            value={summary.auditedMarkets}
            hint={`${summary.auditedMatches} final-score audits`}
          />
          <MetricBlock
            label="Paper Hit Rate"
            value={`${summary.hitRate.toFixed(1)}%`}
            hint={`${summary.greens} green / ${summary.reds} red`}
          />
          <MetricBlock
            label="Expected Probability"
            value={`${summary.avgModelProb.toFixed(1)}%`}
            hint="Average model probability"
          />
          <MetricBlock
            label="Calibration Gap"
            value={`${(summary.hitRate - summary.avgModelProb).toFixed(1)}pp`}
            hint="Actual hit rate minus expected hit rate"
          />
        </div>

        <PremiumCard
          title="Learning Dataset"
          description="Machine learning readiness based on audited market outcomes. This is the training base before any ML model is allowed to influence decisions."
          badge={learningSummary.readiness.level}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <MetricBlock
              label="Training Rows"
              value={learningSummary.readiness.rows}
              hint="One row per audited market outcome"
            />
            <MetricBlock
              label="Coverage"
              value={`${learningSummary.readiness.markets} / ${learningSummary.readiness.leagues}`}
              hint="Markets / leagues represented"
            />
            <MetricBlock
              label="ML Readiness"
              value={`${learningSummary.readiness.readinessScore}/100`}
              hint={learningSummary.readiness.level}
            />
            <MetricBlock
              label="Learning Verdict"
              value={learningSummary.readiness.level}
              hint={learningSummary.readiness.recommendation}
            />
          </div>
          <div className="mt-4 rounded-2xl border border-cyan-300/12 bg-cyan-300/[0.035] p-4 text-sm leading-6 text-white/62">
            The next ML step should only train a lightweight, interpretable model when this dataset reaches
            enough volume. Until then, ScoreLab keeps using the mathematical model plus guarded calibration.
          </div>
        </PremiumCard>

        <PremiumCard
          title="Analytical Guardrails"
          description="Checks designed to stop the lab from over-trusting raw hit rate or old aggregate data."
          badge="Critical Read"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {diagnosticCards.map((card) => {
              const toneClass =
                card.tone === "emerald"
                  ? "border-emerald-300/18 bg-emerald-300/[0.045]"
                  : card.tone === "red"
                  ? "border-red-300/18 bg-red-300/[0.045]"
                  : card.tone === "amber"
                  ? "border-amber-300/18 bg-amber-300/[0.045]"
                  : "border-cyan-300/18 bg-cyan-300/[0.045]";

              return (
                <div key={card.title} className={`rounded-2xl border p-4 ${toneClass}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/42">
                    {card.title}
                  </p>
                  <p className="mt-2 font-mono-data text-xl font-semibold text-white">
                    {card.value}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-white/54">{card.detail}</p>
                </div>
              );
            })}
          </div>
        </PremiumCard>

        <PremiumCard
          title="Recalibration Read"
          description="A compact interpretation of what the audited results are saying."
          badge="Strategy"
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {insights.map((insight, index) => (
              <div
                key={insight}
                className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 text-sm leading-6 text-white/68"
              >
                <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-cyan-200/20 text-[10px] text-cyan-100/70">
                  {index + 1}
                </span>
                {insight}
              </div>
            ))}
          </div>
        </PremiumCard>

        <PremiumCard
          title="Recalibration Rules"
          description="Practical model adjustments suggested by audited outcomes, sample size and calibration gaps."
          badge="Rules"
        >
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {recalibrationRules.map((rule) => {
              const toneClass =
                rule.tone === "emerald"
                  ? "border-emerald-300/18 bg-emerald-300/[0.045] text-emerald-100"
                  : rule.tone === "red"
                  ? "border-red-300/18 bg-red-300/[0.045] text-red-100"
                  : rule.tone === "amber"
                  ? "border-amber-300/18 bg-amber-300/[0.045] text-amber-100"
                  : "border-cyan-300/18 bg-cyan-300/[0.045] text-cyan-100";

              return (
                <div
                  key={`${rule.title}-${rule.action}`}
                  className={`rounded-2xl border p-4 ${toneClass}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-55">
                        Suggested Rule
                      </p>
                      <h3 className="mt-2 text-base font-semibold text-white">{rule.title}</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/58">
                      {rule.tone}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium leading-6 text-white/82">{rule.action}</p>
                  <p className="mt-2 text-xs leading-5 text-white/52">{rule.reason}</p>
                </div>
              );
            })}
          </div>
        </PremiumCard>

        {rows.length === 0 ? (
          <PremiumCard
            title="No Audit Data Yet"
            description="Go to Simple Bet, open analysed matches, insert final scores, and this page will become the calibration lab."
            badge="Empty"
          >
            <p className="text-sm leading-6 text-white/60">
              This page does not need real-money bets. It only needs final scores from analysed games.
            </p>
          </PremiumCard>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <PremiumCard title="Probability Calibration" description="Checks whether 75-84% predictions really behave like 75-84% outcomes.">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={probabilityRows}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(222,47%,7%)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 14,
                          color: "white",
                        }}
                      />
                      <Bar dataKey="avgModelProb" name="Expected %" fill="rgba(56,189,248,0.55)" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="hitRate" name="Actual %" fill="rgba(34,197,94,0.82)" radius={[8, 8, 0, 0]} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </PremiumCard>

              <PremiumCard title="Odds Zone Truth" description="Shows which odds ranges are behaving cleanly after final-score validation.">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={oddsRows}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(222,47%,7%)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 14,
                          color: "white",
                        }}
                      />
                      <Bar dataKey="brierScore" name="Brier score" radius={[8, 8, 0, 0]}>
                        {oddsRows.map((row) => (
                          <Cell
                            key={row.label}
                            fill={
                              row.brierScore <= 0.21
                                ? "rgba(34,197,94,0.82)"
                                : row.brierScore <= 0.27
                                ? "rgba(251,191,36,0.82)"
                                : "rgba(248,113,113,0.82)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </PremiumCard>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <PremiumCard title="Markets" description="Paper performance by market, independent from money placed.">
                <SegmentTable rows={marketRows} />
              </PremiumCard>

              <PremiumCard title="Confidence" description="Validates confidence levels.">
                <SegmentTable rows={confidenceTableRows} />
              </PremiumCard>

              <PremiumCard title="Edge" description="Checks whether higher edge buckets are really converting.">
                <SegmentTable rows={edgeTableRows} />
              </PremiumCard>
            </div>
          </>
        )}
      </motion.div>
    </AppLayout>
  );
}
