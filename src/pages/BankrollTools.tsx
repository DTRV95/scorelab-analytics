import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useMemo, useState } from "react";
import {
  getAnalyses,
  getBankrollSettings,
  saveBankrollSettings,
  getBankrollStats,
} from "@/lib/analysisStorage";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from "recharts";

export default function BankrollTools() {
  const [initialBankrollInput, setInitialBankrollInput] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [stats, setStats] = useState({
    initialBankroll: 0,
    currentBankroll: 0,
    totalProfitLoss: 0,
    totalBetsPlaced: 0,
    totalGreens: 0,
    totalReds: 0,
    totalVoids: 0,
    totalPending: 0,
    hitRate: 0,
    roi: 0,
  });

  const [analyses, setAnalyses] = useState<ReturnType<typeof getAnalyses>>([]);

  const loadData = () => {
    const settings = getBankrollSettings();
    const bankrollStats = getBankrollStats();
    const savedAnalyses = getAnalyses();

    setInitialBankrollInput(
      settings.initialBankroll ? String(settings.initialBankroll) : ""
    );
    setStats(bankrollStats);
    setAnalyses(savedAnalyses);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveBankroll = () => {
    const parsedValue = Number(initialBankrollInput);

    if (Number.isNaN(parsedValue) || parsedValue < 0) {
      setSavedMessage("Please enter a valid bankroll value.");
      return;
    }

    saveBankrollSettings({
      initialBankroll: parsedValue,
    });

    loadData();
    setSavedMessage("Initial bankroll saved successfully.");

    setTimeout(() => {
      setSavedMessage("");
    }, 2500);
  };

  const bankrollEvolutionData = useMemo(() => {
  const sorted = [...analyses].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  let runningBankroll = stats.initialBankroll;

  const settledBets = sorted.filter(
    (analysis) =>
      analysis.tracking?.betPlaced &&
      (analysis.tracking.resultStatus === "green" ||
        analysis.tracking.resultStatus === "red" ||
        analysis.tracking.resultStatus === "void")
  );

  const data: { name: string; bankroll: number }[] = [
    {
      name: "Start",
      bankroll: Number(runningBankroll.toFixed(2)),
    },
  ];

  settledBets.forEach((analysis, index) => {
    runningBankroll += analysis.tracking?.profitLoss || 0;

    data.push({
      name: `${index + 1}`,
      bankroll: Number(runningBankroll.toFixed(2)),
    });
  });

  return data;
}, [analyses, stats.initialBankroll]);

  const performanceData = useMemo(() => {
    return [
      { name: "Greens", value: stats.totalGreens },
      { name: "Reds", value: stats.totalReds },
      { name: "Pending", value: stats.totalPending },
      { name: "Voids", value: stats.totalVoids },
    ];
  }, [stats]);

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bankroll Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your bankroll and track performance.
          </p>
        </div>

        <div className="rounded-xl bg-card ring-surface card-shadow p-5 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Initial Bankroll
          </h2>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              value={initialBankrollInput}
              onChange={(e) => setInitialBankrollInput(e.target.value)}
              placeholder="Enter bankroll"
              className="w-full sm:w-64 h-10 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none"
            />
            <button
              onClick={handleSaveBankroll}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Save Bankroll
            </button>
          </div>

          {savedMessage && (
            <p className="text-sm text-primary">{savedMessage}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Initial Bankroll
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {stats.initialBankroll.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Current Bankroll
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {stats.currentBankroll.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Profit / Loss
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {stats.totalProfitLoss.toFixed(2)}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Total Bets Placed
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {stats.totalBetsPlaced}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Greens
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {stats.totalGreens}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Reds
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {stats.totalReds}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl bg-card ring-surface card-shadow p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Bankroll Evolution
            </h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bankrollEvolutionData}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222, 47%, 7%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bankroll"
                    stroke="hsl(142, 71%, 45%)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-5">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Bet Results Breakdown
            </h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(222, 47%, 7%)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-card ring-surface card-shadow p-5">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Breakdown
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Pending</p>
              <p className="text-foreground font-semibold mt-1">
                {stats.totalPending}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Voids</p>
              <p className="text-foreground font-semibold mt-1">
                {stats.totalVoids}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Hit Rate</p>
              <p className="text-foreground font-semibold mt-1">
                {stats.hitRate.toFixed(2)}%
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">ROI</p>
              <p className="text-foreground font-semibold mt-1">
                {stats.roi.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
