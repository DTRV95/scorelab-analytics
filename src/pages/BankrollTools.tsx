import { AppLayout } from "@/components/layout/AppLayout";
import { useEffect, useMemo, useState } from "react";
import {
  getAnalyses,
  getBankrollSettings,
  saveBankrollSettings,
  getBankrollStats,
  getMarketPerformance,
  getDailyPerformance,
  getEdgeBucketPerformance,
  getConfidenceBucketPerformance,
  getDrawdownSeries,
  getDailyProfitSeries,
  getCumulativeMarketSeries,
  getBestPerformingZone,
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
  CartesianGrid,
  Legend,
  Cell,
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
  const marketPerformance = useMemo(() => getMarketPerformance(), [analyses]);
  const dailyPerformance = useMemo(() => getDailyPerformance(), [analyses]);
  const edgeBucketPerformance = useMemo(() => getEdgeBucketPerformance(), [analyses]);
  const confidenceBucketPerformance = useMemo(
    () => getConfidenceBucketPerformance(),
    [analyses]
  );
  const drawdownSeries = useMemo(() => getDrawdownSeries(), [analyses]);
  const dailyProfitSeries = useMemo(() => getDailyProfitSeries(), [analyses]);
  const cumulativeMarketSeries = useMemo(() => getCumulativeMarketSeries(), [analyses]);
  const bestPerformingZone = useMemo(() => getBestPerformingZone(), [analyses]);

  const todayPerformance = dailyPerformance[0] || null;
  const yesterdayPerformance = dailyPerformance[1] || null;

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
            Configure your bankroll and track real performance.
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

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Today Growth
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {todayPerformance ? `${todayPerformance.growthPct.toFixed(2)}%` : "0.00%"}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              Yesterday Growth
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {yesterdayPerformance
                ? `${yesterdayPerformance.growthPct.toFixed(2)}%`
                : "0.00%"}
            </p>
          </div>

          <div className="rounded-xl bg-card ring-surface card-shadow p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              ROI
            </p>
            <p className="text-2xl font-bold text-foreground mt-2 font-mono-data">
              {stats.roi.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-card ring-surface card-shadow p-5">
  <h2 className="text-lg font-semibold text-foreground mb-4">
    Bankroll Evolution
  </h2>
  <div className="h-[300px]">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={bankrollEvolutionData}>
        <CartesianGrid stroke="rgb(0, 0, 0)" vertical={false} />
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

<div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
  <div className="rounded-xl bg-card ring-surface card-shadow p-5">
    <h2 className="text-lg font-semibold text-foreground mb-4">
      Daily Profit / Loss
    </h2>
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dailyProfitSeries}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
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
              backgroundColor: "hsl(0, 0%, 4%)",
              border: "1px solid rgb(67, 65, 65)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Bar dataKey="profitLoss" radius={[6, 6, 0, 0]}>
            {dailyProfitSeries.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.profitLoss >= 0
                    ? "hsl(142, 71%, 45%)"
                    : "hsl(0, 70%, 55%)"
                }
              />
            ))}
          </Bar>
        </BarChart>
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
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
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
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {performanceData.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.name === "Greens"
                    ? "hsl(142, 71%, 45%)"
                    : entry.name === "Reds"
                    ? "hsl(0, 70%, 55%)"
                    : "hsl(222, 30%, 20%)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
</div>

        <div className="rounded-xl bg-card ring-surface card-shadow p-5">
  <h2 className="text-lg font-semibold text-foreground mb-4">
    Best Performing Zone
  </h2>

  {!bestPerformingZone.bestMarket &&
  !bestPerformingZone.bestEdgeBucket &&
  !bestPerformingZone.bestConfidenceBucket ? (
    <p className="text-sm text-muted-foreground">
      Not enough settled bets yet. You need at least 2 bets per group to detect your strongest zone.
    </p>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Best Market
        </p>
        {bestPerformingZone.bestMarket ? (
          <>
            <p className="text-lg font-bold text-foreground">
              {bestPerformingZone.bestMarket.market}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ROI: {bestPerformingZone.bestMarket.roi.toFixed(2)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Bets: {bestPerformingZone.bestMarket.bets}
            </p>
            <p className="text-sm text-muted-foreground">
              P/L: {bestPerformingZone.bestMarket.profitLoss.toFixed(2)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough data</p>
        )}
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Best Edge Bucket
        </p>
        {bestPerformingZone.bestEdgeBucket ? (
          <>
            <p className="text-lg font-bold text-foreground">
              {bestPerformingZone.bestEdgeBucket.bucket}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ROI: {bestPerformingZone.bestEdgeBucket.roi.toFixed(2)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Bets: {bestPerformingZone.bestEdgeBucket.bets}
            </p>
            <p className="text-sm text-muted-foreground">
              P/L: {bestPerformingZone.bestEdgeBucket.profitLoss.toFixed(2)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough data</p>
        )}
      </div>

      <div className="rounded-lg border border-white/5 bg-white/[0.02] p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Best Confidence Bucket
        </p>
        {bestPerformingZone.bestConfidenceBucket ? (
          <>
            <p className="text-lg font-bold text-foreground">
              {bestPerformingZone.bestConfidenceBucket.bucket}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              ROI: {bestPerformingZone.bestConfidenceBucket.roi.toFixed(2)}%
            </p>
            <p className="text-sm text-muted-foreground">
              Bets: {bestPerformingZone.bestConfidenceBucket.bets}
            </p>
            <p className="text-sm text-muted-foreground">
              P/L: {bestPerformingZone.bestConfidenceBucket.profitLoss.toFixed(2)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough data</p>
        )}
      </div>
    </div>
  )}
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

        <div className="rounded-xl bg-card ring-surface card-shadow p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Daily Performance
          </h2>

          {dailyPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No settled bets yet. Track results in History to see daily growth.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Date", "Start Bankroll", "End Bankroll", "P/L", "Growth %", "Settled Bets"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailyPerformance.map((item) => (
                    <tr
                      key={item.date}
                      className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-foreground font-medium">
                        {item.date}
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono-data">
                        {item.startBankroll.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono-data">
                        {item.endBankroll.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono-data">
                        {item.profitLoss.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono-data">
                        {item.growthPct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {item.settledBets}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-card ring-surface card-shadow p-5">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Market Performance
          </h2>

          {marketPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tracked bets yet. Start tracking bets in History to see market performance.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Market", "Bets", "Greens", "Reds", "Hit Rate", "Profit / Loss"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {marketPerformance.map((item) => (
                    <tr
                      key={item.market}
                      className="border-t border-white/5 hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-foreground font-medium">
                        {item.market}
                      </td>
                      <td className="px-4 py-3 text-foreground">{item.bets}</td>
                      <td className="px-4 py-3 text-foreground">{item.greens}</td>
                      <td className="px-4 py-3 text-foreground">{item.reds}</td>
                      <td className="px-4 py-3 text-foreground">
                        {item.hitRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono-data">
                        {item.profitLoss.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
