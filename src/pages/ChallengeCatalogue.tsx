import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Flag,
  Star,
  Trophy,
  TriangleAlert,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreateChallenge } from "@/components/ChallengeSettings";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import { newsByPlan, planNews } from "@/lib/planNews";
import { seenByPlan } from "@/lib/seenStore";
import {
  byDifficulty,
  describeDifficulty,
  difficultyOf,
} from "@/lib/challengeDifficulty";
import { challengeLines, challengePitch } from "@/lib/challengePitch";
import { FinishedChallenges } from "@/components/FinishedChallenges";
import { PublicBets } from "@/components/PublicBets";
import { publicBets } from "@/lib/publicBets";
import { finishedChallenges } from "@/lib/finishedChallenges";
import {
  ASSUMED_WIN_RATE,
  CHALLENGE_TEMPLATES,
  isViable,
  type ChallengeTemplate,
} from "@/lib/challengeRules";
import {
  fetchBetsOfPlans,
  fetchMembersOfPlans,
  fetchPlans,
  fetchVisiblePlans,
  type PlanBet,
  type PlanMember,
  type PlanRecord,
} from "@/lib/planStore";
import { byPopularity, leaderboard, popularity } from "@/lib/leaderboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

function Stars({ count }: { count: number }) {
  return (
    <span className="flex flex-none gap-0.5">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          className={`h-3 w-3 ${
            step <= count ? "fill-primary text-primary" : "text-border"
          }`}
        />
      ))}
    </span>
  );
}

function ChallengeCard({
  template,
  playing,
  rows,
  onCreated,
}: {
  template: ChallengeTemplate;
  /** How many people are running it, across every challenge anybody opened. */
  playing: number;
  rows: ReturnType<typeof leaderboard>;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const { chance, stars } = difficultyOf(template);
  const viable = isViable(template.rules);
  const lines = challengeLines(template);

  return (
    <section className="sl-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="sl-tap flex w-full items-start gap-3 px-4 py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold text-foreground">
            {template.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stars count={stars} />
            <span className="sl-meta text-[11px]">
              {describeDifficulty(chance)}
            </span>
            {playing > 0 && (
              <span className="sl-pill sl-pill-muted flex items-center gap-1 text-[10px]">
                <Users className="h-3 w-3" />
                {playing} a fazer
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
            {challengePitch(template)}
          </p>
        </div>
        <ChevronRight
          className={`mt-0.5 h-4 w-4 flex-none text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
            {lines.map((line) => (
              <div
                key={line.label}
                className={`min-w-0 ${line.wide ? "col-span-2" : ""}`}
              >
                <dt className="sl-meta text-[10px] uppercase tracking-[0.1em]">
                  {line.label}
                </dt>
                {/* Wrapping, not truncating: a value cut off mid-word tells
                    somebody less than no value at all. */}
                <dd className="sl-figure text-[13px] leading-5 text-foreground">
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>

          {viable ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-[hsl(var(--sl-green))]/8 px-2.5 py-2 text-[11px] leading-5 text-[hsl(var(--sl-green))] ring-1 ring-[hsl(var(--sl-green))]/25">
              <Check className="mt-0.5 h-3 w-3 flex-none" strokeWidth={3} />
              <span>
                Matematicamente viável: com{" "}
                {Math.round(ASSUMED_WIN_RATE * 100)}% de acerto, a banca cresce
                ao longo do tempo.
              </span>
            </p>
          ) : (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-destructive/5 px-2.5 py-2 text-[11px] leading-5 text-destructive ring-1 ring-destructive/25">
              <TriangleAlert className="mt-0.5 h-3 w-3 flex-none" />
              <span>
                {template.longShot
                  ? "Bilhete de lotaria, e de propósito: todos os níveis têm de entrar, e uma falha acaba com ele."
                  : "A aposta é grande de mais para a odd: a banca desce ao longo do tempo."}
              </span>
            </p>
          )}

          {rows.length > 0 && (
            <button
              type="button"
              onClick={() => setTableOpen(true)}
              className="sl-tap mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-foreground ring-1 ring-border"
            >
              <Trophy className="h-3.5 w-3.5" />
              Ver classificação
            </button>
          )}

          <div className="mt-2">
            <CreateChallenge startOn={template.key} onCreated={onCreated} />
          </div>
        </div>
      )}

      <Dialog open={tableOpen} onOpenChange={setTableOpen}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="text-sm font-bold">
              {template.name} · classificação
            </DialogTitle>
          </DialogHeader>

          {/* Ranked on how much of the climb is done, because the same
              challenge can be started with €10 or with €200 and the euros
              would put the bigger bankroll first for standing still. */}
          <div className="divide-y divide-border">
            {rows.map((row, index) => (
              <div
                key={`${row.planId}-${row.userId}`}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span className="sl-figure w-5 flex-none text-[13px] text-muted-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {row.name}
                  </p>
                  <p className="sl-meta truncate text-[11px]">
                    Nível {row.day} de {row.days} · {row.settled}{" "}
                    {row.settled === 1 ? "nível fechado" : "níveis fechados"}
                  </p>
                </div>
                <span className="sl-figure flex-none text-right text-[13px] text-foreground">
                  {Math.round(row.progress * 100)}%
                </span>
              </div>
            ))}
          </div>

          <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-5">
            A percentagem é quanto já se subiu da banca inicial até ao
            objetivo. Só aparece quem abriu o desafio aos outros.
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}

/**
 * The challenges there are, and what each one asks of somebody.
 *
 * The tab used to open straight into whichever challenge was running, which
 * left the others invisible: the only way to find out that "Dobrar a banca"
 * existed was to open the create form and read a row of chips. The ones being
 * played stay at the top, one tap from the day's bet.
 */
type Order = "faceis" | "dificeis" | "feitos" | "ordem";

const ORDERS: [Order, string][] = [
  ["faceis", "Mais fáceis"],
  ["dificeis", "Mais difíceis"],
  ["feitos", "Mais feitos"],
  ["ordem", "Por ordem"],
];

export default function ChallengeCatalogue() {
  const { user } = useAuth();
  const {
    members: myMembers,
    allBets,
    funds,
  } = usePlanBoard();
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [everyone, setEveryone] = useState<PlanRecord[]>([]);
  const [members, setMembers] = useState<PlanMember[]>([]);
  const [bets, setBets] = useState<(PlanBet & { planId: string })[]>([]);
  // Opens on the easiest, which is what somebody picking their first
  // challenge is looking for. The other three are a tap away.
  const [order, setOrder] = useState<Order>("faceis");
  /** Which shelf is on screen: mine running, mine finished, or everybody's. */
  const [shelf, setShelf] = useState<"decorrer" | "terminados" | "todos">(
    "decorrer",
  );
  const [token, setToken] = useState(0);

  // What the other players did in each challenge since this person last had
  // it open. The sidebar no longer unfolds the challenges, so this page is
  // where that has to be visible.
  const news = useMemo(() => {
    const since = seenByPlan(user?.id ?? "");
    return newsByPlan(
      planNews({
        userId: user?.id ?? "",
        members: myMembers,
        bets: allBets,
        funds,
        since,
      }),
    );
  }, [user?.id, myMembers, allBets, funds]);

  useEffect(() => {
    let cancelled = false;
    fetchPlans()
      .then((mine) => {
        if (!cancelled) setPlans(mine);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Everything anybody opened up, plus my own: the standings and the counts
  // are built from the two together, so my own challenges count even while
  // they are still closed to everybody else.
  useEffect(() => {
    let cancelled = false;

    fetchVisiblePlans()
      .then(async (open) => {
        if (cancelled) return;
        setEveryone(open);

        const ids = open.map((entry) => entry.id);
        const [people, placed] = await Promise.all([
          fetchMembersOfPlans(ids).catch(() => [] as PlanMember[]),
          fetchBetsOfPlans(ids).catch(
            () => [] as (PlanBet & { planId: string })[],
          ),
        ]);
        if (cancelled) return;
        setMembers(people);
        setBets(placed);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token]);

  const counts = useMemo(
    () => popularity(everyone, members),
    [everyone, members],
  );

  /**
   * How many bets each running challenge holds.
   *
   * Two challenges made from the same model are identical on screen — same
   * name, same bankroll, same target — and opening or deleting the wrong one
   * costs somebody their history. This is the one thing that tells them
   * apart.
   */
  const betsIn = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const bet of allBets) {
      counts[bet.planId] = (counts[bet.planId] ?? 0) + 1;
    }
    return counts;
  }, [allBets]);

  const running = useMemo(
    // Missing, not null, when a row comes from somewhere older than this
    // column: absent means it was never ended.
    () => plans.filter((plan) => !plan.ended_at),
    [plans],
  );

  // Everything the finished ones did, read back off the bets rather than
  // stored: a figure written down at the end stops agreeing with the bets
  // behind it the first time one is corrected.
  const finished = useMemo(
    () =>
      finishedChallenges(user?.id ?? "", plans, myMembers, allBets, funds),
    [user?.id, plans, myMembers, allBets, funds],
  );

  // What everybody else is betting, from the challenges they opened up. The
  // standings of those challenges were already being read for the rankings;
  // the bets were coming with them and had nowhere to be seen.
  const others = useMemo(
    () => publicBets(user?.id ?? "", everyone, members, bets),
    [user?.id, everyone, members, bets],
  );

  const ordered = useMemo(() => {
    if (order === "feitos") return byPopularity([...CHALLENGE_TEMPLATES], counts);
    if (order === "ordem") return CHALLENGE_TEMPLATES;
    return byDifficulty([...CHALLENGE_TEMPLATES], order === "dificeis");
  }, [order, counts]);

  const tables = useMemo(() => {
    const byTemplate: Record<string, ReturnType<typeof leaderboard>> = {};
    for (const template of CHALLENGE_TEMPLATES) {
      const its = everyone.filter(
        (entry) => entry.template_key === template.key,
      );
      byTemplate[template.key] = leaderboard(its, members, bets);
    }
    return byTemplate;
  }, [everyone, members, bets]);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3 p-4 sm:p-5 md:p-6"
      >
        <motion.div variants={fadeUp}>
          <h1 className="sl-section-title text-[15px]">Desafios</h1>
          <p className="sl-meta mt-0.5 text-[11px]">
            Escolhe um, ou continua o que já começaste.
          </p>
        </motion.div>

        {/* Always on screen, even with nothing of one's own yet: the way to
            see what other people are betting cannot be hidden behind having
            started a challenge first. */}
        <motion.div variants={fadeUp} className="space-y-2">
            {/* Two shelves, not one list: a challenge that is over is a record
                to look back at, and one that is running is something to go
                and do. Mixed together, the second kind gets buried under the
                first as the months pass. */}
            <div className="flex gap-1.5">
              {([
                ["decorrer", "A decorrer", running.length],
                ["terminados", "Terminados", finished.length],
                ["todos", "De toda a gente", others.length],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={shelf === value}
                  onClick={() => setShelf(value)}
                  className={`sl-tap flex-none rounded-full px-3 py-1 text-[11px] font-semibold ${
                    shelf === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {label} {count}
                </button>
              ))}
            </div>

            {shelf === "terminados" && <FinishedChallenges entries={finished} />}

            {shelf === "todos" && (
              <PublicBets
                entries={others}
                mineArePrivate={plans.every((plan) => !plan.visible)}
              />
            )}

            {shelf === "decorrer" && running.length === 0 && (
              <p className="sl-card px-4 py-4 text-[12px] leading-6 text-muted-foreground">
                Não tens nenhum desafio a decorrer. Escolhe um aqui em baixo,
                ou vê os que já terminaste.
              </p>
            )}

            {shelf === "decorrer" &&
              running.map((plan) => (
              <Link
                key={plan.id}
                to={`/desafios/${plan.id}`}
                className="sl-card sl-tap flex items-center gap-3 px-4 py-3.5"
              >
                <span
                  className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${
                    !plan.ended_at
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {!plan.ended_at ? (
                    <Trophy className="h-4 w-4" />
                  ) : (
                    <Flag className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
                      {plan.name}
                    </span>
                    {(news[plan.id] ?? 0) > 0 && (
                      <span
                        className="flex-none rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                        aria-label={`${news[plan.id]} ${news[plan.id] === 1 ? "novidade" : "novidades"}`}
                      >
                        {news[plan.id]}
                      </span>
                    )}
                  </span>
                  <span className="sl-meta block text-[11px]">
                    {plan.ended_at && (
                      <span className="font-semibold text-foreground">
                        Terminado ·{" "}
                      </span>
                    )}
                    {eur.format(Number(plan.starting_bankroll))} →{" "}
                    {eur.format(Number(plan.target))} · {plan.days} níveis ·{" "}
                    {betsIn[plan.id] ?? 0}{" "}
                    {(betsIn[plan.id] ?? 0) === 1 ? "aposta" : "apostas"}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
              </Link>
            ))}
        </motion.div>

        <motion.div variants={fadeUp} className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
              Para começar
            </p>
          </div>

          {/* Four chips rather than one button that cycles: with four orders,
              a cycle means tapping past the ones you did not want. */}
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-5 sm:px-5 [&::-webkit-scrollbar]:hidden">
            {ORDERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={order === value}
                onClick={() => setOrder(value)}
                className={`sl-tap flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  order === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground ring-1 ring-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {ordered.map((template) => (
            <ChallengeCard
              key={template.key}
              template={template}
              playing={counts[template.key] ?? 0}
              rows={tables[template.key] ?? []}
              onCreated={() => setToken((value) => value + 1)}
            />
          ))}
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
