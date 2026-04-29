import type { ReactNode } from "react";
import { Radar, Satellite, ShieldAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type HudTone = "cyan" | "emerald" | "amber" | "red";

const toneClasses: Record<HudTone, string> = {
  cyan: "border-cyan-200/18 bg-cyan-200/[0.055] text-cyan-100",
  emerald: "border-emerald-300/18 bg-emerald-300/[0.055] text-emerald-100",
  amber: "border-amber-300/18 bg-amber-300/[0.055] text-amber-100",
  red: "border-red-300/18 bg-red-300/[0.055] text-red-100",
};

const dotClasses: Record<HudTone, string> = {
  cyan: "bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,0.72)]",
  emerald: "bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,0.72)]",
  amber: "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.72)]",
  red: "bg-red-300 shadow-[0_0_14px_rgba(252,165,165,0.72)]",
};

export function HudStatusPill({
  label,
  tone = "cyan",
  icon,
  pulse = true,
  className,
}: {
  label: string;
  tone?: HudTone;
  icon?: ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] backdrop-blur-xl",
        toneClasses[tone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone], pulse && "animate-pulse")} />
      {icon}
      <span>{label}</span>
    </div>
  );
}

export function HudSignalLine({
  tone = "cyan",
  className,
}: {
  tone?: HudTone;
  className?: string;
}) {
  const color =
    tone === "emerald"
      ? "from-transparent via-emerald-300/45 to-transparent"
      : tone === "amber"
      ? "from-transparent via-amber-300/45 to-transparent"
      : tone === "red"
      ? "from-transparent via-red-300/45 to-transparent"
      : "from-transparent via-cyan-300/45 to-transparent";

  return (
    <div className={cn("relative h-px overflow-hidden bg-white/[0.055]", className)}>
      <div className={cn("scorelab-hud-scan absolute inset-y-0 w-1/2 bg-gradient-to-r", color)} />
    </div>
  );
}

export function HudMetricOrb({
  label,
  value,
  tone = "cyan",
  icon,
}: {
  label: string;
  value: ReactNode;
  tone?: HudTone;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border px-3 py-2.5",
        toneClasses[tone]
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-8 h-16 w-16 rounded-full bg-white/[0.055] blur-xl" />
      <div className="relative flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-[0.58]">
        {icon}
        <span>{label}</span>
      </div>
      <p className="relative mt-1 font-mono-data text-sm font-semibold text-white">
        {value}
      </p>
    </div>
  );
}

export function HudStateIcon({ state }: { state: "online" | "scanning" | "execution" | "risk" }) {
  if (state === "online") return <Satellite className="h-3 w-3" strokeWidth={1.7} />;
  if (state === "execution") return <Zap className="h-3 w-3" strokeWidth={1.7} />;
  if (state === "risk") return <ShieldAlert className="h-3 w-3" strokeWidth={1.7} />;
  return <Radar className="h-3 w-3" strokeWidth={1.7} />;
}

export function HudCornerFrame({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none absolute inset-3 rounded-[22px]", className)}>
      <div className="absolute left-0 top-0 h-5 w-5 border-l border-t border-cyan-100/18" />
      <div className="absolute right-0 top-0 h-5 w-5 border-r border-t border-cyan-100/18" />
      <div className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-cyan-100/18" />
      <div className="absolute bottom-0 right-0 h-5 w-5 border-b border-r border-cyan-100/18" />
    </div>
  );
}
