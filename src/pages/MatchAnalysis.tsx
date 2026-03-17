import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ValueBadge, DecisionBadge, RiskBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Play, Save, ChevronDown, Lightbulb, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Progress } from "@/components/ui/progress";

type RiskLevel = "Low" | "Medium" | "High";
type DecisionType = "Bet" | "No Bet" | "Caution";

interface AnalysisResult {
  market: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  valueBet: number;
  kelly: number;
  stake: number;
  risk: RiskLevel;
  confidence: number;
  decision: DecisionType;
}

interface BackendMarket {
  mercado: string;
  odd: number;
  prob_usada_pct: number;
  prob_implicita_pct: number;
  value_bet_pct: number;
  kelly_pct: number;
  stake_sugerida: number;
  risco: number;
  confianca: number;
  classificacao: string;
  decisao: string;
}

interface BackendResponse {
  lambda_casa: number;
  lambda_fora: number;
  total_golos_esperados: number;
  mercados: BackendMarket[];
}

interface FormData {
  homeTeam: string;
  homeTotalMatches: string;
  homeGoalsScored: string;
  homeGoalsConceded: string;
  homeRecentMatches: string;
  homeRecentScored: string;
  homeRecentConceded: string;

  awayTeam: string;
  awayTotalMatches: string;
  awayGoalsScored: string;
  awayGoalsConceded: string;
  awayRecentMatches: string;
  awayRecentScored: string;
  awayRecentConceded: string;

  over25: string;
  under25: string;
  over35: string;
  under35: string;
  bttsYes: string;
  bttsNo: string;

  bankroll: string;
  kellyFraction: string;
}

const initialFormData: FormData = {
  homeTeam: "Arsenal",
  homeTotalMatches: "19",
  homeGoalsScored: "38",
  homeGoalsConceded: "12",
  homeRecentMatches: "5",
  homeRecentScored: "12",
  homeRecentConceded: "4",

  awayTeam: "Chelsea",
  awayTotalMatches: "19",
  awayGoalsScored: "22",
  awayGoalsConceded: "18",
  awayRecentMatches: "5",
  awayRecentScored: "8",
  awayRecentConceded: "7",

  over25: "1.80",
  under25: "2.10",
  over35: "3.20",
  under35: "1.35",
  bttsYes: "1.75",
  bttsNo: "2.15",

  bankroll: "5000",
  kellyFraction: "0.25",
};

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

function FormField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 rounded-xl input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all duration-200"
      />
    </div>
  );
}

function mapRisk(risco: number): RiskLevel {
  if (risco <= 2) return "Low";
  if (risco === 3) return "Medium";
  return "High";
}

function mapDecision(decisao: string): DecisionType {
  const d = decisao.toLowerCase().trim();

  if (d.includes("não apostar") || d.includes("nao apostar")) return "No Bet";
  if (d.includes("caution")) return "Caution";
  if (d.includes("apostar")) return "Bet";

  return "No Bet";
}

function mapMarketName(name: string): string {
  const normalized = name.toLowerCase();

  if (normalized.includes("mais de 2.5")) return "Over 2.5";
  if (normalized.includes("menos de 2.5")) return "Under 2.5";
  if (normalized.includes("mais de 3.5")) return "Over 3.5";
  if (normalized.includes("menos de 3.5")) return "Under 3.5";
  if (normalized.includes("ambas marcam")) return "BTTS Yes";
  if (normalized.includes("ambas não marcam") || normalized.includes("ambas nao marcam")) return "BTTS No";

  return name;
}

export default function MatchAnalysis() {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [summary, setSummary] = useState({
    homeXg: 0,
    awayXg: 0,
    totalXg: 0,
    confidence: 0,
  });

  const updateField = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

 const bestBet = useMemo(() => {
  if (!results.length) return null;

  const positiveBets = results.filter((r) => r.valueBet > 0);
  if (!positiveBets.length) return null;

  return positiveBets.reduce((a, b) => (a.valueBet > b.valueBet ? a : b));
}, [results]);

  const chartData = useMemo(
    () =>
      results.map((r) => ({
        name: r.market,
        model: r.modelProb,
        implied: r.impliedProb,
      })),
    [results]
  );

  const whyThisBetText = useMemo(() => {
    if (!bestBet) return "";

    return `${bestBet.market} shows the strongest edge with a ${bestBet.valueBet.toFixed(
      1
    )}% model advantage over the market. The model suggests ${
      bestBet.kelly
    }% Kelly exposure with a confidence score of ${bestBet.confidence}/10. Total expected goals are ${summary.totalXg.toFixed(
      2
    )}, supporting this recommendation.`;
  }, [bestBet, summary.totalXg]);

  const runAnalysis = async () => {
    setIsLoading(true);
    setShowResults(false);
    setLoadingStep(0);
    setLoadingProgress(0);
    setErrorMessage("");

    const totalDuration = 2400;
    const stepDuration = totalDuration / loadingSteps.length;

    loadingSteps.forEach((_, i) => {
      setTimeout(() => {
        setLoadingStep(i);
        setLoadingProgress(((i + 1) / loadingSteps.length) * 100);
      }, i * stepDuration);
    });

    try {
      const payload = {
        equipa_casa: formData.homeTeam,
        equipa_fora: formData.awayTeam,

        jogos_casa: Number(formData.homeTotalMatches),
        golos_marcados_casa: Number(formData.homeGoalsScored),
        golos_sofridos_casa: Number(formData.homeGoalsConceded),
        jogos_casa_rec: Number(formData.homeRecentMatches),
        golos_marcados_casa_rec: Number(formData.homeRecentScored),
        golos_sofridos_casa_rec: Number(formData.homeRecentConceded),

        jogos_fora: Number(formData.awayTotalMatches),
        golos_marcados_fora: Number(formData.awayGoalsScored),
        golos_sofridos_fora: Number(formData.awayGoalsConceded),
        jogos_fora_rec: Number(formData.awayRecentMatches),
        golos_marcados_fora_rec: Number(formData.awayRecentScored),
        golos_sofridos_fora_rec: Number(formData.awayRecentConceded),

        odd_mais_25: Number(formData.over25),
        odd_menos_25: Number(formData.under25),
        odd_mais_35: Number(formData.over35),
        odd_menos_35: Number(formData.under35),
        odd_ambas_marcam: Number(formData.bttsYes),
        odd_ambas_nao_marcam: Number(formData.bttsNo),

        banca: Number(formData.bankroll),
        fracao_kelly: Number(formData.kellyFraction),
      };

      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze match.");
      }

      const data: BackendResponse = await response.json();

      const mappedResults: AnalysisResult[] = data.mercados.map((m) => ({
        market: mapMarketName(m.mercado),
        odds: m.odd,
        modelProb: Number(m.prob_usada_pct.toFixed(1)),
        impliedProb: Number(m.prob_implicita_pct.toFixed(1)),
        valueBet: Number(m.value_bet_pct.toFixed(1)),
        kelly: Number(m.kelly_pct.toFixed(1)),
        stake: Number(m.stake_sugerida.toFixed(0)),
        risk: mapRisk(m.risco),
        confidence: Number(m.confianca.toFixed(0)),
        decision: mapDecision(m.decisao),
      }));

      const avgConfidence =
        mappedResults.length > 0
          ? mappedResults.reduce((acc, item) => acc + item.confidence, 0) / mappedResults.length
          : 0;

      setResults(mappedResults);
      setSummary({
        homeXg: data.lambda_casa,
        awayXg: data.lambda_fora,
        totalXg: data.total_golos_esperados,
        confidence: Number(avgConfidence.toFixed(1)),
      });

      setShowResults(true);
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not connect to the analysis engine. Make sure the backend API is running.");
      setShowResults(false);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, totalDuration);
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Match Analysis</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter team statistics and market odds to detect value.</p>
          </div>
          <Button variant="outline" size="sm">
            <Save className="w-4 h-4 mr-1" strokeWidth={1.5} /> Save
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Input Panel */}
          <div className="lg:col-span-2 rounded-2xl bg-card ring-surface p-6 card-shadow overflow-y-auto max-h-[calc(100vh-180px)]">
            <InputSection label="Home Team">
              <FormField label="Team Name" value={formData.homeTeam} onChange={(v) => updateField("homeTeam", v)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Total Matches" value={formData.homeTotalMatches} onChange={(v) => updateField("homeTotalMatches", v)} />
                <FormField label="Goals Scored (H)" value={formData.homeGoalsScored} onChange={(v) => updateField("homeGoalsScored", v)} />
                <FormField label="Goals Conceded (H)" value={formData.homeGoalsConceded} onChange={(v) => updateField("homeGoalsConceded", v)} />
                <FormField label="Recent Matches" value={formData.homeRecentMatches} onChange={(v) => updateField("homeRecentMatches", v)} />
                <FormField label="Recent Scored" value={formData.homeRecentScored} onChange={(v) => updateField("homeRecentScored", v)} />
                <FormField label="Recent Conceded" value={formData.homeRecentConceded} onChange={(v) => updateField("homeRecentConceded", v)} />
              </div>
            </InputSection>

            <InputSection label="Away Team">
              <FormField label="Team Name" value={formData.awayTeam} onChange={(v) => updateField("awayTeam", v)} />
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Total Matches" value={formData.awayTotalMatches} onChange={(v) => updateField("awayTotalMatches", v)} />
                <FormField label="Goals Scored (A)" value={formData.awayGoalsScored} onChange={(v) => updateField("awayGoalsScored", v)} />
                <FormField label="Goals Conceded (A)" value={formData.awayGoalsConceded} onChange={(v) => updateField("awayGoalsConceded", v)} />
                <FormField label="Recent Matches" value={formData.awayRecentMatches} onChange={(v) => updateField("awayRecentMatches", v)} />
                <FormField label="Recent Scored" value={formData.awayRecentScored} onChange={(v) => updateField("awayRecentScored", v)} />
                <FormField label="Recent Conceded" value={formData.awayRecentConceded} onChange={(v) => updateField("awayRecentConceded", v)} />
              </div>
            </InputSection>

            <InputSection label="Market Odds">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Over 2.5" value={formData.over25} onChange={(v) => updateField("over25", v)} />
                <FormField label="Under 2.5" value={formData.under25} onChange={(v) => updateField("under25", v)} />
                <FormField label="Over 3.5" value={formData.over35} onChange={(v) => updateField("over35", v)} />
                <FormField label="Under 3.5" value={formData.under35} onChange={(v) => updateField("under35", v)} />
                <FormField label="BTTS Yes" value={formData.bttsYes} onChange={(v) => updateField("bttsYes", v)} />
                <FormField label="BTTS No" value={formData.bttsNo} onChange={(v) => updateField("bttsNo", v)} />
              </div>
            </InputSection>

            <InputSection label="Bankroll">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Bankroll ($)" value={formData.bankroll} onChange={(v) => updateField("bankroll", v)} />
                <FormField label="Kelly Fraction" value={formData.kellyFraction} onChange={(v) => updateField("kellyFraction", v)} />
              </div>
            </InputSection>

            <Button variant="hero" className="w-full" size="lg" onClick={runAnalysis} disabled={isLoading}>
              <Play className="w-4 h-4 mr-1" strokeWidth={1.5} /> {isLoading ? "Running..." : "Run Analysis"}
            </Button>

            {errorMessage && (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-3 space-y-4">
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

            {showResults && results.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="space-y-4">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Home xG", value: summary.homeXg.toFixed(2) },
                    { label: "Away xG", value: summary.awayXg.toFixed(2) },
                    { label: "Total xG", value: summary.totalXg.toFixed(2) },
                    { label: "Confidence", value: summary.confidence.toFixed(1) },
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

                {/* Why This Bet */}
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
                              <p className="text-lg font-bold font-mono-data text-foreground">{summary.totalXg.toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                Home {summary.homeXg.toFixed(2)} + Away {summary.awayXg.toFixed(2)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] p-3">
                              <p className="text-xs text-muted-foreground">Probability Advantage</p>
                              <p className="text-lg font-bold font-mono-data text-primary">
                                {bestBet ? `${bestBet.valueBet.toFixed(1)}%` : "--"}
                              </p>
                              <p className="text-xs text-muted-foreground">Model vs Market</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {whyThisBetText || "Run an analysis to understand the strongest opportunity."}
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
                  {bestBet ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="text-primary font-semibold">{bestBet.market}</span> shows the strongest value edge at{" "}
                      <span className="font-mono-data text-primary font-bold">{bestBet.valueBet.toFixed(1)}%</span>. With a confidence score of{" "}
                      <span className="font-mono-data font-bold text-foreground">{bestBet.confidence}/10</span>, this is the best current opportunity.
                      Suggested Kelly stake:{" "}
                      <span className="font-mono-data font-bold text-foreground">${bestBet.stake}</span>.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recommendation available.</p>
                  )}
                </motion.div>

                {/* Probability Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl bg-card ring-surface p-5 card-shadow"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Model vs Market Probability</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={chartData} layout="vertical">
                      <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} width={85} />
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
                            <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-2.5">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <motion.tr
                            key={r.market}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.05 }}
                            className={`border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 ${
                              bestBet && r.market === bestBet.market ? "bg-primary/[0.03]" : ""
                            }`}
                          >
                            <td className="px-4 py-3 font-medium text-foreground">{r.market}</td>
                            <td className="px-4 py-3 font-mono-data text-muted-foreground">{r.odds.toFixed(2)}</td>
                            <td className="px-4 py-3 font-mono-data text-foreground">{r.modelProb.toFixed(1)}%</td>
                            <td className="px-4 py-3 font-mono-data text-muted-foreground">{r.impliedProb.toFixed(1)}%</td>
                            <td className="px-4 py-3">
                              <ValueBadge value={r.valueBet} />
                            </td>
                            <td className="px-4 py-3 font-mono-data text-muted-foreground">{r.kelly.toFixed(1)}%</td>
                            <td className="px-4 py-3 font-mono-data text-foreground">${r.stake}</td>
                            <td className="px-4 py-3">
                              <RiskBadge risk={r.risk} />
                            </td>
                            <td className="px-4 py-3">
                              <ConfidenceMeter score={r.confidence} className="w-16" />
                            </td>
                            <td className="px-4 py-3">
                              <DecisionBadge decision={r.decision} />
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>

                {/* Strongest Value */}
                {bestBet && (
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
                    <p className="text-lg font-bold text-foreground">{bestBet.market}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Edge: <span className="font-mono-data text-primary font-bold">{bestBet.valueBet.toFixed(1)}%</span> · Kelly:{" "}
                      <span className="font-mono-data font-bold">{bestBet.kelly.toFixed(1)}%</span> · Confidence:{" "}
                      <span className="font-mono-data font-bold">{bestBet.confidence}/10</span>
                    </p>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Empty state */}
            {!showResults && !isLoading && !errorMessage && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-card ring-surface p-16 card-shadow text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Ready to Analyze</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Fill in the match data on the left and click "Run Analysis" to detect value opportunities.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
