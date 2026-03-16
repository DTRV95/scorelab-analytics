import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  score: number; // 0-10
  className?: string;
  showLabel?: boolean;
}

export function ConfidenceMeter({ score, className, showLabel = true }: ConfidenceMeterProps) {
  const percentage = (score / 10) * 100;
  const getColor = () => {
    if (score >= 7) return "bg-primary";
    if (score >= 4) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", getColor())}
          style={{ width: `${percentage}%` }}
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
