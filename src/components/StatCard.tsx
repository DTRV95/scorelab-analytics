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
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(10,24,40,0.95)_0%,rgba(6,16,30,0.98)_100%)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.32)] transition-all duration-300 hover:border-cyan-300/14 hover:shadow-[0_22px_60px_rgba(0,0,0,0.44)]",
        glow && "card-glow animate-pulse-glow",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.10),transparent_24%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(153,246,228,0.4),transparent)]" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{label}</p>
          <div className="mt-2 h-1.5 w-12 rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.9),rgba(34,197,94,0.85))] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
        </div>
        {icon && (
          <div className="relative z-10 rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-muted-foreground transition-colors duration-300 group-hover:text-primary">
            {icon}
          </div>
        )}
      </div>
      <p className={cn("relative z-10 mt-5 text-[1.95rem] font-semibold tracking-[-0.03em] text-foreground", mono && "font-mono-data")}>{value}</p>
      {change && (
        <p className={cn(
          "relative z-10 mt-2 text-xs font-medium uppercase tracking-[0.16em]",
          changeType === "positive" && "text-primary",
          changeType === "negative" && "text-destructive",
          changeType === "neutral" && "text-white/45",
          mono && "font-mono-data"
        )}>
          {change}
        </p>
      )}
    </motion.div>
  );
}
