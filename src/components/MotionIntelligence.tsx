import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

export function MotionNumber({
  value,
  formatter,
  className,
}: {
  value: number;
  formatter?: (value: number) => string;
  className?: string;
}) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const motionValue = useMotionValue(safeValue);
  const rounded = useTransform(motionValue, (latest) =>
    formatter ? formatter(latest) : latest.toFixed(0)
  );

  useEffect(() => {
    const controls = animate(motionValue, safeValue, {
      duration: 0.75,
      ease: [0.22, 1, 0.36, 1],
    });

    return controls.stop;
  }, [motionValue, safeValue]);

  return <motion.span className={className}>{rounded}</motion.span>;
}

export function PulseOnChange({
  value,
  children,
  className,
}: {
  value: unknown;
  children: ReactNode;
  className?: string;
}) {
  const previousValue = useRef(value);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (Object.is(previousValue.current, value)) return;
    previousValue.current = value;
    setPulseKey((current) => current + 1);
  }, [value]);

  return (
    <motion.div
      key={pulseKey}
      initial={{ boxShadow: "0 0 0 0 rgba(34,211,238,0)" }}
      animate={{
        boxShadow: [
          "0 0 0 0 rgba(34,211,238,0)",
          "0 0 0 1px rgba(125,245,238,0.16), 0 0 34px -18px rgba(34,211,238,0.72)",
          "0 0 0 0 rgba(34,211,238,0)",
        ],
      }}
      transition={{ duration: 0.9, ease: "easeOut" }}
      className={cn("rounded-[inherit]", className)}
    >
      {children}
    </motion.div>
  );
}

export function MotionReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const transition = useMemo(
    () => ({ duration: 0.48, delay, ease: [0.22, 1, 0.36, 1] as const }),
    [delay]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={transition}
      className={className}
    >
      {children}
    </motion.div>
  );
}
