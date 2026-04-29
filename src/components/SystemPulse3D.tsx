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
}: {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
}) {
  const palette = toneMap[tone];

  return (
    <div className="scorelab-stage-3d scorelab-board-3d scorelab-premium-edge relative h-full min-h-[220px] overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(160deg,rgba(13,28,44,0.82)_0%,rgba(4,11,24,0.96)_100%)] p-4">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[length:32px_32px] opacity-30" />
      <div className="scorelab-depth-grid pointer-events-none absolute inset-x-8 bottom-0 h-28 opacity-45" />
      <div className="pointer-events-none absolute inset-x-6 bottom-5 h-14 rounded-[50%] bg-black/35 blur-xl" />

      <div className="relative z-10 flex h-full flex-col justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase text-white/42">{label}</p>
          <p className="mt-2 text-[1.45rem] font-semibold text-white md:text-[1.7rem]">
            {value}
          </p>
          <p className="mt-1 max-w-[18rem] text-sm leading-6 text-white/54">{detail}</p>
        </div>

        <div className="relative mx-auto h-36 w-52 [perspective:900px]">
          <motion.div
            aria-hidden
            className={`absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-[22px] border ${palette.line} ${palette.soft} ${palette.glow} [transform-style:preserve-3d]`}
            animate={{ rotateX: [58, 68, 58], rotateY: [-20, 20, -20], rotateZ: [0, 360] }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute inset-0 rounded-[22px] border border-white/12 bg-white/[0.03] [transform:translateZ(26px)]" />
            <div className={`absolute inset-y-2 left-0 w-7 rounded-l-[18px] border ${palette.line} bg-black/18 [transform:rotateY(90deg)_translateZ(-14px)]`} />
            <div className={`absolute inset-y-2 right-0 w-7 rounded-r-[18px] border ${palette.line} bg-black/18 [transform:rotateY(90deg)_translateZ(14px)]`} />
            <div className={`absolute inset-x-2 top-0 h-7 rounded-t-[18px] border ${palette.line} bg-white/[0.035] [transform:rotateX(90deg)_translateZ(14px)]`} />
            <div className="absolute inset-3 rounded-[18px] border border-white/12 bg-white/[0.025]" />
            <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_24px_rgba(255,255,255,0.55)]" />
          </motion.div>

          <motion.div
            aria-hidden
            className={`absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border ${palette.line} [transform:rotateX(68deg)]`}
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
