import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  HudCornerFrame,
  HudSignalLine,
  HudStatusPill,
  type HudTone,
} from "@/components/HudLayer";
import { PitchMarkings } from "@/components/ArenaEffects";

type MatchdayHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: string;
  tone?: HudTone;
  statusIcon?: ReactNode;
  statusItems?: ReactNode;
  visual?: ReactNode;
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function MatchdayHero({
  eyebrow,
  title,
  description,
  tone = "cyan",
  statusIcon,
  statusItems,
  visual,
}: MatchdayHeroProps) {
  return (
    <motion.div
      variants={fadeUp}
      className="scorelab-stage-3d scorelab-board-3d scorelab-premium-hero scorelab-premium-edge relative overflow-hidden rounded-[32px] border border-white/8 p-5 md:p-6"
    >
      <HudCornerFrame />
      <HudSignalLine tone={tone} className="absolute inset-x-6 top-0" />
      <PitchMarkings intensity="soft" className="top-auto h-[46%] opacity-20" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.09),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.065),transparent_34%)]" />
      <div className="scorelab-depth-grid pointer-events-none absolute inset-x-10 bottom-0 h-32 opacity-24" />
      <div className="pointer-events-none absolute -left-20 top-0 h-full w-52 rotate-[15deg] bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.055),transparent)] blur-xl" />
      <div className="pointer-events-none absolute -right-20 top-0 h-full w-52 rotate-[-15deg] bg-[linear-gradient(90deg,transparent,rgba(52,211,153,0.05),transparent)] blur-xl" />

      <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_380px] xl:items-stretch">
        <div className="flex min-h-0 flex-col justify-center md:min-h-[220px]">
          <HudStatusPill label={eyebrow} tone={tone} icon={statusIcon} />
          <h1 className="mt-4 max-w-4xl text-[2.1rem] font-black tracking-[-0.055em] text-white drop-shadow-[0_0_28px_rgba(125,245,238,0.12)] md:text-[3rem] xl:text-[3.35rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/64 md:text-base">
            {description}
          </p>
          {statusItems ? (
            <div className="mt-5 hidden flex-wrap gap-2 sm:flex">{statusItems}</div>
          ) : null}
        </div>
        {visual ? <div className="hidden md:contents">{visual}</div> : null}
      </div>
    </motion.div>
  );
}
