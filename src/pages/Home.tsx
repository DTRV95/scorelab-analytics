import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Gauge,
  Globe,
  Percent,
  Trophy,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BankrollHero } from "@/components/BankrollHero";
import { HomeChallenges } from "@/components/HomeChallenges";
import { HomeInsights } from "@/components/HomeInsights";
import { PlanInvites } from "@/components/PlanInvites";
import { HomeRivals } from "@/components/HomeRivals";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import { homeInsights } from "@/lib/homeInsights";
import { canonicalMarket } from "@/lib/marketNames";
import { newsByPlan, planNews } from "@/lib/planNews";
import { rivalries } from "@/lib/rivals";
import { seenByPlan } from "@/lib/seenStore";
import { type PlanBet } from "@/lib/planStore";
import { loadBoard } from "@/lib/boardSource";
import { type BoardMatch } from "@/lib/probabilityBoardCache";

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

/** Where else there is to go, for the pages nothing above leads to. */
const DOORS = [
  {
    to: "/desafios",
    icon: Trophy,
    title: "Desafios",
    detail: "Começar outro",
  },
  // Short on purpose: two to a row on a phone, and a title cut off mid-word
  // is a door with no sign on it.
  { to: "/ligas", icon: Globe, title: "Ligas", detail: "O que dão" },
  {
    to: "/accuracy",
    icon: Gauge,
    title: "Acerto",
    detail: "Do modelo",
  },
  {
    to: "/dashboard/analises",
    icon: BarChart3,
    // "Guardadas" was left over from when this page held saved analyses.
    // What it holds is every bet, by market, by price and by day.
    title: "Análises",
    detail: "Em detalhe",
  },
];

function HomeDoors() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {DOORS.map((door) => (
        <Link
          key={door.to}
          to={door.to}
          className="sl-card sl-card-interactive sl-tap flex items-center gap-2.5 px-3 py-2.5"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-xl bg-muted">
            <door.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-foreground">
              {door.title}
            </span>
            <span className="sl-meta block truncate text-[10.5px]">
              {door.detail}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/**
 * The three games the model is surest about.
 *
 * It used to be the next four by kick-off, which is a clock, not a finding —
 * the whole point of the app is which games it has an opinion about, and the
 * strongest three are that opinion. Still only games yet to be played: a 92%
 * on something that finished last night is a fact, not a tip.
 */
function NextGames({ board }: { board: BoardMatch[] }) {
  const soon = useMemo(() => {
    const now = Date.now();
    return [...board]
      .filter((match) => {
        if (!match.kickoff) return false;
        const at = new Date(match.kickoff).getTime();
        return !Number.isNaN(at) && at > now;
      })
      .sort(
        (a, b) =>
          b.headline_pct - a.headline_pct ||
          (a.kickoff ?? "").localeCompare(b.kickoff ?? ""),
      )
      .slice(0, 3);
  }, [board]);

  if (soon.length === 0) return null;

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          Os mais prováveis
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
          // Into the game itself, with its fifteen markets: the row carried
          // the one number the model is most sure of and no way to ask it
          // anything else.
          <Link
            key={match.fixture_id}
            to={`/match/${match.fixture_id}`}
            className="sl-tap flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[hsl(var(--sl-surface))]"
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
              <p className="sl-figure sl-hero-figure sl-hero-figure-green text-[13px] text-foreground">
                {match.headline_pct.toFixed(0)}%
              </p>
              <p className="sl-meta text-[10px]">
                {MARKET_LABELS[match.headline_market] ?? match.headline_market}
              </p>
            </div>
          </Link>
        ))}
      </div>
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
  const { board, bets, plans, members, allBets, funds, invites, reload } =
    usePlanBoard();
  const [games, setGames] = useState<BoardMatch[]>([]);

  /**
   * Only what is still being played.
   *
   * This page answers "o que está a decorrer, e o que falta fazer hoje", and a
   * challenge given as over has no answer to either. It keeps everything it
   * had — in Desafios, on the shelf of finished ones — and stops being news,
   * a rival, a line on the bankroll and a euro in the total.
   */
  const running = useMemo(
    () => new Set(plans.filter((plan) => !plan.ended_at).map((plan) => plan.id)),
    [plans],
  );

  const livePlans = useMemo(
    () => plans.filter((plan) => running.has(plan.id)),
    [plans, running],
  );
  const liveMembers = useMemo(
    () => members.filter((entry) => running.has(entry.plan_id)),
    [members, running],
  );
  const liveAllBets = useMemo(
    () => allBets.filter((bet) => running.has(bet.planId)),
    [allBets, running],
  );
  const liveFunds = useMemo(
    () => funds.filter((entry) => running.has(entry.planId)),
    [funds, running],
  );
  const liveBets = useMemo(
    () => bets.filter((bet) => running.has(bet.planId)),
    [bets, running],
  );
  const liveStarted = useMemo(
    () =>
      liveMembers
        .filter((entry) => entry.user_id === user?.id)
        .reduce((sum, entry) => sum + Number(entry.starting_bankroll), 0),
    [liveMembers, user?.id],
  );

  // Read once per visit to this page. Leaving a challenge unmounts the home
  // page and coming back mounts it again, so a challenge opened a moment ago
  // has already stopped being news by the time this is read next.
  const since = useMemo(() => seenByPlan(user?.id ?? ""), [user?.id]);

  const news = useMemo(
    () =>
      planNews({
        userId: user?.id ?? "",
        members: liveMembers,
        bets: liveAllBets,
        funds: liveFunds,
        since,
      }),
    [user?.id, liveMembers, liveAllBets, liveFunds, since],
  );

  const rivals = useMemo(
    () => rivalries(user?.id ?? "", livePlans, liveMembers, liveAllBets, liveFunds),
    [user?.id, livePlans, liveMembers, liveAllBets, liveFunds],
  );

  const newsCounts = useMemo(() => newsByPlan(news), [news]);

  /** Bets placed and not yet settled, which no total can account for yet. */
  const openBets = useMemo(
    () => liveBets.filter((bet) => bet.status === "pending").length,
    [liveBets],
  );

  // What their own settled bets say, read off the record rather than stored.
  /**
   * The record is every bet, not only the ones still running.
   *
   * The money on this page is the challenges in play — a finished one holds
   * no money and belongs on its own shelf. But what somebody's betting says
   * about them does not stop being true when a challenge ends, and reading
   * only the live ones meant that whoever had just started a new challenge
   * saw a blank page with twenty-seven settled bets sitting behind it.
   */
  const settled = useMemo(
    () => bets.filter((bet) => bet.status !== "pending").length,
    [bets],
  );

  const insights = useMemo(
    () =>
      board
        ? homeInsights({
            bets,
            challenges: board.challenges,
            label: (market) =>
              MARKET_LABELS[market] ?? canonicalMarket(market),
          })
        : [],
    [board, bets],
  );

  /**
   * The board of games, from the copy the app already holds — or asked for.
   *
   * It used to only read the stored copy, to stay off the provider's ten
   * requests a minute. The effect was that somebody who opened the app and
   * went no further than Início never saw a single game: the copy is written
   * by the pages they had not opened. The request is the same one those pages
   * make, the answer is held for six hours at the server and stored here for
   * everything else, so asking once on arrival costs nothing anybody else was
   * going to spend.
   */
  useEffect(() => {
    let cancelled = false;
    // The stored copy, then the board last night's job left in the database,
    // and only then the engine.
    loadBoard(7)
      .then((data) => {
        if (!cancelled) setGames(data.matches);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0 md:p-6 md:pt-0"
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
        <motion.div variants={fadeUp}>
          <h1 className="sl-section-title text-[15px]">Início</h1>
        </motion.div>

        {/* Before anything of their own: somebody is waiting for an answer.
            This used to be buried inside a challenge's page, which is a page
            about challenges they are already in. */}
        {invites.length > 0 && (
          <motion.div variants={fadeUp}>
            <PlanInvites invites={invites} onAnswered={reload} />
          </motion.div>
        )}

        {/* The three questions somebody arrives with, in the order they ask
            them: quanto tenho, o que tenho em mãos, e como é que isto está a
            correr. The duel used to come first and pushed the day's bet under
            the fold, so the page opened on a scoreboard. */}
        {board && (
          <motion.div variants={fadeUp}>
            <BankrollHero
              bankroll={board.bankroll}
              profit={board.profit}
              startingBankroll={liveStarted}
              bets={liveBets}
              challenges={board.challenges.length}
              openBets={openBets}
            />
          </motion.div>
        )}

        {board && (
          <motion.div variants={fadeUp}>
            <HomeChallenges board={board} news={newsCounts} />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <HomeInsights insights={insights} settled={settled} />
        </motion.div>

        {rivals.length > 0 && (
          <motion.div variants={fadeUp}>
            <HomeRivals rivalries={rivals} news={news} />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <NextGames board={games} />
        </motion.div>


        {/* The rest of the app, from the page it opens on.
            Everything above is a door to the page that holds the whole of it;
            these are the four that nothing above leads to. A phone's bottom
            bar holds five destinations and no more, so without this the
            leagues, the model's record and the saved analyses could only be
            reached on a computer. */}
        <motion.div variants={fadeUp}>
          <HomeDoors />
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
