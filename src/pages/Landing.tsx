import { Button } from "@/components/ui/button";
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

const radarPreview = [
  { match: "Arsenal vs Chelsea", market: "Over 2.5", value: "+11.8%", conf: 9, decision: "Bet" as const },
  { match: "Barcelona vs Real Madrid", market: "Over 3.5", value: "+6.6%", conf: 7, decision: "Bet" as const },
  { match: "Bayern vs Dortmund", market: "Over 2.5", value: "+8.3%", conf: 8, decision: "Bet" as const },
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

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-foreground text-lg tracking-tight">ScoreLab</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How it Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" size="sm">Log In</Button></Link>
            <Link to="/signup"><Button variant="hero" size="sm">Start Free</Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden" onMouseMove={handleMouseMove}>
        {/* Animated gradient background */}
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsla(142,71%,45%,0.08)_0%,_transparent_60%)]" />
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

        <div className="max-w-7xl mx-auto relative">
          <motion.div
            className="max-w-3xl"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            <motion.div variants={fadeIn} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full ring-1 ring-white/10 bg-white/5 text-xs text-muted-foreground mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Football Betting Intelligence Platform
            </motion.div>
            <motion.h1 variants={fadeIn} custom={1} className="text-5xl md:text-7xl font-bold text-foreground leading-[1.05]">
              Football Betting Intelligence,{" "}
              <span className="text-gradient-primary">Reimagined</span>
            </motion.h1>
            <motion.p variants={fadeIn} custom={2} className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Advanced statistical models and simulations to identify real value in the market.
            </motion.p>
            <motion.div variants={fadeIn} custom={3} className="mt-8 flex flex-wrap gap-4">
              <Link to="/analysis"><Button variant="hero" size="xl">Start Analysis <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
              <Link to="/radar"><Button variant="hero-outline" size="xl"><Radar className="w-4 h-4 mr-1" /> Explore Value Radar</Button></Link>
            </motion.div>

            {/* Animated Stats */}
            <motion.div variants={fadeIn} custom={4} className="mt-10 flex items-center gap-8 flex-wrap">
              {[
                { value: 15420, suffix: "", label: "Analyses Run" },
                { value: 67.4, suffix: "%", label: "Avg. Accuracy" },
                { value: 11.8, suffix: "%", label: "Avg. Edge" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-bold text-foreground"><AnimatedCounter target={s.value} suffix={s.suffix} /></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Hero Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="mt-16 rounded-2xl ring-1 ring-white/10 bg-card p-6 card-shadow card-glow relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_hsla(142,71%,45%,0.04)_0%,_transparent_60%)]" />
            <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Model Prob.", value: "67.4%", sub: "Over 2.5" },
                { label: "Market Implied", value: "55.6%", sub: "Odds: 1.80" },
                { label: "Value Edge", value: "+11.8%", color: "text-primary" },
                { label: "Kelly Stake", value: "2.4%", sub: "$120" },
              ].map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.1 }}
                  className="rounded-xl bg-white/[0.03] ring-1 ring-white/5 p-4 hover:bg-white/[0.05] transition-colors"
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className={`mt-1 text-2xl font-bold font-mono-data ${item.color || "text-foreground"}`}>{item.value}</p>
                  {item.sub && <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>}
                </motion.div>
              ))}
            </div>
            <div className="relative h-3 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className="h-full rounded-full gradient-primary"
                initial={{ width: 0 }}
                animate={{ width: "67.4%" }}
                transition={{ delay: 1.2, duration: 1, ease: [0.4, 0, 0.2, 1] }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Model: 67.4%</span>
              <span>Market: 55.6%</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Value Radar Preview */}
      <section className="py-24 px-6 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(142,71%,45%,0.03)_0%,_transparent_50%)]" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full ring-1 ring-primary/20 bg-primary/5 text-xs text-primary mb-4">
              <Radar className="w-3 h-3" /> Live Scanner
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Today's Value Radar</h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Real-time market scanning finds the best opportunities for you.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {radarPreview.map((item, i) => (
              <motion.div
                key={item.match}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4, scale: 1.02 }}
                className={`rounded-2xl bg-card ring-surface p-5 card-shadow transition-all duration-300 ${item.conf >= 8 ? "ring-1 ring-primary/20 card-glow" : ""}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">{item.match}</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary/10 text-primary ring-1 ring-primary/20">
                    {item.decision}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">{item.market}</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono-data text-lg font-bold text-primary">{item.value}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: 0 }}
                        whileInView={{ width: `${item.conf * 10}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                      />
                    </div>
                    <span className="font-mono-data text-xs text-muted-foreground">{item.conf}/10</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="text-center">
            <Link to="/radar">
              <Button variant="hero-outline" size="lg">
                View All Opportunities <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Quantify the Pitch</h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Every tool you need to make data-driven betting decisions, in one platform.</p>
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
                whileHover={{ y: -4, scale: 1.02 }}
                className="rounded-2xl bg-card ring-surface p-6 card-shadow transition-all duration-300 group cursor-default"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How ScoreLab Thinks */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Intelligence</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">How ScoreLab Thinks</h2>
            <p className="mt-4 text-muted-foreground max-w-lg mx-auto">Three layers of analysis power every recommendation.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {thinkingSteps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="rounded-2xl bg-card ring-surface p-8 card-shadow text-center relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(142,71%,45%,0.03)_0%,_transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 group-hover:bg-primary/15 transition-colors">
                    <step.icon className="w-7 h-7 text-primary" strokeWidth={1.5} />
                  </div>
                  <div className="text-4xl font-bold text-white/[0.04] mb-2">{String(i + 1).padStart(2, "0")}</div>
                  <h3 className="text-lg font-semibold text-foreground mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why ScoreLab is Different */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Philosophy</p>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">Why ScoreLab is Different</h2>
              <div className="space-y-4">
                {whyDifferent.map((point, i) => (
                  <motion.div
                    key={point}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
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
              className="rounded-2xl bg-card ring-surface p-8 card-shadow"
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
      <section id="how-it-works" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Process</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">How ScoreLab Works</h2>
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
                whileHover={{ y: -2 }}
                className="relative"
              >
                <div className="text-5xl font-bold text-white/[0.03] mb-2">{step.num}</div>
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
      <section id="pricing" className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Pricing</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Simple, Transparent Pricing</h2>
            <p className="mt-4 text-muted-foreground">Start free. Upgrade when you need more power.</p>
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
                className={`rounded-2xl p-6 card-shadow transition-all duration-300 ${
                  plan.highlighted
                    ? "bg-card ring-2 ring-primary/30 relative card-glow"
                    : "bg-card ring-surface"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                    Most Popular
                  </div>
                )}
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
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Testimonials</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Trusted by Analysts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -2 }}
                className="rounded-2xl bg-card ring-surface p-6 card-shadow transition-all duration-300"
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
      <section className="py-24 px-6 border-t border-white/5 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsla(142,71%,45%,0.04)_0%,_transparent_50%)]" />
        <div className="max-w-3xl mx-auto text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">Ready to Find Your Edge?</h2>
          <p className="mt-4 text-muted-foreground">Join thousands of analysts who trust ScoreLab for smarter betting decisions.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Link to="/signup"><Button variant="hero" size="xl">Start Free Today <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center">
              <BarChart3 className="w-3 h-3 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold text-foreground">ScoreLab</span>
            <span className="text-xs text-muted-foreground ml-2">Where statistics meet betting strategy.</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2026 ScoreLab. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
