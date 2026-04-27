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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

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

    return {
      freeBankroll: stats.currentBankroll,
      openExposure,
      roi: stats.roi,
      pending: pendingSingles + pendingMultiples,
      qualifiedRadar,
      bestPoint,
      systemMode,
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
    <div className="border-b border-cyan-100/10 bg-[linear-gradient(180deg,rgba(4,18,33,0.82)_0%,rgba(3,14,27,0.72)_100%)] px-5 py-3 backdrop-blur-2xl shadow-[0_18px_44px_-34px_rgba(34,211,238,0.42)] md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <button
          type="button"
          onClick={() => navigate("/roadmap")}
          className="group flex min-w-0 items-center gap-3 rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.035] px-3.5 py-3 text-left transition hover:border-cyan-100/18 hover:bg-cyan-100/[0.055]"
        >
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
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:min-w-[720px]">
          <button
            type="button"
            onClick={() => navigate("/bankroll")}
            className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.03] px-3 py-2.5 text-left transition hover:border-cyan-100/18 hover:bg-cyan-100/[0.055]"
          >
            <div className="flex items-center gap-2 text-cyan-50/40">
              <Wallet className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Free</span>
            </div>
            <p className="mt-1 font-mono-data text-sm font-semibold text-white">
              {formatCurrency(dock.freeBankroll)}
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/bankroll")}
            className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.03] px-3 py-2.5 text-left transition hover:border-cyan-100/18 hover:bg-cyan-100/[0.055]"
          >
            <div className="flex items-center gap-2 text-cyan-50/40">
              <Zap className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Exposure</span>
            </div>
            <p className="mt-1 font-mono-data text-sm font-semibold text-white">
              {formatCurrency(dock.openExposure)}
            </p>
          </button>

          <button
            type="button"
            onClick={openBestPoint}
            className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.03] px-3 py-2.5 text-left transition hover:border-cyan-100/18 hover:bg-cyan-100/[0.055]"
          >
            <div className="flex items-center gap-2 text-cyan-50/40">
              <Radar className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Radar</span>
            </div>
            <p className="mt-1 truncate font-mono-data text-sm font-semibold text-white">
              {dock.qualifiedRadar.length > 0
                ? `${dock.qualifiedRadar.length} above 75%`
                : "No clean pick"}
            </p>
          </button>

          <button
            type="button"
            onClick={() => navigate("/history")}
            className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.03] px-3 py-2.5 text-left transition hover:border-cyan-100/18 hover:bg-cyan-100/[0.055]"
          >
            <div className="flex items-center gap-2 text-cyan-50/40">
              <Flag className="h-3.5 w-3.5" strokeWidth={1.7} />
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">Pending</span>
            </div>
            <p className="mt-1 font-mono-data text-sm font-semibold text-white">
              {dock.pending}
            </p>
          </button>
        </div>

        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="hidden items-center gap-2 rounded-2xl border border-emerald-300/12 bg-emerald-300/[0.045] px-3 py-2 text-xs font-medium text-emerald-50/70 transition hover:border-emerald-300/22 hover:bg-emerald-300/[0.065] xl:flex"
        >
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.7} />
          ROI {dock.roi.toFixed(2)}%
        </button>
      </div>
    </div>
  );
}
