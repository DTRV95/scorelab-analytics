import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
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
} from "lucide-react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.4, 0, 0.2, 1] as const },
  }),
};
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

export default function Landing() {
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
      <section className="relative pt-32 pb-24 px-6 overflow-hidden gradient-hero">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsla(142,71%,45%,0.08)_0%,_transparent_60%)]" />
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
              Use statistical models, market pricing, and bankroll logic to identify value bets with clarity.
            </motion.p>
            <motion.div variants={fadeIn} custom={3} className="mt-8 flex flex-wrap gap-4">
              <Link to="/signup"><Button variant="hero" size="xl">Start Free <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
              <Link to="/dashboard"><Button variant="hero-outline" size="xl">View Demo</Button></Link>
            </motion.div>
            <motion.div variants={fadeIn} custom={4} className="mt-8 flex items-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" strokeWidth={1.5} /> No credit card required</span>
              <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-primary" strokeWidth={1.5} /> 5 free analyses daily</span>
            </motion.div>
          </motion.div>

          {/* Hero Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
            className="mt-16 rounded-xl ring-1 ring-white/10 bg-card p-6 card-shadow"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Model Prob.", value: "67.4%", sub: "Over 2.5" },
                { label: "Market Implied", value: "55.6%", sub: "Odds: 1.80" },
                { label: "Value Edge", value: "+11.8%", color: "text-primary" },
                { label: "Kelly Stake", value: "2.4%", sub: "$120" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-white/[0.03] ring-1 ring-white/5 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className={`mt-1 text-2xl font-bold font-mono-data ${item.color || "text-foreground"}`}>{item.value}</p>
                  {item.sub && <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>}
                </div>
              ))}
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full gradient-primary" style={{ width: "67.4%" }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>Model: 67.4%</span>
              <span>Market: 55.6%</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
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
                className="rounded-xl bg-card ring-surface p-6 card-shadow hover:card-shadow-hover transition-shadow duration-200 group"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
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

      {/* Analytics Preview */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Preview</p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Intelligence at a Glance</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Sample analysis cards */}
            {[
              { match: "Arsenal vs Chelsea", market: "Over 2.5", edge: "+8.4%", conf: 8, decision: "Bet" },
              { match: "Liverpool vs Man City", market: "BTTS", edge: "+5.2%", conf: 7, decision: "Bet" },
              { match: "Tottenham vs Newcastle", market: "Under 3.5", edge: "-2.1%", conf: 4, decision: "No Bet" },
            ].map((item) => (
              <div key={item.match} className="rounded-xl bg-card ring-surface p-5 card-shadow">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">{item.match}</p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${item.decision === "Bet" ? "bg-primary/10 text-primary ring-1 ring-primary/20" : "bg-destructive/10 text-destructive ring-1 ring-destructive/20"}`}>
                    {item.decision}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{item.market}</p>
                <div className="flex items-center justify-between">
                  <span className={`font-mono-data text-lg font-bold ${parseFloat(item.edge) > 0 ? "text-primary" : "text-destructive"}`}>{item.edge}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${item.conf * 10}%` }} />
                    </div>
                    <span className="font-mono-data text-xs text-muted-foreground">{item.conf}/10</span>
                  </div>
                </div>
              </div>
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
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl p-6 card-shadow transition-shadow duration-200 hover:card-shadow-hover ${
                  plan.highlighted
                    ? "bg-card ring-2 ring-primary/30 relative"
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
                  <Button
                    variant={plan.highlighted ? "hero" : "outline"}
                    className="w-full mt-6"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
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
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-xl bg-card ring-surface p-6 card-shadow">
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-3xl mx-auto text-center">
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
