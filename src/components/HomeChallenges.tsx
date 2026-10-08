import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Flag,
  Plus,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import type { HomeBoard, HomeChallenge } from "@/lib/homeBoard";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function Row({ entry, news = 0 }: { entry: HomeChallenge; news?: number }) {
  const { plan, standing, move } = entry;
  const ended = Boolean(plan.ended_at);
  const waiting = !ended && standing.openBets > 0;
  const playable = !ended && move.state === "play" && !waiting;

  return (
    <Link
      to={`/desafios/${plan.id}`}
      className="sl-card sl-tap block overflow-hidden"
    >
      <div className="flex items-start gap-3 px-4 py-3.5">
        <span
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${
            waiting
              ? "bg-amber-500/12 text-amber-700"
              : playable
                ? "bg-primary/12 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {ended ? (
            <Flag className="h-4 w-4" />
          ) : waiting ? (
            <Clock className="h-4 w-4" />
          ) : playable ? (
            <Zap className="h-4 w-4" />
          ) : (
            <Trophy className="h-4 w-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 truncate text-[13px] font-semibold text-foreground">
              {plan.name}
            </p>
            {/* What happened here while this person was away. The number is
                beside the dot because a dot alone says "something", and the
                thing worth knowing is whether it is one day or four. */}
            {news > 0 && (
              <span
                className="flex-none rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                aria-label={`${news} ${news === 1 ? "novidade" : "novidades"}`}
              >
                {news}
              </span>
            )}
          </div>
          <p className="sl-meta text-[11px]">
            Nível {standing.day} de {plan.days} · {eur.format(standing.bankroll)}
          </p>
          {/* The instruction, not a status: what to do, and how much. */}
          <p
            className={`mt-1 text-[12px] font-semibold leading-5 ${
              waiting
                ? "text-amber-700"
                : playable
                  ? "text-primary"
                  : "text-muted-foreground"
            }`}
          >
            {ended
              ? "Terminado"
              : waiting
                ? `Fecha o nível ${standing.day} — ${standing.openBets === 1 ? "1 aposta" : `${standing.openBets} apostas`} por decidir`
                : move.action}
          </p>
        </div>

        <ArrowRight className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
      </div>
    </Link>
  );
}

/**
 * The challenges, at the top of the home page.
 *
 * The page opened on saved analyses and charts built from a store nobody in
 * this app has ever written to, while the thing it is used for every single
 * day — the day's bet — was two taps away and unmentioned. What somebody needs
 * on arriving is small: how much money there is, what is waiting to be closed,
 * and what to bet next.
 */
export function HomeChallenges({
  board,
  news = {},
}: {
  board: HomeBoard;
  /** How much each challenge has that this person has not seen. */
  news?: Record<string, number>;
}) {
  if (board.challenges.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="sl-card flex items-center gap-3 px-4 py-4"
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/12">
          <Plus className="h-4 w-4 text-primary" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-foreground">
            Ainda não tens nenhum desafio
          </span>
          <span className="sl-meta block text-[11px]">
            Há onze para escolher, do mais calmo ao mais absurdo.
          </span>
        </span>
        <Link
          to="/desafios"
          className="sl-btn-primary sl-tap flex h-10 flex-none items-center rounded-xl px-4 text-xs font-semibold"
        >
          Ver
        </Link>
      </motion.section>
    );
  }

  const urgent = [...board.toClose, ...board.toPlay];
  const rest = board.challenges.filter((entry) => !urgent.includes(entry));

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* The money is the card above this one, where it is the headline and
          not a line of small print with two labels in it. */}
      {urgent.length > 0 && (
        <div className="space-y-2">
          <p className="sl-meta flex items-center gap-1.5 text-[10px] uppercase tracking-[0.13em]">
            <Target className="h-3 w-3" />
            Agora
          </p>
          {urgent.map((entry) => (
            <Row key={entry.plan.id} entry={entry} news={news[entry.plan.id]} />
          ))}
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-2">
          <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
            Os outros
          </p>
          {rest.map((entry) => (
            <Row key={entry.plan.id} entry={entry} news={news[entry.plan.id]} />
          ))}
        </div>
      )}
    </motion.section>
  );
}
