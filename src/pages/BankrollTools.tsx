import { AppLayout } from "@/components/layout/AppLayout";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Wallet, Shield, TrendingDown, Calculator } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const projectionData = [
  { day: "Week 1", balance: 5000 },
  { day: "Week 2", balance: 5120 },
  { day: "Week 3", balance: 5340 },
  { day: "Week 4", balance: 5280 },
  { day: "Week 5", balance: 5510 },
  { day: "Week 6", balance: 5690 },
  { day: "Week 8", balance: 5850 },
  { day: "Week 10", balance: 6120 },
  { day: "Week 12", balance: 6400 },
];

export default function BankrollTools() {
  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Bankroll Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your bankroll and optimize stake sizing.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Current Bankroll" value="$5,000" icon={<Wallet className="w-4 h-4" strokeWidth={1.5} />} />
          <StatCard label="Risk Profile" value="Moderate" mono={false} icon={<Shield className="w-4 h-4" strokeWidth={1.5} />} />
          <StatCard label="Kelly Fraction" value="25%" icon={<Calculator className="w-4 h-4" strokeWidth={1.5} />} />
          <StatCard label="Risk of Ruin" value="2.1%" change="Very Low" changeType="positive" icon={<TrendingDown className="w-4 h-4" strokeWidth={1.5} />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bankroll Projection */}
          <div className="rounded-xl bg-card ring-surface p-6 card-shadow">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Bankroll Projection</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={projectionData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} domain={['dataMin - 200', 'dataMax + 200']} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 47%, 7%)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="balance" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={{ r: 3, fill: "hsl(142, 71%, 45%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Kelly Calculator */}
          <div className="rounded-xl bg-card ring-surface p-6 card-shadow">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Kelly Stake Calculator</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bankroll ($)</label>
                <input type="number" defaultValue="5000" className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Edge (%)</label>
                  <input type="number" defaultValue="8.4" className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Odds</label>
                  <input type="number" defaultValue="1.80" className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kelly Fraction</label>
                <select className="w-full h-9 px-3 rounded-lg input-surface text-sm text-foreground focus:outline-none bg-transparent">
                  <option value="1.0">Full Kelly (100%)</option>
                  <option value="0.5">Half Kelly (50%)</option>
                  <option value="0.25" selected>Quarter Kelly (25%)</option>
                  <option value="0.1">Tenth Kelly (10%)</option>
                </select>
              </div>
              <Button variant="hero" className="w-full" size="lg">Calculate Stake</Button>

              <div className="rounded-lg bg-white/[0.03] ring-1 ring-white/5 p-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Suggested Stake</span>
                  <span className="text-lg font-bold font-mono-data text-primary">$120</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">% of Bankroll</span>
                  <span className="text-sm font-mono-data text-foreground">2.4%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk of Ruin */}
          <div className="rounded-xl bg-card ring-surface p-6 card-shadow">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Risk of Ruin</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-20 h-20 rounded-full border-4 border-primary/30 flex items-center justify-center">
                <span className="text-xl font-bold font-mono-data text-primary">2.1%</span>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Very Low Risk</p>
                <p className="text-xs text-muted-foreground mt-1">Based on current Kelly fraction and average edge, your risk of losing 50%+ of bankroll is minimal.</p>
              </div>
            </div>
          </div>

          {/* Stake Sizing Guide */}
          <div className="rounded-xl bg-card ring-surface p-6 card-shadow">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Stake Sizing Guide</h2>
            <div className="space-y-3">
              {[
                { label: "High Confidence (8-10)", kelly: "Full Quarter Kelly", pct: "2-3%", color: "bg-primary" },
                { label: "Medium Confidence (5-7)", kelly: "Half Quarter Kelly", pct: "1-1.5%", color: "bg-warning" },
                { label: "Low Confidence (1-4)", kelly: "Skip or Minimum", pct: "0-0.5%", color: "bg-destructive" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 rounded-lg bg-white/[0.03] ring-1 ring-white/5 p-3">
                  <div className={`w-2 h-8 rounded-full ${item.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.kelly} · {item.pct} of bankroll</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
