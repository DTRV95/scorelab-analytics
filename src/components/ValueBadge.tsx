import { cn } from "@/lib/utils";

interface ValueBadgeProps {
  value: number;
  className?: string;
}

export function ValueBadge({ value, className }: ValueBadgeProps) {
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-1 rounded-md font-mono-data text-xs font-bold",
      isPositive && "bg-primary/10 text-primary ring-1 ring-primary/20",
      !isPositive && !isNeutral && "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
      isNeutral && "bg-muted text-muted-foreground ring-1 ring-white/10",
      className
    )}>
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

interface DecisionBadgeProps {
  decision: "Bet" | "No Bet" | "Caution";
  className?: string;
}

export function DecisionBadge({ decision, className }: DecisionBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider",
      decision === "Bet" && "bg-primary/10 text-primary ring-1 ring-primary/20",
      decision === "No Bet" && "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
      decision === "Caution" && "bg-warning/10 text-warning ring-1 ring-warning/20",
      className
    )}>
      {decision}
    </span>
  );
}

interface RiskBadgeProps {
  risk: "Low" | "Medium" | "High";
  className?: string;
}

export function RiskBadge({ risk, className }: RiskBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-1 rounded text-xs font-medium",
      risk === "Low" && "bg-primary/10 text-primary",
      risk === "Medium" && "bg-warning/10 text-warning",
      risk === "High" && "bg-destructive/10 text-destructive",
      className
    )}>
      {risk}
    </span>
  );
}
