import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { BetTier } from "@/types/analysis";

interface ValueBadgeProps {
  value: number;
  className?: string;
}

export function ValueBadge({ value, className }: ValueBadgeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <motion.span
      whileHover={{ scale: 1.05 }}
      className={cn(
        "inline-flex items-center px-2 py-1 rounded-md font-mono-data text-xs font-bold transition-all duration-200",
        isPositive && "bg-primary/10 text-primary ring-1 ring-primary/20",
        !isPositive && !isNeutral && "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
        isNeutral && "bg-muted text-muted-foreground ring-1 ring-white/10",
        className
      )}
    >
      {isPositive ? "+" : ""}
      {value.toFixed(1)}%
    </motion.span>
  );
}

export function DecisionBadge({ decision }: { decision: "Bet" | "No Bet" | "Caution" }) {
  const styles =
    decision === "Bet"
      ? "bg-emerald-500/10 text-emerald-400"
      : decision === "Caution"
      ? "bg-yellow-500/10 text-yellow-400"
      : "bg-red-500/10 text-red-400";

  return (
    <span className={`inline-flex items-center rounded-xl px-3 py-1 text-xs font-semibold ${styles}`}>
      {decision.toUpperCase()}
    </span>
  );
}

interface RiskBadgeProps {
  risk: "Low" | "Medium" | "High";
  className?: string;
}

export function RiskBadge({ risk, className }: RiskBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
        risk === "Low" && "bg-primary/10 text-primary",
        risk === "Medium" && "bg-warning/10 text-warning",
        risk === "High" && "bg-destructive/10 text-destructive",
        className
      )}
    >
      {risk}
    </span>
  );
}

interface TierBadgeProps {
  tier: BetTier;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  const styles =
    tier === "premium"
      ? "bg-warning/15 text-warning ring-1 ring-warning/30"
      : tier === "elite"
      ? "bg-primary/15 text-primary ring-1 ring-primary/30"
      : tier === "bet"
      ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
      : tier === "watchlist"
      ? "bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20"
      : "bg-muted text-muted-foreground ring-1 ring-white/10";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest",
        styles,
        className
      )}
    >
      {tier}
    </span>
  );
}

interface SpecialBadgeProps {
  type: "high-value" | "premium-pick";
  className?: string;
}

export function SpecialBadge({ type, className }: SpecialBadgeProps) {
  return (
    <motion.span
      animate={{ opacity: [0.8, 1, 0.8] }}
      transition={{ duration: 2, repeat: Infinity }}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest",
        type === "high-value" && "bg-primary/15 text-primary ring-1 ring-primary/30",
        type === "premium-pick" && "bg-warning/15 text-warning ring-1 ring-warning/30",
        className
      )}
    >
      {type === "high-value" ? "⚡ Elite Signal" : "★ Premium Signal"}
    </motion.span>
  );
}