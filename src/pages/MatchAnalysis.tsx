import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ValueBadge, DecisionBadge, RiskBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Play, Save } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AnalysisResult {
  market: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  valueBet: number;
  kelly: number;
  stake: number;
  risk: "Low" | "Medium" | "High";
  confidence: number;
  decision: "Bet" | "No Bet" | "Caution";
}

const defaultResults: AnalysisResult[] = [
  { market: "Over 2.5", odds: 1.80, modelProb: 67.4, impliedProb: 55.6, valueBet: 11.8, kelly: 2.4, stake: 120, risk: "Low", confidence: 9, decision: "Bet" },
  { market: "Under 2.5", odds: 2.10, modelProb: 32.6, impliedProb: 47.6, valueBet: -15.0, kelly: 0, stake: 0, risk: "High", confidence: 3, decision: "No Bet" },
  { market: "Over 3.5", odds: 3.20, modelProb: 38.2, impliedProb: 31.3, valueBet: 6.9, kelly: 1.1, stake: 55, risk: "Medium", confidence: 6, decision: "Caution" },
  { market: "Under 3.5", odds: 1.35, modelProb: 61.8, impliedProb: 74.1, valueBet: -12.3, kelly: 0, stake: 0, risk: "Low", confidence: 5, decision: "No Bet" },
  { market: "BTTS Yes", odds: 1.75, modelProb: 62.1, impliedProb: 57.1, valueBet: 5.0, kelly: 0.9, stake: 45, risk: "Low", confidence: 7, decision: "Bet" },
  { market: "BTTS No", odds: 2.15, modelProb: 37.9, impliedProb: 46.5, valueBet: -8.6, kelly: 0, stake: 0, risk: "Medium", confidence: 4, decision: "No Bet" },
];

const chartData = defaultResults.map((r) => ({
  name: r.market,
  model: r.modelProb,
  implied: r.impliedProb,
}));

function InputSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{label}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FormField({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="text"
        defaultValue={defaultValue}
        className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}

export default function MatchAnalysis() {
  const [showResults, setShowResults] = useState(true);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Match Analysis</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter team statistics and market odds to detect value.</p>
          </div>
          <Button variant="outline" size="sm"><Save className="w-4 h-4 mr-1" strokeWidth={1.5} /> Save</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 rounded-xl bg-card ring-surface p-6 card-shadow overflow-y-auto max-h-[calc(100vh-180px)]">
            <InputSection label="Home Team">
              <FormField label="Team Name" defaultValue="Arsenal" />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Total Matches" defaultValue="19" />
                <FormField label="Goals Scored (H)" defaultValue="38" />
                <FormField label="Goals Conceded (H)" defaultValue="12" />
                <FormField label="Recent Matches" defaultValue="5" />
                <FormField label="Recent Scored" defaultValue="12" />
                <FormField label="Recent Conceded" defaultValue="4" />
              </div>
            </InputSection>

            <InputSection label="Away Team">
              <FormField label="Team Name" defaultValue="Chelsea" />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Total Matches" defaultValue="19" />
                <FormField label="Goals Scored (A)" defaultValue="22" />
                <FormField label="Goals Conceded (A)" defaultValue="18" />
                <FormField label="Recent Matches" defaultValue="5" />
                <FormField label="Recent Scored" defaultValue="8" />
                <FormField label="Recent Conceded" defaultValue="7" />
              </div>
            </InputSection>

            <InputSection label="Market Odds">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Over 2.5" defaultValue="1.80" />
                <FormField label="Under 2.5" defaultValue="2.10" />
                <FormField label="Over 3.5" defaultValue="3.20" />
                <FormField label="Under 3.5" defaultValue="1.35" />
                <FormField label="BTTS Yes" defaultValue="1.75" />
                <FormField label="BTTS No" defaultValue="2.15" />
              </div>
            </InputSection>

            <InputSection label="Bankroll">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Bankroll ($)" defaultValue="5000" />
                <FormField label="Kelly Fraction" defaultValue="0.25" />
              </div>
            </InputSection>

            <Button variant="hero" className="w-full" size="lg" onClick={() => setShowResults(true)}>
              <Play className="w-4 h-4 mr-1" strokeWidth={1.5} /> Run Analysis
            </Button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-4">
            {showResults && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Home xG", value: "2.31" },
                    { label: "Away xG", value: "1.14" },
                    { label: "Total xG", value: "3.45" },
                    { label: "Confidence", value: "8.2" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl bg-card ring-surface p-4 card-shadow">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                      <p className="text-2xl font-bold font-mono-data text-foreground mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Betting Recommendation */}
                <div className="rounded-xl bg-card ring-surface p-5 card-shadow">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Betting Recommendation</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="text-primary font-semibold">Over 2.5 Goals</span> shows the strongest value edge at{" "}
                    <span className="font-mono-data text-primary font-bold">+11.8%</span>. With a confidence score of{" "}
                    <span className="font-mono-data font-bold text-foreground">9/10</span>, this is a high-conviction opportunity. Suggested Kelly stake:{" "}
                    <span className="font-mono-data font-bold text-foreground">$120</span>.
                  </p>
                </div>

                {/* Probability Chart */}
                <div className="rounded-xl bg-card ring-surface p-5 card-shadow">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Model vs Market Probability</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} width={70} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 7%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="model" fill="hsl(142, 71%, 45%)" radius={[0, 4, 4, 0]} barSize={12} name="Model" />
                      <Bar dataKey="implied" fill="hsl(222, 30%, 25%)" radius={[0, 4, 4, 0]} barSize={12} name="Market" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Results Table */}
                <div className="rounded-xl bg-card ring-surface card-shadow overflow-hidden">
                  <div className="p-5 pb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detailed Results</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t border-white/5">
                          {["Market", "Odds", "Model %", "Implied %", "Edge", "Kelly", "Stake", "Risk", "Conf.", "Decision"].map((h) => (
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {defaultResults.map((r) => (
                          <tr key={r.market} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{r.market}</td>
                            <td className="px-4 py-3 font-mono-data text-muted-foreground">{r.odds.toFixed(2)}</td>
                            <td className="px-4 py-3 font-mono-data text-foreground">{r.modelProb.toFixed(1)}%</td>
                            <td className="px-4 py-3 font-mono-data text-muted-foreground">{r.impliedProb.toFixed(1)}%</td>
                            <td className="px-4 py-3"><ValueBadge value={r.valueBet} /></td>
                            <td className="px-4 py-3 font-mono-data text-muted-foreground">{r.kelly.toFixed(1)}%</td>
                            <td className="px-4 py-3 font-mono-data text-foreground">${r.stake}</td>
                            <td className="px-4 py-3"><RiskBadge risk={r.risk} /></td>
                            <td className="px-4 py-3"><ConfidenceMeter score={r.confidence} className="w-16" /></td>
                            <td className="px-4 py-3"><DecisionBadge decision={r.decision} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Strongest Value */}
                <div className="rounded-xl bg-primary/5 ring-1 ring-primary/20 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Strongest Value Opportunity</h3>
                  </div>
                  <p className="text-lg font-bold text-foreground">Over 2.5 Goals</p>
                  <p className="text-sm text-muted-foreground mt-1">Edge: <span className="font-mono-data text-primary font-bold">+11.8%</span> · Kelly: <span className="font-mono-data font-bold">2.4%</span> · Confidence: <span className="font-mono-data font-bold">9/10</span></p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
