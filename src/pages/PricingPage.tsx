import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Get started with basic analysis tools.",
    features: ["5 analyses per day", "Basic Poisson model", "Single match analysis", "Community support"],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    desc: "For serious analysts who need an edge.",
    features: ["Unlimited analyses", "Advanced models", "Daily opportunities", "Export to Excel", "Match history", "Priority support"],
    highlighted: true,
  },
  {
    name: "Premium",
    price: "$79",
    period: "/month",
    desc: "The full intelligence toolkit.",
    features: ["Everything in Pro", "API access", "Custom models", "Bankroll tools", "Team collaboration", "Dedicated support", "Early feature access"],
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2">Upgrade anytime. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl p-6 card-shadow transition-shadow duration-200 hover:card-shadow-hover ${
                plan.highlighted ? "bg-card ring-2 ring-primary/30 relative" : "bg-card ring-surface"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full gradient-primary text-xs font-bold text-primary-foreground">
                  Current Plan
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
              <Button variant={plan.highlighted ? "hero" : "outline"} className="w-full mt-6">
                {plan.highlighted ? "Current Plan" : "Upgrade"}
              </Button>
            </div>
          ))}
        </div>
      </motion.div>
    </AppLayout>
  );
}
