import { motion } from "framer-motion";

type Tone = "emerald" | "cyan" | "amber" | "red";

const toneMap: Record<
  Tone,
  {
    accent: string;
    soft: string;
    line: string;
    glow: string;
  }
> = {
  emerald: {
    accent: "bg-emerald-300",
    soft: "bg-emerald-400/12",
    line: "border-emerald-300/22",
    glow: "shadow-[0_0_44px_rgba(52,211,153,0.18)]",
  },
  cyan: {
    accent: "bg-cyan-300",
    soft: "bg-cyan-400/12",
    line: "border-cyan-300/22",
    glow: "shadow-[0_0_44px_rgba(34,211,238,0.18)]",
  },
  amber: {
    accent: "bg-amber-300",
    soft: "bg-amber-400/12",
    line: "border-amber-300/22",
    glow: "shadow-[0_0_44px_rgba(251,191,36,0.16)]",
  },
  red: {
    accent: "bg-red-300",
    soft: "bg-red-400/12",
    line: "border-red-300/22",
    glow: "shadow-[0_0_44px_rgba(248,113,113,0.16)]",
  },
};

export function SystemPulse3D({
  label,
  value,
  detail,
  tone = "emerald",
  size = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
  size?: "default" | "compact";
}) {
  const palette = toneMap[tone];
  const isCompact = size === "compact";

  return (
    <div
      className={`scorelab-stage-3d scorelab-board-3d scorelab-premium-edge relative h-full overflow-hidden border border-white/8 bg-[linear-gradient(160deg,rgba(13,28,44,0.82)_0%,rgba(4,11,24,0.96)_100%)] ${
        isCompact ? "min-h-[150px] rounded-xl p-3" : "min-h-[220px] rounded-[28px] p-4"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:32px_32px] opacity-30" />
      <div className={`scorelab-depth-grid pointer-events-none absolute inset-x-8 bottom-0 opacity-45 ${isCompact ? "h-16" : "h-28"}`} />
      <div className={`pointer-events-none absolute inset-x-6 rounded-[50%] bg-black/35 blur-xl ${isCompact ? "bottom-3 h-8" : "bottom-5 h-14"}`} />

      <div className={`relative z-10 flex h-full flex-col justify-between ${isCompact ? "gap-2" : "gap-4"}`}>
        <div>
          <p className="text-[10px] font-semibold uppercase text-white/42">{label}</p>
          <p className={`${isCompact ? "mt-1.5 text-xl" : "mt-2 text-[1.45rem] md:text-[1.7rem]"} font-semibold text-white`}>
            {value}
          </p>
          <p className={`${isCompact ? "mt-1 text-xs leading-5" : "mt-1 text-sm leading-6"} max-w-[18rem] text-white/54`}>{detail}</p>
        </div>

        <div className={`relative mx-auto [perspective:900px] ${isCompact ? "h-20 w-36" : "h-36 w-52"}`}>
          <motion.div
            aria-hidden
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border ${palette.line} ${palette.soft} ${palette.glow} [transform-style:preserve-3d] ${
              isCompact ? "h-16 w-16 rounded-xl" : "h-28 w-28 rounded-[22px]"
            }`}
            animate={{ rotateX: [58, 68, 58], rotateY: [-20, 20, -20], rotateZ: [0, 360] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          >
            <div className={`absolute inset-0 border border-white/12 bg-white/[0.03] [transform:translateZ(26px)] ${isCompact ? "rounded-xl" : "rounded-[22px]"}`} />
            <div className={`absolute inset-y-2 left-0 border ${palette.line} bg-black/18 [transform:rotateY(90deg)_translateZ(-14px)] ${isCompact ? "w-4 rounded-l-lg" : "w-7 rounded-l-[18px]"}`} />
            <div className={`absolute inset-y-2 right-0 border ${palette.line} bg-black/18 [transform:rotateY(90deg)_translateZ(14px)] ${isCompact ? "w-4 rounded-r-lg" : "w-7 rounded-r-[18px]"}`} />
            <div className={`absolute inset-x-2 top-0 border ${palette.line} bg-white/[0.035] [transform:rotateX(90deg)_translateZ(14px)] ${isCompact ? "h-4 rounded-t-lg" : "h-7 rounded-t-[18px]"}`} />
            <div className={`absolute border border-white/12 bg-white/[0.025] ${isCompact ? "inset-2 rounded-lg" : "inset-3 rounded-[18px]"}`} />
            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.55)] ${isCompact ? "h-2 w-2" : "h-3 w-3"}`} />
          </motion.div>

          <motion.div
            aria-hidden
            className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${palette.line} [transform:rotateX(68deg)] ${
              isCompact ? "h-20 w-20" : "h-36 w-36"
            }`}
            animate={{ rotateZ: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          />

          {[0, 1, 2, 3].map((item) => (
            <motion.span
              key={item}
              aria-hidden
              className={`absolute h-2 w-2 rounded-full ${palette.accent}`}
              style={{
                left: `${18 + item * 20}%`,
                top: `${28 + (item % 2) * 32}%`,
              }}
              animate={{ opacity: [0.28, 1, 0.28], scale: [0.85, 1.25, 0.85] }}
              transition={{
                duration: 2.4,
                delay: item * 0.22,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
