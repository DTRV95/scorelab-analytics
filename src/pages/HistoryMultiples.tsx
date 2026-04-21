import { AppLayout } from "@/components/layout/AppLayout";
import { Layers3, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MULTIPLES_UPDATED_EVENT,
  clearMultipleDraft,
  deleteMultipleBet,
  getMultipleDraft,
  getMultipleMetrics,
  getSavedMultiples,
  removeLegFromMultipleDraft,
  saveMultipleFromDraft,
  updateMultipleLegStatus,
  updateMultipleTracking,
} from "@/lib/multipleStorage";
import type { BetStatus } from "@/types/analysis";

const darkSelectClass =
  "h-11 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30";

const darkSelectStyle = {
  backgroundColor: "#0f172a",
  color: "white",
  colorScheme: "dark" as const,
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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
      className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_30%),radial-gradient(circle_at_top_left,rgba(34,197,94,0.06),transparent_25%)]" />
      <div className="relative mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/42">
            Multiples Bet
          </p>
          <h2 className="mt-2 text-base font-semibold text-white md:text-lg">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-6 text-white/58">{description}</p>
          ) : null}
        </div>

        {badge ? (
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">
            {badge}
          </div>
        ) : null}
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
    <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.025)_100%)] px-3.5 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
      <div className="mb-2 h-1.5 w-10 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9)_0%,rgba(34,197,94,0.8)_100%)]" />
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
        {label}
      </p>
      <div className="mt-1.5 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function InlineStat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/38">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium text-white">{value}</div>
    </div>
  );
}

function ActiveFilterPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "emerald" | "amber" | "cyan";
}) {
  const toneClasses =
    tone === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
      : tone === "amber"
      ? "border-amber-400/20 bg-amber-400/10 text-amber-200"
      : tone === "cyan"
      ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200"
      : "border-white/10 bg-white/[0.04] text-white/65";

  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.04em] ${toneClasses}`}
    >
      {label}
    </span>
  );
}

export default function HistoryMultiples() {
  const [multipleDraft, setMultipleDraft] = useState(getMultipleDraft());
  const [savedMultiples, setSavedMultiples] = useState<ReturnType<typeof getSavedMultiples>>([]);
  const [multipleStakeInput, setMultipleStakeInput] = useState("");
  const [showResolvedMultiples, setShowResolvedMultiples] = useState(false);
  const [showPlacedOnly, setShowPlacedOnly] = useState(false);
  const savedMultiplesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMultipleDraft(getMultipleDraft());
    setSavedMultiples(getSavedMultiples());

    const handleMultiplesUpdated = () => {
      setMultipleDraft(getMultipleDraft());
      setSavedMultiples(getSavedMultiples());
    };

    window.addEventListener(MULTIPLES_UPDATED_EVENT, handleMultiplesUpdated);
    return () => {
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, handleMultiplesUpdated);
    };
  }, []);

  const refreshMultiples = () => {
    setMultipleDraft(getMultipleDraft());
    setSavedMultiples(getSavedMultiples());
  };

  const multipleMetrics = useMemo(
    () => getMultipleMetrics(multipleDraft),
    [multipleDraft]
  );

  const visibleSavedMultiples = useMemo(
    () =>
      (showResolvedMultiples
        ? savedMultiples
        : savedMultiples.filter((multiple) => multiple.tracking.resultStatus === "pending")
      ).filter((multiple) => (showPlacedOnly ? multiple.tracking.betPlaced : true)),
    [savedMultiples, showResolvedMultiples, showPlacedOnly]
  );

  const hiddenResolvedMultiplesCount = Math.max(
    0,
    savedMultiples.length - visibleSavedMultiples.length
  );

  const handleRemoveMultipleLeg = (analysisId: string, market: string) => {
    removeLegFromMultipleDraft(analysisId, market);
    refreshMultiples();
  };

  const handleSaveMultiple = () => {
    const parsedStake =
      multipleStakeInput.trim() === "" ? null : Number(multipleStakeInput.trim());
    const saved = saveMultipleFromDraft(parsedStake);
    if (!saved) return;
    refreshMultiples();
    setMultipleStakeInput("");
    requestAnimationFrame(() => {
      savedMultiplesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleMultipleTrackingChange = (
    multipleId: string,
    updates: Partial<ReturnType<typeof getSavedMultiples>[number]["tracking"]>
  ) => {
    updateMultipleTracking(multipleId, updates);
    refreshMultiples();
  };

  const handleDeleteMultiple = (multipleId: string) => {
    deleteMultipleBet(multipleId);
    refreshMultiples();
  };

  const handleLegStatusChange = (
    multipleId: string,
    analysisId: string,
    market: string,
    resultStatus: BetStatus
  ) => {
    updateMultipleLegStatus(multipleId, analysisId, market, resultStatus);
    refreshMultiples();
  };

  const handleMultipleStakeInputChange = (
    multipleId: string,
    rawValue: string,
    fallbackOdds: number
  ) => {
    if (rawValue === "") {
      handleMultipleTrackingChange(multipleId, { stakeUsed: null });
      return;
    }

    const parsedStake = Number(rawValue);
    if (Number.isNaN(parsedStake)) return;

    handleMultipleTrackingChange(multipleId, {
      betPlaced: true,
      stakeUsed: parsedStake,
      oddUsed: fallbackOdds,
    });
  };

  const placedMultiples = savedMultiples.filter((multiple) => multiple.tracking.betPlaced).length;
  const pendingMultiples = savedMultiples.filter(
    (multiple) => multiple.tracking.resultStatus === "pending"
  ).length;
  const settledMultiples = savedMultiples.filter((multiple) =>
    ["green", "red", "void"].includes(multiple.tracking.resultStatus)
  ).length;

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-8 p-6"
      >
        <motion.div
          variants={fadeUp}
          className="relative overflow-hidden rounded-[32px] border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.32)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.1),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.08),transparent_32%)]" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">
              Multiples Bet Workspace
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              Multiples Bet
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-white/60">
              Build, review and track multiples separately from single bets so the workflow stays cleaner and easier to read.
            </p>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="grid grid-cols-2 gap-3 xl:grid-cols-5"
        >
          <MetricBlock label="Draft Legs" value={multipleDraft.length} />
          <MetricBlock label="Saved" value={savedMultiples.length} />
          <MetricBlock label="Placed" value={placedMultiples} />
          <MetricBlock label="Open" value={pendingMultiples} />
          <MetricBlock label="Settled" value={settledMultiples} />
        </motion.div>

        <PremiumCard
          title="Filters & View"
          description="Keep this page focused: build first, then review the saved multiples below."
          badge="Controls"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <ActiveFilterPill label={`Draft · ${multipleDraft.length} legs`} tone="cyan" />
              <ActiveFilterPill label={`Open · ${pendingMultiples}`} tone="amber" />
              <ActiveFilterPill label={`Placed · ${placedMultiples}`} tone="emerald" />
              {showPlacedOnly ? (
                <ActiveFilterPill label="Placed Only" tone="emerald" />
              ) : null}
              <ActiveFilterPill
                label={showResolvedMultiples ? "Showing All" : "Open Only"}
                tone="neutral"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPlacedOnly((prev) => !prev)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  showPlacedOnly
                    ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
                }`}
              >
                Placed Only
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <InlineStat
                label="Recommended Stake"
                value={
                  multipleMetrics.recommendedStakeAmount
                    ? `EUR ${multipleMetrics.recommendedStakeAmount.toFixed(2)}`
                    : "-"
                }
              />
              <InlineStat
                label="Correlation"
                value={`${multipleMetrics.correlationLevel} (${multipleMetrics.correlationScore})`}
              />
              <InlineStat
                label="Combined Odds"
                value={
                  multipleMetrics.combinedOdds
                    ? multipleMetrics.combinedOdds.toFixed(2)
                    : "-"
                }
              />
              <InlineStat
                label="Confidence"
                value={
                  multipleMetrics.adjustedConfidence
                    ? `${multipleMetrics.adjustedConfidence.toFixed(1)}/10`
                    : "-"
                }
              />
            </div>
          </div>
        </PremiumCard>

        <div className="space-y-6">
          <PremiumCard
            title="Multiple Builder"
            description="Build multiples from saved simple picks, check correlation and save only when the combo still looks disciplined."
            badge="Builder"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers3 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-white">Current Legs</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    {multipleDraft.length} selected
                  </span>
                </div>

                {multipleDraft.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/55">
                    Add picks from the Simple Bet page to start building a multiple.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {multipleDraft.map((leg) => (
                      <div
                        key={`${leg.analysisId}-${leg.market}`}
                        className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{leg.match}</p>
                          <p className="mt-1 text-xs text-white/55">
                            {leg.market} · {leg.odds.toFixed(2)} · {leg.confidence.toFixed(1)}/10
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMultipleLeg(leg.analysisId, leg.market)}
                          className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-300 transition hover:bg-red-500/15"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <MetricBlock
                  label="Combined Odds"
                  value={multipleMetrics.combinedOdds ? multipleMetrics.combinedOdds.toFixed(2) : "-"}
                />
                <MetricBlock
                  label="Model %"
                  value={multipleMetrics.combinedModelProb ? `${multipleMetrics.combinedModelProb.toFixed(2)}%` : "-"}
                />
                <MetricBlock
                  label="Implied %"
                  value={multipleMetrics.combinedImpliedProb ? `${multipleMetrics.combinedImpliedProb.toFixed(2)}%` : "-"}
                />
                <MetricBlock
                  label="Confidence"
                  value={multipleMetrics.adjustedConfidence ? `${multipleMetrics.adjustedConfidence.toFixed(1)}/10` : "-"}
                />
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                    Correlation
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/55">
                    {multipleMetrics.correlationLevel} · {multipleMetrics.correlationScore}
                  </span>
                </div>
                {multipleMetrics.correlationReasons.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {multipleMetrics.correlationReasons.map((reason) => (
                      <p key={reason} className="text-xs leading-5 text-white/55">
                        {reason}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-white/55">
                    No same-game correlation warning detected.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                  Stake (Optional)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={multipleStakeInput}
                  onChange={(e) => setMultipleStakeInput(e.target.value)}
                  placeholder={multipleMetrics.recommendedStakeAmount
                    ? multipleMetrics.recommendedStakeAmount.toFixed(2)
                    : "0.00"}
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
                <p className="mt-2 text-xs leading-5 text-white/50">
                  If you enter a stake here, the multiple is saved as already placed and tracking starts immediately.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSaveMultiple}
                  disabled={multipleDraft.length < 2}
                  className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save Multiple
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearMultipleDraft();
                    refreshMultiples();
                  }}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.08]"
                >
                  Clear Builder
                </button>
              </div>
            </div>
          </PremiumCard>

          <div ref={savedMultiplesRef}>
            <PremiumCard
              title="Saved Multiples"
              description="Saved multiples stay here in order, ready for quick updates without getting mixed into the Simple Bet view."
              badge="Tracking"
            >
              {savedMultiples.length === 0 ? (
                <p className="text-sm text-white/55">
                  No saved multiples yet. Build one from the Simple Bet view.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                    <p className="text-sm text-white/60">
                      {showResolvedMultiples
                        ? "Showing all multiples."
                        : hiddenResolvedMultiplesCount > 0
                        ? `${hiddenResolvedMultiplesCount} resolved multiples hidden.`
                        : "Showing only open multiples."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowResolvedMultiples((prev) => !prev)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/[0.08]"
                    >
                      {showResolvedMultiples ? "Hide Resolved" : "Show All"}
                    </button>
                  </div>

                  {visibleSavedMultiples.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-5 text-sm text-white/55">
                      No open multiples right now.
                    </div>
                  ) : (
                    visibleSavedMultiples.map((multiple) => (
                      <div
                        key={multiple.id}
                        className="overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)] p-4 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                                  {multiple.legs.length} legs
                                </span>
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                                  {multiple.correlationLevel} correlation
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/55">
                                  {new Date(multiple.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-white/62">
                                {multiple.legs.map((leg) => `${leg.homeTeam} vs ${leg.awayTeam}`).join(" · ")}
                              </p>
                            </div>

                            <div className="grid grid-cols-3 gap-3 lg:min-w-[290px]">
                              <MetricBlock label="Combined Odds" value={multiple.combinedOdds.toFixed(2)} />
                              <MetricBlock label="Confidence" value={`${multiple.adjustedConfidence.toFixed(1)}/10`} />
                              <MetricBlock label="P/L" value={`EUR ${multiple.tracking.profitLoss.toFixed(2)}`} />
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {multiple.legs.map((leg) => (
                              <div
                                key={`${leg.analysisId}-${leg.market}`}
                                className="rounded-2xl border border-white/8 bg-white/[0.03] px-3.5 py-3"
                              >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-white">
                                      {leg.homeTeam} vs {leg.awayTeam}
                                    </p>
                                    <p className="mt-1 text-xs text-white/48">
                                      {leg.market}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap gap-2">
                                    {(["pending", "green", "red", "void"] as BetStatus[]).map(
                                      (status) => (
                                        <button
                                          key={status}
                                          type="button"
                                          onClick={() =>
                                            handleLegStatusChange(
                                              multiple.id,
                                              leg.analysisId,
                                              leg.market,
                                              status
                                            )
                                          }
                                          className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition ${
                                            leg.resultStatus === status
                                              ? status === "green"
                                                ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-200"
                                                : status === "red"
                                                ? "border-red-400/30 bg-red-400/15 text-red-200"
                                                : status === "void"
                                                ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
                                                : "border-cyan-400/30 bg-cyan-400/15 text-cyan-200"
                                              : "border-white/10 bg-white/[0.03] text-white/52 hover:bg-white/[0.06]"
                                          }`}
                                        >
                                          {status}
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                              <label className="flex items-center gap-3 text-sm text-white">
                                <input
                                  type="checkbox"
                                  checked={multiple.tracking.betPlaced}
                                  onChange={(e) =>
                                    handleMultipleTrackingChange(multiple.id, {
                                      betPlaced: e.target.checked,
                                      stakeUsed: e.target.checked
                                        ? multiple.tracking.stakeUsed ??
                                          Number(multiple.recommendedStakeAmount.toFixed(2))
                                        : null,
                                      oddUsed: e.target.checked
                                        ? multiple.tracking.oddUsed ??
                                          Number(multiple.combinedOdds.toFixed(2))
                                        : null,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                                />
                                Placed
                              </label>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                                Stake Used
                              </label>
                              <input
                                type="number"
                                value={multiple.tracking.stakeUsed ?? ""}
                                onChange={(e) =>
                                  handleMultipleStakeInputChange(
                                    multiple.id,
                                    e.target.value,
                                    multiple.tracking.oddUsed ?? Number(multiple.combinedOdds.toFixed(2))
                                  )
                                }
                                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                              />
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                                Result Status
                              </label>
                              <div className="flex h-11 items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-4">
                                <span className="text-sm text-white">
                                  {multiple.tracking.resultStatus.charAt(0).toUpperCase() +
                                    multiple.tracking.resultStatus.slice(1)}
                                </span>
                                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                                  Auto
                                </span>
                              </div>
                              <p className="mt-2 text-xs leading-5 text-white/42">
                                This status is now derived automatically from the leg statuses above.
                              </p>
                            </div>

                            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
                                Delete
                              </label>
                              <button
                                type="button"
                                onClick={() => handleDeleteMultiple(multiple.id)}
                                className="h-11 w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition hover:bg-red-500/15"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </PremiumCard>
          </div>
        </div>

        <PremiumCard
          title="How To Use"
          description="Keep the build flow here and keep single-bet review in the Simple Bet page."
          badge="Workflow"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-white/62">
              Add legs from the Simple Bet page using <span className="text-white">Add To Multiple</span>.
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-white/62">
              Come here to review correlation, save the combo and manage the tracking.
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-white/62">
              Bankroll and analytics stay linked because singles and multiples still use the same storage.
            </div>
          </div>
        </PremiumCard>
      </motion.div>
    </AppLayout>
  );
}
