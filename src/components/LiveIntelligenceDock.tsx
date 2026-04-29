import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Flag, Radar, TrendingUp, Wallet, Zap } from "lucide-react";
import {
  ANALYSES_UPDATED_EVENT,
  getAnalyses,
  getAllAnalysisTrackingEntries,
  getBankrollStats,
} from "@/lib/analysisStorage";
import {
  MULTIPLES_UPDATED_EVENT,
  getSavedMultiples,
} from "@/lib/multipleStorage";
import { buildRadarOpportunities } from "@/lib/valueRadar";
import {
  HudCornerFrame,
  HudMetricOrb,
  HudSignalLine,
  HudStateIcon,
  HudStatusPill,
  type HudTone,
} from "@/components/HudLayer";
import { MotionNumber, PulseOnChange } from "@/components/MotionIntelligence";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatPercent = (value: number) => `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;

function isToday(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();

  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export function LiveIntelligenceDock() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const refresh = () => setRefreshKey((value) => value + 1);

    window.addEventListener(ANALYSES_UPDATED_EVENT, refresh);
    window.addEventListener(MULTIPLES_UPDATED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);

    return () => {
      window.removeEventListener(ANALYSES_UPDATED_EVENT, refresh);
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const dock = useMemo(() => {
    void refreshKey;

    const analyses = getAnalyses();
    const multiples = getSavedMultiples();
    const stats = getBankrollStats();
    const trackingEntries = getAllAnalysisTrackingEntries(analyses);
    const todayAnalyses = analyses.filter((analysis) => isToday(analysis.createdAt));
    const radar = buildRadarOpportunities(todayAnalyses).sort(
      (a, b) => b.modelProb - a.modelProb || b.edge - a.edge
    );
    const qualifiedRadar = radar.filter((point) => point.modelProb >= 75);
    const pendingSingles = trackingEntries.filter(
      (entry) => entry.tracking.betPlaced && entry.tracking.resultStatus === "pending"
    ).length;
    const pendingMultiples = multiples.filter(
      (multiple) => multiple.tracking.betPlaced && multiple.tracking.resultStatus === "pending"
    ).length;
    const openSinglesExposure = trackingEntries
      .filter((entry) => entry.tracking.betPlaced && entry.tracking.resultStatus === "pending")
      .reduce((sum, entry) => sum + (entry.tracking.stakeUsed || 0), 0);
    const openMultiplesExposure = multiples
      .filter((multiple) => multiple.tracking.betPlaced && multiple.tracking.resultStatus === "pending")
      .reduce((sum, multiple) => sum + (multiple.tracking.stakeUsed || 0), 0);
    const openExposure = openSinglesExposure + openMultiplesExposure;
    const bestPoint = qualifiedRadar[0] ?? radar[0] ?? null;
    const exposureRatio =
      stats.initialBankroll > 0 ? (openExposure / stats.initialBankroll) * 100 : 0;

    const systemMode =
      qualifiedRadar.length > 0 && exposureRatio < 35
        ? "Execution window open"
        : exposureRatio >= 35
        ? "Risk guard active"
        : "Scanning for clean value";
    const systemTone: HudTone =
      exposureRatio >= 35 ? "red" : qualifiedRadar.length > 0 ? "emerald" : "cyan";
    const systemState =
      exposureRatio >= 35 ? "risk" : qualifiedRadar.length > 0 ? "execution" : "scanning";

    return {
      freeBankroll: stats.currentBankroll,
      openExposure,
      roi: stats.roi,
      pending: pendingSingles + pendingMultiples,
      qualifiedRadar,
      bestPoint,
      systemMode,
      systemTone,
      systemState,
    };
  }, [refreshKey]);

  const openBestPoint = () => {
    if (!dock.bestPoint) {
      navigate("/radar");
      return;
    }

    const params = new URLSearchParams({
      analysisId: dock.bestPoint.id,
      prepareBet: "1",
      market: dock.bestPoint.market,
      stake: String(Number(dock.bestPoint.stake.toFixed(2))),
      odd: String(Number(dock.bestPoint.odds.toFixed(2))),
    });

    navigate(`/history?${params.toString()}`);
  };

  return (
    <div className="relative border-b border-cyan-100/10 bg-[linear-gradient(180deg,rgba(4,18,33,0.82)_0%,rgba(3,14,27,0.72)_100%)] px-5 py-3 backdrop-blur-2xl shadow-[0_18px_44px_-34px_rgba(34,211,238,0.42)] md:px-6">
      <HudSignalLine tone={dock.systemTone} className="absolute inset-x-0 top-0" />
      <div className="mx-auto flex max-w-7xl flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <button
          type="button"
          onClick={() => navigate("/roadmap")}
          className="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.035] px-3.5 py-3 text-left transition hover:border-cyan-100/18 hover:bg-cyan-100/[0.055]"
        >
          <HudCornerFrame />
          <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(52,211,153,0.12))] ring-1 ring-cyan-100/12">
            <Activity className="h-4 w-4 text-cyan-100/78" strokeWidth={1.7} />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.75)]" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-50/36">
              Live System
            </p>
            <p className="truncate text-sm font-medium text-white/82">
              {dock.systemMode}
            </p>
            <div className="mt-2">
              <HudStatusPill
                label={dock.systemState === "risk" ? "Risk Lock" : dock.systemState === "execution" ? "Execution" : "Scanning"}
                tone={dock.systemTone}
                icon={<HudStateIcon state={dock.systemState} />}
                className="px-2.5 py-1"
              />
            </div>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:min-w-[720px]">
          <button
            type="button"
            onClick={() => navigate("/bankroll")}
            className="text-left transition hover:scale-[1.01]"
          >
            <PulseOnChange value={dock.freeBankroll}>
              <HudMetricOrb
                label="Free"
                value={<MotionNumber value={dock.freeBankroll} formatter={formatCurrency} />}
                icon={<Wallet className="h-3.5 w-3.5" strokeWidth={1.7} />}
              />
            </PulseOnChange>
          </button>

          <button
            type="button"
            onClick={() => navigate("/bankroll")}
            className="text-left transition hover:scale-[1.01]"
          >
            <PulseOnChange value={dock.openExposure}>
              <HudMetricOrb
                label="Exposure"
                value={<MotionNumber value={dock.openExposure} formatter={formatCurrency} />}
                tone={dock.openExposure > 0 ? "amber" : "cyan"}
                icon={<Zap className="h-3.5 w-3.5" strokeWidth={1.7} />}
              />
            </PulseOnChange>
          </button>

          <button
            type="button"
            onClick={openBestPoint}
            className="text-left transition hover:scale-[1.01]"
          >
            <PulseOnChange value={dock.qualifiedRadar.length}>
              <HudMetricOrb
                label="Radar"
                value={
                  dock.qualifiedRadar.length > 0 ? (
                    <>
                      <MotionNumber value={dock.qualifiedRadar.length} /> above 75%
                    </>
                  ) : (
                    "No clean pick"
                  )
                }
                tone={dock.qualifiedRadar.length > 0 ? "emerald" : "cyan"}
                icon={<Radar className="h-3.5 w-3.5" strokeWidth={1.7} />}
              />
            </PulseOnChange>
          </button>

          <button
            type="button"
            onClick={() => navigate("/history")}
            className="text-left transition hover:scale-[1.01]"
          >
            <PulseOnChange value={dock.pending}>
              <HudMetricOrb
                label="Pending"
                value={<MotionNumber value={dock.pending} />}
                tone={dock.pending > 0 ? "amber" : "cyan"}
                icon={<Flag className="h-3.5 w-3.5" strokeWidth={1.7} />}
              />
            </PulseOnChange>
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="hidden items-center gap-2 rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.045] px-3 py-2 text-xs font-medium text-emerald-50/70 transition hover:border-emerald-300/22 hover:bg-emerald-300/[0.065] xl:flex"
        >
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.7} />
          ROI <MotionNumber value={dock.roi} formatter={formatPercent} />
        </button>
      </div>
    </div>
  );
}
