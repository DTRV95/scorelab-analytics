import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  className?: string;
  mono?: boolean;
}

export function StatCard({ label, value, change, changeType = "neutral", icon, className, mono = true }: StatCardProps) {
  return (
    <div className={cn("rounded-xl bg-card ring-surface p-5 card-shadow transition-shadow duration-200 hover:card-shadow-hover", className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <p className={cn("mt-2 text-2xl font-bold text-foreground", mono && "font-mono-data")}>{value}</p>
      {change && (
        <p className={cn(
          "mt-1 text-xs font-medium font-mono-data",
          changeType === "positive" && "text-primary",
          changeType === "negative" && "text-destructive",
          changeType === "neutral" && "text-muted-foreground"
        )}>
          {change}
        </p>
      )}
    </div>
  );
}
