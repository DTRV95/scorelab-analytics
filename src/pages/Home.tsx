import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, CalendarClock, Percent } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BankrollTrend } from "@/components/BankrollTrend";
import { HomeChallenges } from "@/components/HomeChallenges";
import { HomeRivals } from "@/components/HomeRivals";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import { buildPlayerStyle, MIN_DECIDED } from "@/lib/bettingStyle";
import { canonicalMarket } from "@/lib/marketNames";
import { newsByPlan, planNews } from "@/lib/planNews";
import { rivalries } from "@/lib/rivals";
import { seenByPlan } from "@/lib/seenStore";
import { type PlanBet } from "@/lib/planStore";
import {
  readCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

function kickoff(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** The next few games the model has an opinion about. */
function NextGames({ board }: { board: BoardMatch[] }) {
  const soon = useMemo(
    () =>
      [...board]
        .filter((match) => match.kickoff)
        .sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? ""))
        .slice(0, 4),
    [board],
  );

  if (soon.length === 0) return null;

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          A seguir
        </h2>
        <Link
          to="/probability"
          className="sl-meta flex items-center gap-1 text-[11px]"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {soon.map((match) => (
          <div
            key={match.fixture_id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {match.home_name} vs {match.away_name}
              </p>
              <p className="sl-meta truncate text-[11px]">
                {match.league} · {kickoff(match.kickoff)}
              </p>
            </div>
            <div className="flex-none text-right">
              <p className="sl-figure text-[13px] text-foreground">
                {match.headline_pct.toFixed(0)}%
              </p>
              <p className="sl-meta text-[10px]">
                {MARKET_LABELS[match.headline_market] ?? match.headline_market}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** What this person's own settled bets say, in two lines. */
function YourRecord({ userId, bets }: { userId: string; bets: PlanBet[] }) {
  // The id is passed through rather than every bet being relabelled as mine.
  // Relabelling worked only because the caller had already filtered, and left
  // the brother's bets one careless change away from counting as this record.
  const style = useMemo(
    () => buildPlayerStyle(userId, "", bets),
    [userId, bets],
  );

  if (!style.sharpest && !style.weakest) return null;

  const rows = [
    style.sharpest && {
      tone: "good" as const,
      label: "Acertas mais em",
      market: style.sharpest.market,
      value: `${style.sharpest.hitPct?.toFixed(0)}%`,
      detail: `${style.sharpest.landed} de ${
        style.sharpest.landed + style.sharpest.failed
      }`,
    },
    style.weakest &&
      style.weakest.market !== style.sharpest?.market && {
        tone: "bad" as const,
        label: "Falhas mais em",
        market: style.weakest.market,
        value: `${style.weakest.hitPct?.toFixed(0)}%`,
        detail: `${style.weakest.landed} de ${
          style.weakest.landed + style.weakest.failed
        }`,
      },
  ].filter(Boolean) as {
    tone: "good" | "bad";
    label: string;
    market: string;
    value: string;
    detail: string;
  }[];

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Percent className="h-3.5 w-3.5 text-muted-foreground" />O teu registo
        </h2>
        <Link
          to="/desafios/analise"
          className="sl-meta flex items-center gap-1 text-[11px]"
        >
          Ver tudo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="sl-meta text-[10px] uppercase tracking-[0.1em]">
                {row.label}
              </p>
              <p className="truncate text-[12px] font-semibold text-foreground">
                {MARKET_LABELS[row.market] ?? canonicalMarket(row.market)}
              </p>
            </div>
            <div className="flex-none text-right">
              <p
                className={`sl-figure text-[14px] ${
                  row.tone === "good"
                    ? "text-[hsl(var(--sl-green))]"
                    : "text-destructive"
                }`}
              >
                {row.value}
              </p>
              <p className="sl-meta text-[10px]">{row.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="sl-meta border-t border-border px-4 py-2 text-[11px]">
        Só mercados com pelo menos {MIN_DECIDED} jogos decididos.
      </p>
    </section>
  );
}

/**
 * The page the app opens on.
 *
 * Built on what this app is actually used for: the challenges, the day's bet,
 * the games coming, and the record built out of the bets themselves. Every
 * block is a door to the page that holds the rest of it, so the home page is
 * a way in rather than a dead end.
 */
export default function Home() {
  const { user } = useAuth();
  // Read once for the whole app, so the figure here and the one in the bar at
  // the top of every page are the same figure rather than two answers to the
  // same question.
  const { board, bets, started, plans, members, allBets, funds } =
    usePlanBoard();
  const [games, setGames] = useState<BoardMatch[]>([]);

  // Read once per visit to this page. Leaving a challenge unmounts the home
  // page and coming back mounts it again, so a challenge opened a moment ago
  // has already stopped being news by the time this is read next.
  const since = useMemo(() => seenByPlan(user?.id ?? ""), [user?.id]);

  const news = useMemo(
    () =>
      planNews({
        userId: user?.id ?? "",
        members,
        bets: allBets,
        funds,
        since,
      }),
    [user?.id, members, allBets, funds, since],
  );

  const rivals = useMemo(
    () => rivalries(user?.id ?? "", plans, members, allBets, funds),
    [user?.id, plans, members, allBets, funds],
  );

  const newsCounts = useMemo(() => newsByPlan(news), [news]);

  // The games the challenge page already fetched. Reading the stored copy
  // rather than asking again keeps the home page off the provider's ten
  // requests a minute, which the board is already close to spending.
  useEffect(() => {
    const cached = readCachedBoard(7);
    if (cached) setGames(cached.matches);
  }, []);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3 px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 md:pb-6"
      >
        {/*
         * The title sat 45px under the header bar and 6px above its own line,
         * which read as a caption for the bar rather than as the name of the
         * page. Three paddings stacked above it — the layout's, this page's,
         * and the 8px phones put on every h1 — and nothing below. The page's
         * own top padding is gone and the block is pulled up by the rest, so
         * the title sits between the bar and the line under it.
         *
         * The offset is written out rather than as -mt-4: a phone-width rule
         * matches any class containing "mt-4" and would turn this into a
         * positive margin.
         */}
        <motion.div variants={fadeUp} className="-mt-3 md:-mt-[1rem]">
          <h1 className="sl-section-title text-[15px]">Início</h1>
          <p className="sl-meta mt-1 text-[11px]">
            O que está a decorrer, e o que falta fazer hoje.
          </p>
        </motion.div>

        {rivals.length > 0 && (
          <motion.div variants={fadeUp}>
            <HomeRivals rivalries={rivals} news={news} />
          </motion.div>
        )}

        {board && (
          <motion.div variants={fadeUp}>
            <HomeChallenges board={board} news={newsCounts} />
          </motion.div>
        )}

        {bets.length > 0 && (
          <motion.div variants={fadeUp}>
            <BankrollTrend startingBankroll={started} bets={bets} />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <NextGames board={games} />
        </motion.div>

        {bets.length > 0 && (
          <motion.div variants={fadeUp}>
            <YourRecord userId={user?.id ?? ""} bets={bets} />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <Link
            to="/dashboard/analises"
            className="sl-card sl-tap flex items-center gap-3 px-4 py-3"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-muted">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="sl-meta min-w-0 flex-1 text-[12px]">
              Análises guardadas, sinais e gráficos
            </span>
            <ArrowRight className="h-4 w-4 flex-none text-muted-foreground" />
          </Link>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
