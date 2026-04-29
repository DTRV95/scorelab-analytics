import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function StadiumLightSweep({
  trigger,
  children,
  className,
}: {
  trigger: unknown;
  children: ReactNode;
  className?: string;
}) {
  const previousTrigger = useRef(trigger);
  const [sweepKey, setSweepKey] = useState(0);

  useEffect(() => {
    if (Object.is(previousTrigger.current, trigger)) return;
    previousTrigger.current = trigger;
    setSweepKey((current) => current + 1);
  }, [trigger]);

  return (
    <div className={cn("relative overflow-hidden rounded-[inherit]", className)}>
      <motion.div
        key={sweepKey}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[-35%] z-20 w-1/3 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),rgba(125,245,238,0.12),transparent)] blur-sm"
        initial={{ x: "-140%", opacity: 0 }}
        animate={{ x: "360%", opacity: [0, 1, 0] }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      {children}
    </div>
  );
}

export function PitchMarkings({
  className,
  intensity = "soft",
}: {
  className?: string;
  intensity?: "soft" | "medium";
}) {
  const opacity = intensity === "medium" ? "opacity-55" : "opacity-32";

  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]", opacity, className)}
    >
      <div className="absolute inset-x-8 bottom-8 h-px bg-[linear-gradient(90deg,transparent,rgba(125,245,238,0.28),transparent)]" />
      <div className="absolute bottom-8 left-1/2 h-16 w-32 -translate-x-1/2 rounded-t-full border border-cyan-100/16 border-b-0" />
      <div className="absolute bottom-8 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rounded-full border border-cyan-100/18" />
      <div className="absolute left-8 top-8 h-8 w-8 border-l border-t border-cyan-100/14" />
      <div className="absolute right-8 top-8 h-8 w-8 border-r border-t border-cyan-100/14" />
      <div className="absolute left-8 bottom-8 h-8 w-8 border-b border-l border-cyan-100/14" />
      <div className="absolute right-8 bottom-8 h-8 w-8 border-b border-r border-cyan-100/14" />
      <div className="absolute left-[12%] top-0 h-full w-px bg-[linear-gradient(180deg,transparent,rgba(125,245,238,0.12),transparent)]" />
      <div className="absolute right-[12%] top-0 h-full w-px bg-[linear-gradient(180deg,transparent,rgba(52,211,153,0.10),transparent)]" />
    </div>
  );
}
