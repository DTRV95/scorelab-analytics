import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  BrainCircuit,
  Clock,
  Command as CommandIcon,
  Flag,
  Layers3,
  Radar,
  Search,
  Settings,
  Sparkles,
  Target,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { getMarketPerformance } from "@/lib/analysisStorage";
import { useScoreLabData } from "@/hooks/useScoreLabData";

export const OPEN_COMMAND_CENTER_EVENT = "scorelab:open-command-center";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);

const pages = [
  { title: "Dashboard", detail: "System overview", url: "/dashboard", icon: BarChart3 },
  { title: "Match Analysis", detail: "Analyze a new game", url: "/analysis", icon: Target },
  { title: "Value Radar", detail: "Find today's best edges", url: "/radar", icon: Radar },
  { title: "Model Lab", detail: "Audit calibration truth", url: "/model-lab", icon: BrainCircuit },
  { title: "Simple Bet", detail: "Track single bets", url: "/history", icon: Clock },
  { title: "Multiples Bet", detail: "Build and monitor multiples", url: "/history-multiples", icon: Layers3 },
  { title: "Bankroll Tools", detail: "Financial truth center", url: "/bankroll", icon: Wallet },
  { title: "Roadmap", detail: "Mission control", url: "/roadmap", icon: Flag },
  { title: "Settings", detail: "Workspace controls", url: "/settings", icon: Settings },
];

export function ScoreLabCommandCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const {
    analyses,
    multiples,
    financialSnapshot,
    radarOpportunities,
  } = useScoreLabData();

  useEffect(() => {
    const openCommandCenter = () => setOpen(true);

    window.addEventListener(OPEN_COMMAND_CENTER_EVENT, openCommandCenter);

    return () => {
      window.removeEventListener(OPEN_COMMAND_CENTER_EVENT, openCommandCenter);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const intelligence = useMemo(() => {
    const markets = getMarketPerformance(analyses);
    const radar = radarOpportunities
      .filter((point) => point.calibratedProb >= 75)
      .sort((a, b) => b.calibratedProb - a.calibratedProb || b.edge - a.edge);
    const stats = financialSnapshot.stats;

    const pendingSingles = analyses.filter(
      (analysis) => analysis.tracking.betPlaced && analysis.tracking.resultStatus === "pending"
    ).length;
    const pendingMultiples = multiples.filter(
      (multiple) => multiple.tracking.betPlaced && multiple.tracking.resultStatus === "pending"
    ).length;
    const bestMarket = markets
      .filter((market) => market.bets > 0)
      .sort((a, b) => b.roi - a.roi)[0];

    return {
      freeBankroll: stats.currentBankroll,
      roi: stats.roi,
      hitRate: stats.hitRate,
      openExposure: financialSnapshot.openExposure,
      pending: pendingSingles + pendingMultiples,
      bestMarket,
      radar,
    };
  }, [analyses, financialSnapshot, multiples, radarOpportunities]);

  const runCommand = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  const openRadarPoint = (point: (typeof intelligence.radar)[number]) => {
    const params = new URLSearchParams({
      analysisId: point.id,
      prepareBet: "1",
      market: point.market,
      stake: String(Number(point.stake.toFixed(2))),
      odd: String(Number(point.odds.toFixed(2))),
    });

    runCommand(`/history?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden border-cyan-100/14 bg-[linear-gradient(180deg,rgba(7,24,42,0.98)_0%,rgba(3,13,26,0.99)_100%)] p-0 shadow-[0_28px_90px_-32px_rgba(34,211,238,0.36)] sm:max-w-2xl">
        <DialogTitle className="sr-only">ScoreLab Command Center</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, actions, and live analytical shortcuts.
        </DialogDescription>
        <div className="border-b border-cyan-100/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-100/45">
                Command Center
              </p>
              <p className="mt-1 text-sm text-white/70">
                Jump, inspect and act without leaving flow.
              </p>
            </div>
            <div className="hidden items-center gap-1 rounded-full border border-cyan-100/12 bg-cyan-100/[0.04] px-2.5 py-1 text-[10px] text-cyan-50/55 sm:flex">
              <CommandIcon className="h-3 w-3" strokeWidth={1.7} />
              Ctrl K
            </div>
          </div>
        </div>

        <Command className="bg-transparent text-white">
          <CommandInput
            placeholder="Search pages, actions, radar picks..."
            className="text-white placeholder:text-white/35"
          />
          <CommandList className="max-h-[520px] px-2 py-3">
            <CommandEmpty className="py-8 text-center text-sm text-white/45">
              No command found.
            </CommandEmpty>

            <CommandGroup heading="Live Intelligence">
              <div className="grid grid-cols-2 gap-2 px-2 pb-2 md:grid-cols-4">
                <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.035] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/36">Bankroll</p>
                  <p className="mt-1 font-mono-data text-sm font-semibold text-white">
                    {formatCurrency(intelligence.freeBankroll)}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.035] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/36">ROI</p>
                  <p className="mt-1 font-mono-data text-sm font-semibold text-white">
                    {intelligence.roi.toFixed(2)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.035] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/36">Hit Rate</p>
                  <p className="mt-1 font-mono-data text-sm font-semibold text-white">
                    {intelligence.hitRate.toFixed(1)}%
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.035] p-3">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/36">Pending</p>
                  <p className="mt-1 font-mono-data text-sm font-semibold text-white">
                    {intelligence.pending}
                  </p>
                </div>
              </div>
            </CommandGroup>

            <CommandSeparator className="my-2 bg-cyan-100/10" />

            <CommandGroup heading="Navigation">
              {pages.map((page) => (
                <CommandItem
                  key={page.url}
                  value={`${page.title} ${page.detail}`}
                  onSelect={() => runCommand(page.url)}
                  className="rounded-2xl px-3 py-3 text-white/78 data-[selected=true]:bg-cyan-100/[0.08] data-[selected=true]:text-white"
                >
                  <page.icon className="mr-3 h-4 w-4 text-cyan-200/70" strokeWidth={1.7} />
                  <div>
                    <p className="text-sm font-medium">{page.title}</p>
                    <p className="text-xs text-white/42">{page.detail}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandSeparator className="my-2 bg-cyan-100/10" />

            <CommandGroup heading="Smart Actions">
              <CommandItem
                value="new analysis analyze match"
                onSelect={() => runCommand("/analysis")}
                className="rounded-2xl px-3 py-3 text-white/78 data-[selected=true]:bg-cyan-100/[0.08] data-[selected=true]:text-white"
              >
                <Sparkles className="mr-3 h-4 w-4 text-emerald-200/75" strokeWidth={1.7} />
                <div>
                  <p className="text-sm font-medium">Start new analysis</p>
                  <p className="text-xs text-white/42">Open the model input flow.</p>
                </div>
                <CommandShortcut>NEW</CommandShortcut>
              </CommandItem>
              <CommandItem
                value="today execution roadmap orders"
                onSelect={() => runCommand("/roadmap")}
                className="rounded-2xl px-3 py-3 text-white/78 data-[selected=true]:bg-cyan-100/[0.08] data-[selected=true]:text-white"
              >
                <Zap className="mr-3 h-4 w-4 text-cyan-200/75" strokeWidth={1.7} />
                <div>
                  <p className="text-sm font-medium">Open today's execution desk</p>
                  <p className="text-xs text-white/42">
                    Mission orders, stake logic and roadmap state.
                  </p>
                </div>
              </CommandItem>
            </CommandGroup>

            {intelligence.radar.length > 0 ? (
              <>
                <CommandSeparator className="my-2 bg-cyan-100/10" />
                <CommandGroup heading="High Probability Radar">
                  {intelligence.radar.slice(0, 5).map((point) => (
                    <CommandItem
                      key={`${point.id}-${point.market}`}
                      value={`${point.match} ${point.market} ${point.calibratedProb}`}
                      onSelect={() => openRadarPoint(point)}
                      className="rounded-2xl px-3 py-3 text-white/78 data-[selected=true]:bg-cyan-100/[0.08] data-[selected=true]:text-white"
                    >
                      <Radar className="mr-3 h-4 w-4 text-emerald-200/75" strokeWidth={1.7} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{point.match}</p>
                        <p className="text-xs text-white/42">
                          {point.market} · learned {point.calibratedProb.toFixed(1)}% · odds{" "}
                          {point.odds.toFixed(2)}
                        </p>
                      </div>
                      <CommandShortcut>{point.edge.toFixed(1)}%</CommandShortcut>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            ) : null}

            <CommandSeparator className="my-2 bg-cyan-100/10" />

            <CommandGroup heading="System Read">
              <CommandItem
                value="best market bankroll risk exposure"
                onSelect={() => runCommand("/bankroll")}
                className="rounded-2xl px-3 py-3 text-white/78 data-[selected=true]:bg-cyan-100/[0.08] data-[selected=true]:text-white"
              >
                <Search className="mr-3 h-4 w-4 text-cyan-200/75" strokeWidth={1.7} />
                <div>
                  <p className="text-sm font-medium">
                    {intelligence.bestMarket
                      ? `${intelligence.bestMarket.market} is leading`
                      : "Not enough settled market data yet"}
                  </p>
                  <p className="text-xs text-white/42">
                    Open exposure: {formatCurrency(intelligence.openExposure)}
                  </p>
                </div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
