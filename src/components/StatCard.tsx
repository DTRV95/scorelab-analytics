import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  className?: string;
  mono?: boolean;
  glow?: boolean;
}

export function StatCard({ label, value, change, changeType = "neutral", icon, className, mono = true, glow = false }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "rounded-2xl bg-card ring-surface p-5 card-shadow transition-all duration-300 hover:card-shadow-hover group",
        glow && "card-glow animate-pulse-glow",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon && (
          <div className="text-muted-foreground group-hover:text-primary transition-colors duration-300">
            {icon}
          </div>
        )}
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
    </motion.div>
  );
}
