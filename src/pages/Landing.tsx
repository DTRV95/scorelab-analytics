import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { ValueBadge, DecisionBadge, SpecialBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import {
  BarChart3,
  ArrowRight,
  ArrowUpDown,
  Brain,
  Dices,
  Scale,
  Shield,
  Flame,
  Zap,
  TrendingUp,
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
  }),
};

interface Opportunity {
  match: string;
  league: string;
  market: string;
  odds: number;
  modelProb: number;
  valueBet: number;
  confidence: number;
  decision: "Bet" | "No Bet" | "Caution";
  tags?: string[];
}

const todayOpportunities: Opportunity[] = [
  { match: "Arsenal vs Chelsea", league: "Premier League", market: "Over 2.5", odds: 1.80, modelProb: 67.4, valueBet: 11.8, confidence: 9, decision: "Bet", tags: ["High scoring expectation"] },
  { match: "Barcelona vs Real Madrid", league: "La Liga", market: "Over 2.5", odds: 1.65, modelProb: 72.8, valueBet: 8.3, confidence: 8, decision: "Bet", tags: ["Strong model agreement"] },
  { match: "Bayern vs Dortmund", league: "Bundesliga", market: "Over 3.5", odds: 2.60, modelProb: 45.2, valueBet: 7.1, confidence: 7, decision: "Bet" },
  { match: "Ajax vs PSV", league: "Eredivisie", market: "Over 3.5", odds: 2.80, modelProb: 42.0, valueBet: 9.6, confidence: 8, decision: "Bet", tags: ["High scoring expectation"] },
  { match: "Liverpool vs Man City", league: "Premier League", market: "BTTS Yes", odds: 1.75, modelProb: 62.1, valueBet: 5.0, confidence: 7, decision: "Bet" },
  { match: "Juventus vs AC Milan", league: "Serie A", market: "Under 2.5", odds: 1.90, modelProb: 58.4, valueBet: 5.8, confidence: 7, decision: "Bet" },
  { match: "PSG vs Marseille", league: "Ligue 1", market: "BTTS Yes", odds: 2.00, modelProb: 54.3, valueBet: 4.2, confidence: 6, decision: "Caution" },
  { match: "Tottenham vs Newcastle", league: "Premier League", market: "Over 2.5", odds: 2.10, modelProb: 49.8, valueBet: -2.1, confidence: 4, decision: "No Bet" },
];

type SortKey = "valueBet" | "confidence";

const howItWorks = [
  { icon: Brain, title: "Poisson Model", desc: "Calculates goal probabilities from historical scoring rates." },
  { icon: Dices, title: "Monte Carlo Simulation", desc: "Thousands of simulated matches for robust estimates." },
  { icon: Scale, title: "Value Bet Detection", desc: "Compares model vs market odds to find mispriced outcomes." },
  { icon: Shield, title: "Kelly Criterion", desc: "Optimal stake sizing based on your edge and bankroll." },
];

export default function Landing() {
  const [sortBy, setSortBy] = useState<SortKey>("valueBet");

  const sorted = [...todayOpportunities].sort((a, b) =>
    sortBy === "valueBet" ? b.valueBet - a.valueBet : b.confidence - a.confidence
  );

  const bestValue = sorted[0];

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14 px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg gradient-primary flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-foreground text-lg tracking-tight">ScoreLab</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" size="sm">Log In</Button></Link>
            <Link to="/signup"><Button variant="hero" size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* SECTION 1 — Games Today (Hero) */}
      <section className="pt-20 pb-6 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}>
            <motion.div variants={fadeIn} custom={0} className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full ring-1 ring-white/10 bg-white/5 text-xs text-muted-foreground mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  Live · {todayOpportunities.length} markets scanned
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">Today's Value Opportunities</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sort by</span>
                <button
                  onClick={() => setSortBy(sortBy === "valueBet" ? "confidence" : "valueBet")}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg input-surface text-xs text-foreground hover:bg-white/[0.08] transition-colors"
                >
                  <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                  {sortBy === "valueBet" ? "Value %" : "Confidence"}
                </button>
              </div>
            </motion.div>

            {/* Opportunity Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {sorted.map((opp, i) => (
                <motion.div
                  key={opp.match + opp.market}
                  variants={fadeIn}
                  custom={i + 1}
                  whileHover={{ y: -3, scale: 1.015 }}
                  className={`rounded-2xl bg-card ring-surface p-4 card-shadow transition-all duration-300 cursor-pointer group ${
                    opp.valueBet >= 8 ? "ring-1 ring-primary/20" : ""
                  }`}
                >
                  <Link to="/analysis" className="block">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{opp.match}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{opp.league} · {opp.market}</p>
                      </div>
                      <DecisionBadge decision={opp.decision} />
                    </div>

                    {/* Core Data */}
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Odds</p>
                        <p className="font-mono-data text-sm text-foreground">{opp.odds.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Model</p>
                        <p className="font-mono-data text-sm text-foreground">{opp.modelProb.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Edge</p>
                        <ValueBadge value={opp.valueBet} />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conf.</p>
                        <ConfidenceMeter score={opp.confidence} className="mt-1" />
                      </div>
                    </div>

                    {/* Tags */}
                    {opp.tags && (
                      <div className="flex flex-wrap gap-1.5">
                        {opp.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary ring-1 ring-primary/10">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {opp.valueBet >= 9 && (
                      <div className="mt-2">
                        <SpecialBadge type="high-value" />
                      </div>
                    )}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 2 — Best Value Today */}
      <section className="py-6 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="rounded-2xl bg-card ring-1 ring-primary/20 p-5 md:p-6 card-shadow card-glow relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsla(142,71%,45%,0.06)_0%,_transparent_60%)]" />
            <div className="relative flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Flame className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-primary font-semibold uppercase tracking-wider">Best Value Today</p>
                  <p className="text-lg font-bold text-foreground">{bestValue.match}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-6 md:ml-auto">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Market</p>
                  <p className="text-sm text-foreground font-medium">{bestValue.market}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Edge</p>
                  <p className="font-mono-data text-xl font-bold text-primary">+{bestValue.valueBet.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Confidence</p>
                  <ConfidenceMeter score={bestValue.confidence} className="w-20 mt-1" />
                </div>
                <Link to="/analysis">
                  <Button variant="hero" size="sm">
                    View Analysis <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 3 — Micro Explanation */}
      <section className="py-8 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-3 rounded-xl bg-white/[0.02] ring-1 ring-white/5 px-5 py-4"
          >
            <Zap className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Data-driven insights powered by probabilistic models, Monte Carlo simulations, and market inefficiency detection.
            </p>
          </motion.div>
        </div>
      </section>

      {/* SECTION 4 — How It Works */}
      <section className="py-10 px-4 md:px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-lg font-semibold text-foreground mb-6"
          >
            How ScoreLab Works
          </motion.h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {howItWorks.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -2 }}
                className="rounded-xl bg-card ring-surface p-4 card-shadow transition-all duration-300"
              >
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <step.icon className="w-4 h-4 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5 — CTA */}
      <section className="py-12 px-4 md:px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-card ring-surface p-6 card-shadow"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-foreground font-semibold">Run your own analysis</p>
                <p className="text-xs text-muted-foreground">Input any match. Get probabilities, edges, and optimal stakes.</p>
              </div>
            </div>
            <Link to="/analysis">
              <Button variant="hero" size="lg">
                Start Analysis <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 px-4 md:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded gradient-primary flex items-center justify-center">
              <BarChart3 className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="text-xs font-semibold text-foreground">ScoreLab</span>
            <span className="text-[11px] text-muted-foreground ml-1">Where statistics meet betting strategy.</span>
          </div>
          <p className="text-[11px] text-muted-foreground">© 2026 ScoreLab. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
