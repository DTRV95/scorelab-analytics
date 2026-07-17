import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useTransform, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Shield,
  Zap,
  Clock,
  Download,
  BookmarkCheck,
  Check,
  ArrowRight,
  ChevronRight,
  Star,
  Radar,
  Brain,
  Dices,
  Scale,
  Crosshair,
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
  }),
};

const features = [
  { icon: BarChart3, title: "Poisson Probability Engine", desc: "Model match outcomes using advanced statistical distributions." },
  { icon: TrendingUp, title: "Value Bet Detection", desc: "Compare model probabilities against market odds to find edges." },
  { icon: Target, title: "Kelly Stake Calculator", desc: "Optimal position sizing based on your edge and bankroll." },
  { icon: Shield, title: "Confidence Scoring", desc: "0–10 confidence meter backed by data quality signals." },
  { icon: Clock, title: "Match History", desc: "Track and review every analysis you've run." },
  { icon: Zap, title: "Daily Edge Dashboard", desc: "Pre-scanned daily opportunities ranked by value." },
  { icon: Download, title: "Export to Excel", desc: "Download analyses and reports in structured formats." },
  { icon: BookmarkCheck, title: "Saved Analyses", desc: "Bookmark and organize your most important predictions." },
];

const steps = [
  { num: "01", title: "Input Match Data", desc: "Enter team stats, recent form, and market odds." },
  { num: "02", title: "Run the Model", desc: "Our Poisson engine calculates true probabilities." },
  { num: "03", title: "Detect Value", desc: "Compare model vs market to find mispriced bets." },
  { num: "04", title: "Size Your Stake", desc: "Kelly criterion optimizes your position." },
];

const radarPreview: Array<{ home: string; away: string; league: string; market: string; odds: number; modelProb: number; edge: number; conf: number; decision: "Bet" | "Caution" | "No Bet"; tag?: string; best?: boolean }> = [
  { home: "Arsenal", away: "Chelsea", league: "Premier League", market: "Over 2.5", odds: 1.80, modelProb: 67.4, edge: 11.8, conf: 9, decision: "Bet", tag: "High scoring expectation", best: true },
  { home: "Liverpool", away: "Man City", league: "Premier League", market: "BTTS Yes", odds: 1.75, modelProb: 62.1, edge: 5.0, conf: 7, decision: "Bet", tag: "Strong model agreement" },
  { home: "Barcelona", away: "Real Madrid", league: "La Liga", market: "Over 3.5", odds: 2.80, modelProb: 42.3, edge: 6.6, conf: 7, decision: "Bet" },
  { home: "Bayern", away: "Dortmund", league: "Bundesliga", market: "Over 2.5", odds: 1.55, modelProb: 72.8, edge: 8.3, conf: 8, decision: "Bet", tag: "Strong model agreement" },
  { home: "PSG", away: "Lyon", league: "Ligue 1", market: "BTTS Yes", odds: 1.90, modelProb: 58.4, edge: 5.8, conf: 6, decision: "Caution" },
  { home: "Juventus", away: "AC Milan", league: "Serie A", market: "Under 2.5", odds: 1.95, modelProb: 54.2, edge: 2.9, conf: 5, decision: "Caution" },
];

const thinkingSteps = [
  { icon: Brain, title: "Poisson Model", desc: "Calculates goal probabilities from historical scoring rates using statistical distributions." },
  { icon: Dices, title: "Monte Carlo Simulation", desc: "Runs thousands of match simulations to generate robust probability estimates." },
  { icon: Scale, title: "Value Betting Logic", desc: "Compares model probabilities vs market odds to identify mispriced outcomes." },
];

const whyDifferent = [
  "Not predictions — probabilities",
  "Not guessing — data-driven decisions",
  "Real market comparison",
  "Built for long-term edge",
];

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Get started with basic analysis tools.",
    features: ["5 analyses per day", "Basic Poisson model", "Single match analysis", "Community support"],
    cta: "Start Free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    desc: "For serious analysts who need an edge.",
    features: ["Unlimited analyses", "Advanced models", "Daily opportunities", "Export to Excel", "Match history", "Priority support"],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Premium",
    price: "$79",
    period: "/month",
    desc: "The full intelligence toolkit.",
    features: ["Everything in Pro", "API access", "Custom models", "Bankroll tools", "Team collaboration", "Dedicated support", "Early feature access"],
    cta: "Go Premium",
    highlighted: false,
  },
];

const testimonials = [
  { name: "Marcus K.", role: "Professional Bettor", quote: "ScoreLab transformed my approach. The edge detection is incredibly precise.", rating: 5 },
  { name: "Sarah T.", role: "Data Analyst", quote: "Finally a platform that treats betting like quantitative analysis. Clean, fast, reliable.", rating: 5 },
  { name: "James R.", role: "Bankroll Manager", quote: "The Kelly calculator alone has improved my ROI by 12% over 6 months.", rating: 5 },
];

function AnimatedCounter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const duration = 1500;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start * 10) / 10);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref} className="font-mono-data">{count.toFixed(target % 1 !== 0 ? 1 : 0)}{suffix}</span>;
}

export default function Landing() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const glowX = useTransform(mouseX, [0, 1400], [-120, 120]);
  const glowY = useTransform(mouseY, [0, 900], [-80, 80]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground antialiased">
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_15%_12%,rgba(34,211,238,0.14),transparent_20%),radial-gradient(circle_at_82%_10%,rgba(34,197,94,0.12),transparent_18%),radial-gradient(circle_at_18%_42%,rgba(34,211,238,0.08),transparent_24%),radial-gradient(circle_at_76%_58%,rgba(34,197,94,0.07),transparent_22%),radial-gradient(circle_at_50%_82%,rgba(34,211,238,0.07),transparent_24%),linear-gradient(180deg,rgba(6,11,20,1)_0%,rgba(7,17,31,1)_30%,rgba(6,13,24,1)_64%,rgba(5,12,21,1)_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] [background-size:88px_88px] opacity-40" />
      {/* Nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/8 bg-background/66 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-primary/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,197,94,0.18))] shadow-[0_10px_30px_rgba(34,211,238,0.18)]">
              <div className="absolute inset-[1px] rounded-[11px] bg-[linear-gradient(180deg,rgba(7,17,31,0.92),rgba(12,27,40,0.82))]" />
              <BarChart3 className="relative w-4 h-4 text-cyan-100" strokeWidth={1.7} />
            </div>
            <div>
              <span className="block bg-[linear-gradient(90deg,#ffffff_0%,#9fe8ff_40%,#8ef0c2_100%)] bg-clip-text text-lg font-black tracking-[-0.04em] text-transparent">ScoreLab</span>
              <span className="-mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.22em] text-white/34 sm:block">Betting Intelligence OS</span>
            </div>
          </Link>
          <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.035] p-1 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.045)] md:flex">
            <a href="#features" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.06] hover:text-foreground">Features</a>
            <a href="#how-it-works" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.06] hover:text-foreground">Workflow</a>
            <a href="#pricing" className="rounded-full px-4 py-2 transition-colors hover:bg-white/[0.06] hover:text-foreground">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:block"><Button variant="ghost" size="sm">Log In</Button></Link>
            <Link to="/signup"><Button variant="hero" size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-20 pt-28 sm:px-6 md:pb-24 md:pt-32" onMouseMove={handleMouseMove}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <motion.div
          className="absolute left-1/2 top-24 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          style={{ x: glowX, y: glowY }}
        />
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsla(142,71%,45%,0.04) 0%, transparent 70%)",
              top: "10%",
              left: "60%",
            }}
            animate={{
              x: [0, 30, -20, 0],
              y: [0, -20, 30, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsla(222,47%,20%,0.15) 0%, transparent 70%)",
              top: "50%",
              left: "20%",
            }}
            animate={{
              x: [0, -30, 20, 0],
              y: [0, 20, -30, 0],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl lg:grid lg:grid-cols-[1fr_0.84fr] lg:items-start lg:gap-10">
          <motion.div
            className="max-w-3xl relative z-10 lg:-mt-6"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            <motion.div variants={fadeIn} custom={0} className="mb-6">
              <Badge variant="outline" className="gap-2 border-primary/18 bg-[linear-gradient(90deg,rgba(34,211,238,0.09),rgba(34,197,94,0.08))] py-1.5 text-muted-foreground shadow-[0_0_24px_rgba(34,211,238,0.08)]">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Football Betting Intelligence Platform
              </Badge>
            </motion.div>
            <motion.h1 variants={fadeIn} custom={1} className="max-w-4xl text-5xl font-black leading-[0.96] tracking-[-0.065em] text-foreground md:text-7xl xl:text-[5.65rem]">
              Football Betting{" "}
              <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_45%,#8be9ff_100%)] bg-clip-text text-transparent">
                Intelligence
              </span>
              ,{" "}
              <span className="text-gradient-primary">Reimagined</span>
            </motion.h1>
            <motion.p variants={fadeIn} custom={2} className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              A premium football analysis workspace for probability, value detection, bankroll discipline and model calibration.
            </motion.p>
            <motion.div variants={fadeIn} custom={3} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link to="/analysis"><Button variant="hero" size="xl">Start Analysis <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
              <Link to="/radar"><Button variant="hero-outline" size="xl"><Radar className="w-4 h-4 mr-1" /> Explore Value Radar</Button></Link>
            </motion.div>

            {/* Animated Stats */}
            <motion.div variants={fadeIn} custom={4} className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { value: 15420, suffix: "", label: "Analyses Run" },
                { value: 67.4, suffix: "%", label: "Avg. Accuracy" },
                { value: 11.8, suffix: "%", label: "Avg. Edge" },
              ].map(s => (
                <Card key={s.label} className="rounded-2xl border-white/8 bg-[linear-gradient(180deg,rgba(34,211,238,0.055),rgba(255,255,255,0.025))] text-center shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
                  <CardContent className="p-4">
                    <p className="text-2xl font-bold text-foreground"><AnimatedCounter target={s.value} suffix={s.suffix} /></p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          </motion.div>

          {/* Hero Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="relative mt-4 lg:mt-[3.5rem] lg:max-w-[520px] lg:justify-self-end"
          >
            <div className="relative">
              <div className="absolute -inset-[1px] rounded-[30px] bg-[linear-gradient(135deg,rgba(34,211,238,0.35),rgba(34,197,94,0.2),rgba(34,211,238,0.1))] opacity-80 blur-[2px]" />
              <div className="absolute inset-0 rounded-[30px] bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.18),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.14),transparent_34%)]" />
              <div className="absolute left-5 top-5 h-8 w-8 rounded-tl-[18px] border-l border-t border-cyan-300/25" />
              <div className="absolute bottom-5 right-5 h-8 w-8 rounded-br-[18px] border-b border-r border-emerald-300/25" />
              <div className="rounded-[28px] border border-primary/15 bg-[linear-gradient(180deg,rgba(8,18,30,0.94),rgba(9,16,27,0.96))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.36)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Dashboard</p>
                  <h3 className="mt-1.5 text-lg font-semibold text-foreground">Live value overview</h3>
                </div>
                <div className="rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary ring-1 ring-primary/20">
                  Live
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { label: "Confidence", value: "8.6", sub: "High" },
                  { label: "Edge", value: "+11.8%", sub: "Premium" },
                  { label: "Risk", value: "Low", sub: "Controlled" },
                  { label: "Stake", value: "2.4%", sub: "Kelly" },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.06 }}
                    className="rounded-xl bg-white/[0.03] ring-1 ring-white/5 p-3"
                  >
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-bold font-mono-data text-foreground">{item.value}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.sub}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Trend</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary">7D</p>
                  </div>
                  <div className="mt-4 flex h-16 items-end gap-1.5">
                    {[34, 56, 48, 72, 68, 84, 79, 92].map((height, i) => (
                      <motion.div
                        key={`${height}-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: `${height}%`, opacity: 1 }}
                        transition={{ delay: 1 + i * 0.05, duration: 0.4 }}
                        className={`flex-1 rounded-t-xl ${i > 5 ? "bg-[linear-gradient(180deg,#34d399,#22d3ee)]" : "bg-white/15"}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl bg-white/[0.03] ring-1 ring-white/5 p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Top Signal</p>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Today</p>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { match: "Arsenal vs Chelsea", market: "Over 2.5", tone: "bg-primary/10 text-primary" },
                      { match: "Liverpool vs Man City", market: "BTTS Yes", tone: "bg-emerald-500/10 text-emerald-300" },
                    ].map((row) => (
                      <div key={row.match} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium leading-tight text-foreground">{row.match}</p>
                          <p className="text-[11px] text-muted-foreground">{row.market}</p>
                        </div>
                        <div className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${row.tone}`}>
                          Signal
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Radar Preview */}
      <section className="relative border-t border-white/5 px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Radar className="w-3 h-3" /> Live Scanner
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Today&apos;s{" "}
              <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
                Value Radar
              </span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Real-time market scanning finds the best opportunities for you.</p>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            {[
              { label: "Visible opportunities", value: "6 live picks", hint: "Ranked by edge and confidence" },
              { label: "Best confidence", value: "9 / 10", hint: "Strongest card on the board" },
              { label: "Top value gap", value: "+11.8%", hint: "Model versus market difference" },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-2 mb-4 justify-end">
            <span className="text-xs text-muted-foreground mr-1">Sort:</span>
            <button
              onClick={() => {/* static preview, no-op */}}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary ring-1 ring-primary/20"
            >
              Edge %
            </button>
            <button
              onClick={() => {/* static preview, no-op */}}
              className="px-3 py-1 rounded-lg text-xs font-medium bg-white/5 text-muted-foreground ring-1 ring-white/10 hover:bg-white/10 transition-colors"
            >
              Confidence
            </button>
          </div>

          {/* Scanner table */}
          <div className="overflow-hidden rounded-[32px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] shadow-[0_28px_80px_-26px_rgba(34,211,238,0.20)] backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Opportunity board</p>
                <p className="mt-1 text-sm font-medium text-foreground">Live-ranked market edges for today</p>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
                Updated live
              </div>
            </div>
            {/* Header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 px-5 py-3 border-b border-white/5">
              {["Match", "Market", "Odds", "Model %", "Edge", "Confidence", "Decision"].map(h => (
                <span key={h} className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{h}</span>
              ))}
            </div>

            {/* Rows */}
            {radarPreview.map((item, i) => (
              <motion.div
                key={`${item.home}-${item.away}`}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`
                  grid grid-cols-1 md:grid-cols-[2fr_1fr_0.7fr_0.8fr_0.8fr_0.8fr_0.8fr] gap-2 md:gap-2 items-center px-5 py-4
                  border-b border-white/5 last:border-b-0
                  hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group
                  ${item.best ? "bg-[linear-gradient(90deg,rgba(34,211,238,0.08),rgba(34,197,94,0.06))]" : ""}
                `}
              >
                {/* Match Info */}
                <div>
                  {item.best && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[linear-gradient(90deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] text-primary ring-1 ring-primary/30 mb-1.5 shadow-[0_0_16px_rgba(34,211,238,0.12)]">
                      🔥 Best Value Today
                    </span>
                  )}
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.home} vs {item.away}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{item.league}</span>
                    {item.tag && (
                      <span className="text-[10px] text-primary/70 italic">· {item.tag}</span>
                    )}
                  </div>
                </div>

                {/* Market */}
                <span className="text-xs text-muted-foreground md:text-sm">{item.market}</span>

                {/* Odds */}
                <span className="font-mono-data text-sm font-medium text-foreground">{item.odds.toFixed(2)}</span>

                {/* Model % */}
                <span className="font-mono-data text-sm text-foreground">{item.modelProb.toFixed(1)}%</span>

                {/* Edge */}
                <span className={`font-mono-data text-sm font-bold ${item.edge > 0 ? "text-primary" : "text-destructive"}`}>
                  {item.edge > 0 ? "+" : ""}{item.edge.toFixed(1)}%
                </span>

                {/* Confidence */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden max-w-[60px]">
                    <motion.div
                      className={`h-full rounded-full ${item.conf >= 7 ? "bg-primary" : item.conf >= 4 ? "bg-warning" : "bg-destructive"}`}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${item.conf * 10}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.06 }}
                    />
                  </div>
                  <span className="font-mono-data text-xs text-muted-foreground">{item.conf}</span>
                </div>

                {/* Decision */}
                <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider w-fit
                  ${item.decision === "Bet" ? "bg-primary/10 text-primary ring-1 ring-primary/20" : ""}
                  ${item.decision === "Caution" ? "bg-warning/10 text-warning ring-1 ring-warning/20" : ""}
                  ${item.decision === "No Bet" ? "bg-destructive/10 text-destructive ring-1 ring-destructive/20" : ""}
                `}>
                  {item.decision}
                </span>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to="/radar">
              <Button variant="hero-outline" size="lg">
                View All Opportunities <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative border-t border-white/5 px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Target className="h-3.5 w-3.5" />
              Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Quantify the{" "}
              <span className="bg-[linear-gradient(90deg,#ffffff_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
                Pitch
              </span>
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Every tool you need to make data-driven betting decisions, in one platform.</p>
          </div>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {[
              { label: "Analysis stack", value: "Match + Market + Risk", hint: "One workflow from setup to decision" },
              { label: "Decision layer", value: "Confidence-first", hint: "Signals stay structured and comparable" },
              { label: "Tracking loop", value: "Performance-aware", hint: "Built to learn from real results" },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeIn}
                custom={i}
                whileHover={{ y: -6, scale: 1.02 }}
                className="group cursor-default rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-6 shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_-24px_rgba(34,211,238,0.24)] backdrop-blur-xl"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.30)] transition-colors group-hover:bg-primary/20">
                  <f.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="mb-3 h-px w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.25),rgba(34,197,94,0.0))]" />
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How ScoreLab Thinks */}
      <section className="relative border-t border-white/5 px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Brain className="h-3.5 w-3.5" />
              Intelligence
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              How{" "}
              <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
                ScoreLab
              </span>{" "}
              Thinks
            </h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Three layers of analysis power every recommendation.</p>
          </div>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {[
              { label: "Probability layer", value: "Poisson foundation", hint: "Turns scoring rates into structured match probabilities." },
              { label: "Simulation layer", value: "Scenario-tested", hint: "Adds robustness by exploring many possible match paths." },
              { label: "Decision layer", value: "Edge-aware output", hint: "Translates model strength into a usable betting signal." },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {thinkingSteps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-8 text-center relative overflow-hidden group backdrop-blur-xl hover:-translate-y-1 transition-all duration-300 shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)] hover:shadow-[0_28px_80px_-24px_rgba(34,211,238,0.24)]"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(142,71%,45%,0.03)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/15 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.30)]">
                    <step.icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="text-4xl font-bold text-white/[0.04] mb-2">{String(i + 1).padStart(2, "0")}</div>
                  <div className="mx-auto mb-3 h-px w-20 bg-[linear-gradient(90deg,rgba(34,211,238,0.25),rgba(34,197,94,0.0))]" />
                  <h3 className="text-lg font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why ScoreLab is Different */}
      <section className="relative border-t border-white/5 px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-5xl mx-auto">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Crosshair className="h-3.5 w-3.5" />
              Philosophy
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Why ScoreLab is Different</h2>
            <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
              Built for disciplined users who want structure, not hype, and a workflow that stays useful over time.
            </p>
          </div>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {[
              { label: "Mindset", value: "Probability over noise", hint: "The product is designed to support judgment, not impulse." },
              { label: "Method", value: "Market-aware analysis", hint: "Every recommendation lives in context against price and risk." },
              { label: "Outcome", value: "Long-term discipline", hint: "Tracking and bankroll logic stay part of the same loop." },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="space-y-4">
                {whyDifferent.map((point, i) => (
                  <motion.div
                    key={point}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 rounded-2xl border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.78)_0%,rgba(8,19,33,0.92)_100%)] px-4 py-3 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.14)]"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] flex items-center justify-center flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.24)]">
                      <Crosshair className="w-4 h-4 text-primary" strokeWidth={1.5} />
                    </div>
                    <p className="text-foreground font-medium">{point}</p>
                  </motion.div>
                ))}
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-8 backdrop-blur-xl shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)]"
            >
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Traditional Approach</p>
                  <div className="h-3 rounded-full bg-destructive/20 overflow-hidden">
                    <div className="h-full w-[35%] rounded-full bg-destructive/50" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">~35% long-term accuracy</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ScoreLab Intelligence</p>
                  <div className="h-3 rounded-full bg-primary/20 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full gradient-primary"
                      initial={{ width: 0 }}
                      whileInView={{ width: "67%" }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.3 }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">~67% model accuracy</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="relative border-t border-white/5 px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <ChevronRight className="h-3.5 w-3.5" />
              Process
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">How ScoreLab Works</h2>
            <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
              A clean flow from match setup to value detection and stake discipline, designed to stay easy to trust.
            </p>
          </div>
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            {[
              { label: "Input", value: "Match context first", hint: "Start with team stats, odds and the right competition context." },
              { label: "Engine", value: "Model then market", hint: "Let the system compare your probabilistic view to live prices." },
              { label: "Outcome", value: "Decision with discipline", hint: "Finish with sizing and a trackable recommendation." },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeIn}
                custom={i}
                whileHover={{ y: -4, scale: 1.01 }}
                className="relative rounded-[28px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] p-5 transition-all duration-300 backdrop-blur-xl shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)] hover:-translate-y-1 hover:shadow-[0_28px_80px_-24px_rgba(34,211,238,0.24)]"
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(34,197,94,0.16))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-14px_rgba(34,211,238,0.30)]">
                  <span className="text-sm font-bold font-mono-data text-primary">{step.num}</span>
                </div>
                <div className="mb-3 h-px w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.25),rgba(34,197,94,0.0))]" />
                <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden md:block absolute top-8 -right-3 w-5 h-5 text-white/10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative border-t border-white/5 px-6 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_32%,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.09),transparent_22%),radial-gradient(circle_at_48%_78%,rgba(34,211,238,0.07),transparent_28%),linear-gradient(180deg,rgba(7,17,31,0.90)_0%,rgba(8,22,38,0.94)_45%,rgba(6,16,28,0.96)_100%)]" />
        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full ring-1 ring-primary/20 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] px-4 py-1.5 text-xs text-primary mb-4 shadow-[0_0_24px_rgba(34,211,238,0.10)]">
              <Star className="h-3.5 w-3.5" />
              Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-muted-foreground">Start free. Upgrade when you need more power.</p>
          </div>
          <div className="mb-8 grid gap-4 md:grid-cols-3 max-w-5xl mx-auto">
            {[
              { label: "Entry point", value: "Start with the board", hint: "Use the free plan to understand the workflow and interface." },
              { label: "Growth path", value: "Unlock more depth", hint: "Move into advanced analysis and daily value scanning when needed." },
              { label: "Power tier", value: "Operate at full scope", hint: "Get the complete toolkit for tracking, collaboration and scale." },
            ].map((item) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.84)_0%,rgba(8,21,35,0.92)_100%)] px-5 py-4 shadow-[0_18px_48px_-20px_rgba(34,211,238,0.20)] backdrop-blur-xl"
              >
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </motion.div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`rounded-[28px] p-6 transition-all duration-300 backdrop-blur-xl ${
                  plan.highlighted
                    ? "relative border border-primary/30 bg-[linear-gradient(180deg,rgba(10,25,41,0.96)_0%,rgba(8,19,33,0.99)_100%)] card-glow hover:-translate-y-1 shadow-[0_26px_70px_rgba(34,211,238,0.10)]"
                    : "border border-cyan-200/10 bg-[linear-gradient(180deg,rgba(10,25,41,0.92)_0%,rgba(8,19,33,0.97)_100%)] hover:-translate-y-1 shadow-[0_24px_72px_-24px_rgba(34,211,238,0.16)]"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <div className="mb-4 h-px w-full bg-[linear-gradient(90deg,rgba(34,211,238,0.25),rgba(34,197,94,0.0))]" />
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground font-mono-data">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{plan.desc}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.5} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup">
                  <Button variant={plan.highlighted ? "hero" : "outline"} className="w-full mt-6">
                    {plan.cta}
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative border-t border-white/5 px-4 py-20 sm:px-6 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_24%,rgba(34,211,238,0.08),transparent_24%),linear-gradient(180deg,rgba(7,17,31,0.74),rgba(5,12,21,0.94))]" />
        <div className="max-w-7xl mx-auto">
          <div className="relative text-center mb-16">
            <Badge variant="outline" className="mb-3 border-primary/18 text-primary">Testimonials</Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Trusted by Analysts</h2>
          </div>
          <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -2 }}
                className="rounded-[28px] border border-cyan-100/10 bg-[linear-gradient(180deg,rgba(13,30,47,0.82),rgba(8,19,33,0.94))] p-6 shadow-[0_24px_72px_-28px_rgba(34,211,238,0.18)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">"{t.quote}"</p>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative border-t border-white/5 px-4 py-20 sm:px-6 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,var(--scorelab-accent-a-soft),transparent_28%),radial-gradient(circle_at_50%_80%,var(--scorelab-accent-b-soft),transparent_34%),linear-gradient(180deg,rgba(7,17,31,0.84),rgba(5,12,21,0.98))]" />
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[36px] border border-cyan-100/10 bg-[linear-gradient(135deg,rgba(13,30,47,0.92),rgba(8,19,33,0.98))] px-6 py-12 text-center shadow-[0_34px_96px_-40px_rgba(34,211,238,0.32)] backdrop-blur-xl md:px-12 md:py-16">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent,rgba(255,255,255,0.055),transparent)] opacity-70" />
          <Badge variant="outline" className="relative mb-5 border-primary/18 text-primary">Ready for kickoff</Badge>
          <h2 className="relative text-3xl font-black tracking-[-0.045em] text-foreground md:text-5xl">
            Ready to Find Your{" "}
            <span className="bg-[linear-gradient(90deg,hsl(var(--primary))_0%,hsl(var(--primary-glow))_55%,#8be9ff_100%)] bg-clip-text text-transparent">
              Edge?
            </span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-2xl text-muted-foreground">Probabilistic match analysis, value detection and bankroll discipline — built on data, not gut feeling.</p>
          <div className="relative mt-8 flex justify-center gap-4">
            <Link to="/signup"><Button variant="hero" size="xl">Start Free Today <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1.2fr_0.8fr_0.8fr] md:items-start">
          <div>
            <div className="flex items-center gap-2">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-primary/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,197,94,0.18))] shadow-[0_8px_22px_rgba(34,211,238,0.14)]">
              <div className="absolute inset-[1px] rounded-[7px] bg-[linear-gradient(180deg,rgba(7,17,31,0.92),rgba(12,27,40,0.82))]" />
              <BarChart3 className="relative w-3 h-3 text-cyan-100" strokeWidth={1.6} />
            </div>
            <span className="text-sm font-semibold bg-[linear-gradient(90deg,#ffffff_0%,#9fe8ff_40%,#8ef0c2_100%)] bg-clip-text text-transparent">ScoreLab</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Where football statistics, market discipline and bankroll strategy become one operating system.</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Product</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <a href="#features" className="transition-colors hover:text-foreground">Features</a>
              <a href="#how-it-works" className="transition-colors hover:text-foreground">Workflow</a>
              <a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a>
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Launch</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
              <Link to="/analysis" className="transition-colors hover:text-foreground">Start Analysis</Link>
              <Link to="/dashboard" className="transition-colors hover:text-foreground">Open Dashboard</Link>
              <Link to="/signup" className="transition-colors hover:text-foreground">Create Account</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-7xl flex-col gap-2 border-t border-white/8 pt-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 ScoreLab. All rights reserved.</p>
          <p>Built for disciplined analysis. Not financial advice.</p>
        </div>
      </footer>
    </div>
  );
}
