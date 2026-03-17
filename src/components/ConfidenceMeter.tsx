import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ConfidenceMeterProps {
  score: number; // 0-10
  className?: string;
  showLabel?: boolean;
  animated?: boolean;
}

export function ConfidenceMeter({ score, className, showLabel = true, animated = true }: ConfidenceMeterProps) {
  const percentage = (score / 10) * 100;
  const getColor = () => {
    if (score >= 7) return "bg-primary";
    if (score >= 4) return "bg-warning";
    return "bg-destructive";
  };
  const getGlow = () => {
    if (score >= 7) return "shadow-[0_0_8px_hsla(142,71%,45%,0.4)]";
    if (score >= 4) return "shadow-[0_0_8px_hsla(38,92%,50%,0.3)]";
    return "shadow-[0_0_8px_hsla(0,84%,60%,0.3)]";
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          initial={animated ? { width: 0 } : false}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
          className={cn("h-full rounded-full", getColor(), getGlow())}
        />
      </div>
      {showLabel && (
        <span className={cn(
          "font-mono-data text-sm font-bold min-w-[2ch]",
          score >= 7 && "text-primary",
          score >= 4 && score < 7 && "text-warning",
          score < 4 && "text-destructive"
        )}>
          {score}
        </span>
      )}
    </div>
  );
}
