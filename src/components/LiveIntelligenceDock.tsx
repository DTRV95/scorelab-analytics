import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, Flag, Radar, TrendingUp, Wallet, Zap } from "lucide-react";
import {
  HudCornerFrame,
  HudMetricOrb,
  HudSignalLine,
  HudStateIcon,
  HudStatusPill,
  type HudTone,
} from "@/components/HudLayer";
import { MotionNumber, PulseOnChange } from "@/components/MotionIntelligence";
import { useScoreLabData } from "@/hooks/useScoreLabData";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

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
  const {
    multiples,
    trackingEntries,
    financialSnapshot,
    radarOpportunities,
  } = useScoreLabData();

  const dock = useMemo(() => {
    const stats = financialSnapshot.stats;
    const radar = radarOpportunities
      .filter((opportunity) => isToday(opportunity.createdAt))
      .sort((a, b) => b.calibratedProb - a.calibratedProb || b.edge - a.edge);
    const qualifiedRadar = radar.filter((point) => point.calibratedProb >= 75);
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
  }, [financialSnapshot, multiples, radarOpportunities, trackingEntries]);

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
    <div className="scorelab-chrome-dock relative hidden border-b px-5 py-3 backdrop-blur-2xl md:block md:px-6">
      <HudSignalLine tone={dock.systemTone} className="absolute inset-x-0 top-0" />
      <div className="mx-auto flex max-w-7xl flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <button
          type="button"
          onClick={() => navigate("/roadmap")}
          className="scorelab-chrome-control group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition"
        >
          <HudCornerFrame />
          <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--scorelab-accent-a-soft),var(--scorelab-accent-b-soft))] ring-1 ring-[var(--scorelab-control-border)]">
            <Activity className="h-4 w-4 text-cyan-100/78" strokeWidth={1.7} />
            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_var(--scorelab-accent-b-soft)]" />
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
                      <MotionNumber value={dock.qualifiedRadar.length} /> learned 75%+
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
          className="scorelab-chrome-control hidden items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium text-emerald-50/70 transition xl:flex"
        >
          <TrendingUp className="h-3.5 w-3.5" strokeWidth={1.7} />
          ROI <MotionNumber value={dock.roi} formatter={formatPercent} />
        </button>
      </div>
    </div>
  );
}
