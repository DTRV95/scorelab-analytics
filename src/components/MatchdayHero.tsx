import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  HudStatusPill,
  type HudTone,
} from "@/components/HudLayer";

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
      className="scorelab-premium-edge relative overflow-hidden rounded-[32px] border border-border p-5 md:p-6"
    >
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-32 opacity-24" />

      <div className="relative z-10 grid gap-5 xl:grid-cols-[1fr_380px] xl:items-stretch">
        <div className="flex min-h-0 flex-col justify-center md:min-h-[220px]">
          <HudStatusPill label={eyebrow} tone={tone} icon={statusIcon} />
          <h1 className="mt-4 max-w-4xl text-[2.1rem] font-black tracking-[-0.055em] text-foreground drop-shadow-[0_0_28px_rgba(125,245,238,0.12)] md:text-[3rem] xl:text-[3.35rem]">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-muted-foreground md:text-base">
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
