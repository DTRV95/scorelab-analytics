import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ValueBadge, DecisionBadge, RiskBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Play, Save, ChevronDown, Lightbulb, Target } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Progress } from "@/components/ui/progress";

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

const loadingSteps = [
  "Running simulations...",
  "Calculating probabilities...",
  "Comparing market prices...",
  "Generating recommendations...",
];

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
        className="w-full h-9 px-3 rounded-xl input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all duration-200"
      />
    </div>
  );
}

export default function MatchAnalysis() {
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [whyExpanded, setWhyExpanded] = useState(false);

  const runAnalysis = () => {
    setIsLoading(true);
    setShowResults(false);
    setLoadingStep(0);
    setLoadingProgress(0);

    const totalDuration = 2400;
    const stepDuration = totalDuration / loadingSteps.length;

    loadingSteps.forEach((_, i) => {
      setTimeout(() => {
        setLoadingStep(i);
        setLoadingProgress(((i + 1) / loadingSteps.length) * 100);
      }, i * stepDuration);
    });

    setTimeout(() => {
      setIsLoading(false);
      setShowResults(true);
    }, totalDuration);
  };

  const bestBet = defaultResults.reduce((a, b) => a.valueBet > b.valueBet ? a : b);

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
          <div className="lg:col-span-2 rounded-2xl bg-card ring-surface p-6 card-shadow overflow-y-auto max-h-[calc(100vh-180px)]">
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

            <Button variant="hero" className="w-full" size="lg" onClick={runAnalysis} disabled={isLoading}>
              <Play className="w-4 h-4 mr-1" strokeWidth={1.5} /> {isLoading ? "Running..." : "Run Analysis"}
            </Button>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-4">
            {/* Loading State */}
            <AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="rounded-2xl bg-card ring-surface p-8 card-shadow"
                >
                  <div className="text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary mx-auto mb-4"
                    />
                    <motion.p
                      key={loadingStep}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-medium text-foreground mb-2"
                    >
                      {loadingSteps[loadingStep]}
                    </motion.p>
                    <Progress value={loadingProgress} className="h-1.5 bg-white/5 mb-2" />
                    <p className="text-xs text-muted-foreground">{Math.round(loadingProgress)}% complete</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showResults && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Home xG", value: "2.31" },
                    { label: "Away xG", value: "1.14" },
                    { label: "Total xG", value: "3.45" },
                    { label: "Confidence", value: "8.2" },
                  ].map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="rounded-2xl bg-card ring-surface p-4 card-shadow group hover:card-shadow-hover transition-all duration-300"
                    >
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
                      <p className="text-2xl font-bold font-mono-data text-foreground mt-1">{s.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Why This Bet - Expandable */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-primary/5 ring-1 ring-primary/20 card-shadow overflow-hidden"
                >
                  <button
                    onClick={() => setWhyExpanded(!whyExpanded)}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-primary/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-primary" strokeWidth={1.5} />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Why This Bet?</h3>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-primary transition-transform duration-300 ${whyExpanded ? "rotate-180" : ""}`} />
                  </button>
                  <AnimatePresence>
                    {whyExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-xl bg-white/[0.03] p-3">
                              <p className="text-xs text-muted-foreground">Expected Goals</p>
                              <p className="text-lg font-bold font-mono-data text-foreground">3.45</p>
                              <p className="text-xs text-muted-foreground">Home 2.31 + Away 1.14</p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] p-3">
                              <p className="text-xs text-muted-foreground">Probability Advantage</p>
                              <p className="text-lg font-bold font-mono-data text-primary">+11.8%</p>
                              <p className="text-xs text-muted-foreground">Model vs Market</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Arsenal's home xG of 2.3 combined with Chelsea's away defensive fragility (1.8 xGA) strongly supports the over. The model finds significant edge vs market pricing. Kelly criterion suggests a 2.4% stake.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

                {/* Betting Recommendation */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-card ring-surface p-5 card-shadow"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Betting Recommendation</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    <span className="text-primary font-semibold">Over 2.5 Goals</span> shows the strongest value edge at{" "}
                    <span className="font-mono-data text-primary font-bold">+11.8%</span>. With a confidence score of{" "}
                    <span className="font-mono-data font-bold text-foreground">9/10</span>, this is a high-conviction opportunity. Suggested Kelly stake:{" "}
                    <span className="font-mono-data font-bold text-foreground">$120</span>.
                  </p>
                </motion.div>

                {/* Probability Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-card ring-surface p-5 card-shadow"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Model vs Market Probability</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} width={70} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 7%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                      <Bar dataKey="model" fill="hsl(142, 71%, 45%)" radius={[0, 6, 6, 0]} barSize={12} name="Model" />
                      <Bar dataKey="implied" fill="hsl(222, 30%, 25%)" radius={[0, 6, 6, 0]} barSize={12} name="Market" />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>

                {/* Results Table */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="rounded-2xl bg-card ring-surface card-shadow overflow-hidden"
                >
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
                        {defaultResults.map((r, i) => (
                          <motion.tr
                            key={r.market}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.05 }}
                            className={`border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 ${r.market === bestBet.market ? "bg-primary/[0.03]" : ""}`}
                          >
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
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {/* Strongest Value */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className="rounded-2xl bg-primary/5 ring-1 ring-primary/20 p-5 card-glow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">Strongest Value Opportunity</h3>
                  </div>
                  <p className="text-lg font-bold text-foreground">Over 2.5 Goals</p>
                  <p className="text-sm text-muted-foreground mt-1">Edge: <span className="font-mono-data text-primary font-bold">+11.8%</span> · Kelly: <span className="font-mono-data font-bold">2.4%</span> · Confidence: <span className="font-mono-data font-bold">9/10</span></p>
                </motion.div>
              </motion.div>
            )}

            {/* Empty state */}
            {!showResults && !isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl bg-card ring-surface p-16 card-shadow text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Analyze</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">Fill in the match data on the left and click "Run Analysis" to detect value opportunities.</p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
