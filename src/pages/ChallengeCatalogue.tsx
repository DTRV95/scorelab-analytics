import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Star,
  Trophy,
  TriangleAlert,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreateChallenge } from "@/components/ChallengeSettings";
import {
  describeDifficulty,
  difficultyOf,
} from "@/lib/challengeDifficulty";
import { challengeLines, challengePitch } from "@/lib/challengePitch";
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
                  ? "Bilhete de lotaria, e de propósito: todos os dias têm de entrar, e uma falha acaba com ele."
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
                    Dia {row.day} de {row.days} · {row.settled}{" "}
                    {row.settled === 1 ? "dia fechado" : "dias fechados"}
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
export default function ChallengeCatalogue() {
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [everyone, setEveryone] = useState<PlanRecord[]>([]);
  const [members, setMembers] = useState<PlanMember[]>([]);
  const [bets, setBets] = useState<(PlanBet & { planId: string })[]>([]);
  const [busiestFirst, setBusiestFirst] = useState(true);
  const [token, setToken] = useState(0);

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

  const ordered = useMemo(
    () =>
      busiestFirst
        ? byPopularity([...CHALLENGE_TEMPLATES], counts)
        : CHALLENGE_TEMPLATES,
    [busiestFirst, counts],
  );

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

        {plans.length > 0 && (
          <motion.div variants={fadeUp} className="space-y-2">
            <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
              A decorrer
            </p>
            {plans.map((plan) => (
              <Link
                key={plan.id}
                to={`/desafios/${plan.id}`}
                className="sl-card sl-tap flex items-center gap-3 px-4 py-3.5"
              >
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10">
                  <Trophy className="h-4 w-4 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-foreground">
                    {plan.name}
                  </span>
                  <span className="sl-meta block text-[11px]">
                    {eur.format(Number(plan.starting_bankroll))} →{" "}
                    {eur.format(Number(plan.target))} · {plan.days} dias
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
              </Link>
            ))}
          </motion.div>
        )}

        <motion.div variants={fadeUp} className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2">
            <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
              Para começar
            </p>
            <button
              type="button"
              onClick={() => setBusiestFirst((value) => !value)}
              className="sl-tap rounded-full px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border"
            >
              {busiestFirst ? "Mais feitos primeiro" : "Por ordem"}
            </button>
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
