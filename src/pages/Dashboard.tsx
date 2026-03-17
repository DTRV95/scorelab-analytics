import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
import { ValueBadge, DecisionBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { BarChart3, TrendingUp, Target, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const recentAnalyses = [
  { match: "Arsenal vs Chelsea", market: "Over 2.5", edge: 8.4, confidence: 8, decision: "Bet" as const, date: "Today" },
  { match: "Liverpool vs Man City", market: "BTTS", edge: 5.2, confidence: 7, decision: "Bet" as const, date: "Today" },
  { match: "Tottenham vs Newcastle", market: "Under 3.5", edge: -2.1, confidence: 4, decision: "No Bet" as const, date: "Yesterday" },
  { match: "Man Utd vs Wolves", market: "Over 2.5", edge: 3.8, confidence: 6, decision: "Caution" as const, date: "Yesterday" },
  { match: "Everton vs Brighton", market: "BTTS No", edge: 6.1, confidence: 7, decision: "Bet" as const, date: "Yesterday" },
];

const trendData = [
  { name: "Mon", value: 3.2 },
  { name: "Tue", value: 5.8 },
  { name: "Wed", value: 4.1 },
  { name: "Thu", value: 7.2 },
  { name: "Fri", value: 6.5 },
  { name: "Sat", value: 8.4 },
  { name: "Sun", value: 5.9 },
];

const topValue = {
  match: "Arsenal vs Chelsea",
  market: "Over 2.5 Goals",
  odds: 1.80,
  modelProb: 67.4,
  impliedProb: 55.6,
  edge: 11.8,
  kelly: 2.4,
  confidence: 9,
  direction: "Over leaning",
  why: "Arsenal's home xG of 2.3 combined with Chelsea's away defensive fragility (1.8 xGA) strongly supports the over. The model finds significant edge vs market pricing.",
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Dashboard() {
  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Header */}
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Good afternoon, Analyst</h1>
          <p className="text-sm text-muted-foreground mt-1">Here's your daily intelligence briefing.</p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Analyses Today" value="12" change="+3 vs yesterday" changeType="positive" icon={<BarChart3 className="w-4 h-4" strokeWidth={1.5} />} />
          <StatCard label="Value Bets Found" value="5" change="41.6% hit rate" changeType="positive" icon={<TrendingUp className="w-4 h-4" strokeWidth={1.5} />} />
          <StatCard label="Avg. Confidence" value="7.2" change="+0.8 this week" changeType="positive" icon={<Target className="w-4 h-4" strokeWidth={1.5} />} />
          <StatCard label="Avg. xG" value="2.64" change="Across 12 matches" changeType="neutral" icon={<Zap className="w-4 h-4" strokeWidth={1.5} />} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          {/* Top Value Bet Today */}
          <motion.div variants={fadeUp} className="lg:col-span-2 rounded-2xl bg-card ring-1 ring-primary/10 p-6 card-shadow card-glow relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsla(142,71%,45%,0.04)_0%,_transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Top Value Bet Today</h2>
                <span className="px-2 py-1 rounded-md gradient-primary text-xs font-bold text-primary-foreground animate-pulse-glow">HOT</span>
              </div>
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-foreground">{topValue.match}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{topValue.market}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Model Prob.", value: `${topValue.modelProb}%`, color: "text-foreground" },
                      { label: "Implied Prob.", value: `${topValue.impliedProb}%`, color: "text-muted-foreground" },
                      { label: "Value Edge", value: `+${topValue.edge}%`, color: "text-primary" },
                      { label: "Kelly Stake", value: `${topValue.kelly}%`, color: "text-foreground" },
                    ].map((item, i) => (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.08 }}
                        className="rounded-xl bg-white/[0.03] ring-1 ring-white/5 p-3 hover:bg-white/[0.05] transition-colors"
                      >
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className={`text-xl font-bold font-mono-data ${item.color}`}>{item.value}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Confidence</p>
                    <ConfidenceMeter score={topValue.confidence} />
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Market Direction</p>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium ring-1 ring-primary/20">
                      <TrendingUp className="w-3 h-3" /> {topValue.direction}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Why this bet?</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{topValue.why}</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Market Trends */}
          <motion.div variants={fadeUp} className="rounded-2xl bg-card ring-surface p-6 card-shadow">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Edge Trend (7d)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData}>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(222, 47%, 7%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: "hsl(210, 40%, 98%)" }}
                  cursor={false}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {trendData.map((entry, index) => (
                    <Cell key={index} fill={entry.value >= 5 ? "hsl(142, 71%, 45%)" : "hsl(222, 30%, 20%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Bankroll Snapshot */}
        <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Bankroll" value="$5,000" change="Starting balance" changeType="neutral" mono />
          <StatCard label="Suggested Exposure" value="$320" change="6.4% of bankroll" changeType="neutral" mono />
          <StatCard label="Risk Level" value="Moderate" change="Based on Kelly" changeType="neutral" mono={false} />
        </motion.div>

        {/* Recent Analyses */}
        <motion.div variants={fadeUp} className="rounded-2xl bg-card ring-surface card-shadow overflow-hidden">
          <div className="p-6 pb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Analyses</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-t border-white/5">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Match</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Market</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Edge</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Confidence</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Decision</th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAnalyses.map((a, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="border-t border-white/5 hover:bg-white/[0.03] transition-all duration-200 cursor-pointer"
                  >
                    <td className="px-6 py-3.5 text-sm font-medium text-foreground">{a.match}</td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground">{a.market}</td>
                    <td className="px-6 py-3.5"><ValueBadge value={a.edge} /></td>
                    <td className="px-6 py-3.5"><ConfidenceMeter score={a.confidence} className="w-24" /></td>
                    <td className="px-6 py-3.5"><DecisionBadge decision={a.decision} /></td>
                    <td className="px-6 py-3.5 text-sm text-muted-foreground">{a.date}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
