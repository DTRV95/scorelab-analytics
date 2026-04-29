import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MotionNumber } from "@/components/MotionIntelligence";
import type { HudTone } from "@/components/HudLayer";

const toneStroke: Record<HudTone, string> = {
  cyan: "stroke-cyan-300",
  emerald: "stroke-emerald-300",
  amber: "stroke-amber-300",
  red: "stroke-red-300",
};

const toneText: Record<HudTone, string> = {
  cyan: "text-cyan-100",
  emerald: "text-emerald-100",
  amber: "text-amber-100",
  red: "text-red-100",
};

const toneGlow: Record<HudTone, string> = {
  cyan: "shadow-[0_0_34px_-20px_rgba(34,211,238,0.9)]",
  emerald: "shadow-[0_0_34px_-20px_rgba(52,211,153,0.9)]",
  amber: "shadow-[0_0_34px_-20px_rgba(252,211,77,0.9)]",
  red: "shadow-[0_0_34px_-20px_rgba(252,165,165,0.9)]",
};

function clampPct(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function AnalyticOrb({
  label,
  value,
  detail,
  tone = "cyan",
  size = "md",
}: {
  label: string;
  value: number;
  detail?: ReactNode;
  tone?: HudTone;
  size?: "sm" | "md";
}) {
  const pct = clampPct(value);
  const radius = size === "sm" ? 38 : 46;
  const strokeWidth = size === "sm" ? 7 : 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const box = size === "sm" ? 96 : 116;

  return (
    <div className={cn("relative grid place-items-center rounded-3xl border border-cyan-100/10 bg-cyan-100/[0.03] p-3", toneGlow[tone])}>
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={toneStroke[tone]}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/36">
          {label}
        </p>
        <p className={cn("mt-1 font-mono-data text-lg font-semibold", toneText[tone])}>
          <MotionNumber value={pct} formatter={(latest) => `${latest.toFixed(0)}%`} />
        </p>
      </div>
      {detail ? <div className="mt-2 text-center text-xs leading-5 text-white/48">{detail}</div> : null}
    </div>
  );
}

export function RiskBar({
  label,
  value,
  maxLabel = "Cap",
}: {
  label: string;
  value: number;
  maxLabel?: string;
}) {
  const pct = clampPct(value);
  const tone: HudTone = pct >= 90 ? "red" : pct >= 65 ? "amber" : pct >= 35 ? "cyan" : "emerald";
  const fill =
    tone === "red"
      ? "from-red-300 via-red-400 to-red-300"
      : tone === "amber"
      ? "from-amber-300 via-amber-400 to-emerald-300"
      : tone === "cyan"
      ? "from-cyan-300 via-sky-300 to-emerald-300"
      : "from-emerald-300 via-emerald-400 to-cyan-300";

  return (
    <div className="rounded-2xl border border-cyan-100/10 bg-cyan-100/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/38">
          {label}
        </p>
        <p className={cn("font-mono-data text-xs font-semibold", toneText[tone])}>
          <MotionNumber value={pct} formatter={(latest) => `${latest.toFixed(0)}%`} />
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className={cn("h-full rounded-full bg-gradient-to-r", fill)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-white/32">
        <span>Clean</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

export function MiniHeatmap({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: number; detail?: string }>;
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div className="rounded-3xl border border-cyan-100/10 bg-cyan-100/[0.025] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/42">
        {title}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {sorted.length > 0 ? (
          sorted.map((item) => {
            const intensity = clampPct(Math.abs(item.value));
            const isPositive = item.value >= 0;
            return (
              <div
                key={item.label}
                className={cn(
                  "rounded-2xl border p-3",
                  isPositive
                    ? "border-emerald-300/10 bg-emerald-300/[0.035]"
                    : "border-red-300/10 bg-red-300/[0.035]"
                )}
                style={{
                  opacity: 0.48 + intensity / 190,
                }}
              >
                <p className="truncate text-xs font-medium text-white/78">{item.label}</p>
                <p className={cn("mt-1 font-mono-data text-sm font-semibold", isPositive ? "text-emerald-200" : "text-red-200")}>
                  {item.value.toFixed(1)}%
                </p>
                {item.detail ? <p className="mt-1 truncate text-[10px] text-white/38">{item.detail}</p> : null}
              </div>
            );
          })
        ) : (
          <p className="col-span-full text-sm text-white/45">Not enough data yet.</p>
        )}
      </div>
    </div>
  );
}
