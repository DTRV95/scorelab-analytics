import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  Flame,
  Loader2,
  RefreshCw,
  Trophy,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { canonicalMarket } from "@/lib/marketNames";
import { BetComposer } from "@/components/BetComposer";
import { BetDetailDialog } from "@/components/BetDetailDialog";
import { FailedPicker } from "@/components/FailedPicker";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  chanceOfCompleting,
  costOfOneLoss,
  describeRules,
  ladderFor,
  parseRules,
  rungForBankroll,
  type ChallengeRules,
} from "@/lib/challengeRules";
import { nextMove, sinceStart } from "@/lib/challengeGuidance";
import { planSchedule } from "@/lib/challengeSchedule";
import { NextMoveCard } from "@/components/NextMoveCard";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import { PlanPlayers } from "@/components/PlanPlayers";
import {
  CreateChallenge,
  ChallengeSettings,
} from "@/components/ChallengeSettings";
import { fetchFixtureResults, finalScore } from "@/lib/resultsSync";
import {
  acceptInvite,
  betsPlacedToday,
  buildStanding,
  declineInvite,
  fetchMyPendingInvites,
  fetchPlanBets,
  fetchPlanMembers,
  fetchPlans,
  isManualLeg,
  openFixtureRefs,
  createPlan,
  savePlanBet,
  setLegStatus,
  setRemainingLegs,
  settleFromScores,
  settleLostWith,
  settleManually,
  updatePlanBet,
  type PendingInvite,
  type PlanBet,
  type PlanLeg,
  type PlanMember,
  type PlanRecord,
  type PlayerStanding,
} from "@/lib/planStore";
import {
  readCachedBoard,
  writeCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";

const BOARD_DAYS = 7;

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** Wins in a row, which is the run the whole ladder depends on. */
function winStreak(bets: PlanBet[]): number {
  let streak = 0;
  for (const bet of [...bets].reverse()) {
    if (bet.status === "green") streak += 1;
    else if (bet.status === "red") break;
  }
  return streak;
}

/** Where one player stands: their money, their day, and what they have open. */
function PlayerCard({
  standing,
  isMe,
  rules,
  startingBankroll,
}: {
  standing: PlayerStanding;
  isMe: boolean;
  rules: ChallengeRules;
  startingBankroll: number;
}) {
  const ladder = useMemo(
    () => ladderFor(rules, startingBankroll),
    [rules, startingBankroll],
  );
  const planned = ladder[Math.min(standing.day, rules.days) - 1];
  // Where the money stands against the table, which is not the same as which
  // day they are on: winning at a better price than the table pencilled in
  // leaves a cushion, and a lost day leaves a hole.
  const aheadOfLadder = standing.bankroll - (planned?.bankrollStart ?? 0);
  const streak = winStreak(standing.bets);

  return (
    <div
      className={`sl-card overflow-hidden ${isMe ? "ring-1 ring-primary/30" : ""}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5">
        <p className="text-[13px] font-semibold text-foreground">
          {standing.name}
          {isMe && <span className="sl-meta font-normal"> · tu</span>}
        </p>
        <div className="flex flex-none items-center gap-1.5">
          {streak >= 2 && (
            <span className="sl-pill sl-pill-win flex items-center gap-1">
              <Flame className="h-3 w-3" />
              {streak}
            </span>
          )}
          <span className="sl-pill sl-pill-muted sl-figure">
            Dia {standing.day}
          </span>
        </div>
      </div>

      <p className="sl-figure mt-1.5 px-4 text-[1.6rem] leading-8 text-foreground">
        {eur.format(standing.bankroll)}
      </p>

      <p className="sl-meta mt-1 px-4 text-[11px]">
        {`Dia ${standing.day} de ${rules.days}`}
        {planned && (
          <>
            {" · "}
            <span
              className={
                aheadOfLadder >= 0
                  ? "text-[hsl(var(--sl-green))]"
                  : "text-destructive"
              }
            >
              {aheadOfLadder >= 0 ? "+" : ""}
              {eur.format(aheadOfLadder)} vs quadro
            </span>
          </>
        )}
      </p>

      {/* How far up the ladder this player is, as a bar: the number alone does
          not show that the rungs get further apart as the money grows. */}
      <div className="mt-2.5 h-1.5 bg-[hsl(var(--sl-surface))]">
        <motion.div
          className="h-full [background:var(--sl-gradient)]"
          initial={{ width: 0 }}
          animate={{
            width: `${Math.min(100, (standing.day / rules.days) * 100)}%`,
          }}
          transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </div>

      {/* One line instead of three stacked columns: two players used to cost
          half a phone screen in labels alone. */}
      <p className="sl-meta px-4 py-2 text-[11px]">
        {standing.greens} {standing.greens === 1 ? "ganha" : "ganhas"} ·{" "}
        {standing.reds} {standing.reds === 1 ? "perdida" : "perdidas"}
        {standing.openStake > 0
          ? ` · ${eur.format(standing.openStake)} em aberto`
          : ""}
      </p>

      {rules.lossStreakPause !== null &&
        standing.lossStreak >= rules.lossStreakPause && (
          <p className="px-4 pb-3 text-[11px] leading-relaxed text-destructive">
            {standing.lossStreak} perdas seguidas. O desafio manda parar um dia.
          </p>
        )}
    </div>
  );
}

export default function Challenges() {
  const { user } = useAuth();

  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [members, setMembers] = useState<PlanMember[]>([]);
  const [bets, setBets] = useState<PlanBet[]>([]);
  const [board, setBoard] = useState<BoardMatch[]>([]);
  // Competitions the provider did not answer for. Hidden until now, which is
  // how a whole league could go missing without anyone being told.
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [boardAt, setBoardAt] = useState<number | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [marking, setMarking] = useState<number | null>(null);
  /** The bet whose failed games are being picked. */
  const [losing, setLosing] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [answering, setAnswering] = useState(false);
  const currentRow = useRef<HTMLDivElement | null>(null);
  const openDays = useRef<HTMLDivElement | null>(null);
  // Bumped to open the picker from the card at the top of the page.
  const [pickSignal, setPickSignal] = useState(0);
  const [wholeTable, setWholeTable] = useState(false);
  const [allDays, setAllDays] = useState(false);
  // Which bet is open in full, and whose it is.
  const [openBet, setOpenBet] = useState<{
    bet: PlanBet;
    player: string;
  } | null>(null);

  // Which challenges this account is in. Switching between them must not
  // refetch this list, so it is loaded on its own.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // An invitation is the one thing someone can see about a challenge they are
    // not in yet, so it is fetched whether or not a challenge loads.
    fetchMyPendingInvites()
      .then((invites) => {
        if (!cancelled) setPendingInvites(invites);
      })
      .catch(() => undefined);

    fetchPlans()
      .then((mine) => {
        if (cancelled) return;
        setPlans(mine);
        setPlanId((current) =>
          current && mine.some((item) => item.id === current)
            ? current
            : (mine[0]?.id ?? null),
        );
        if (mine.length === 0) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível abrir os desafios. Tenta daqui a pouco.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // The contents of whichever challenge is being looked at.
  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([fetchPlanMembers(planId), fetchPlanBets(planId)])
      .then(([planMembers, planBets]) => {
        if (cancelled) return;
        setMembers(planMembers);
        setBets(planBets);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível abrir este desafio.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [planId, token]);

  /**
   * The board of games, from the last fetch or from the provider.
   *
   * Forced, it skips the saved copy entirely. A competition can go missing for
   * a minute — the provider allows ten requests a minute and the board asks for
   * eight — and waiting out a cache to find out whether it came back is not
   * something anybody should have to do.
   */
  const loadBoard = useCallback((force: boolean) => {
    if (!force) {
      const cached = readCachedBoard(BOARD_DAYS);
      if (cached) {
        setBoard(cached.matches);
        setUnavailable(cached.unavailable ?? []);
        setBoardAt(cached.fetchedAt);
        return;
      }
    }

    setBoardLoading(true);
    fetch(buildApiUrl(`/data/probability-board?days=${BOARD_DAYS}`))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        setBoard(data.matches ?? []);
        setUnavailable(data.unavailable ?? []);
        setBoardAt(Date.now());
        writeCachedBoard({
          days: BOARD_DAYS,
          matches: data.matches ?? [],
          unavailable: data.unavailable ?? [],
          skipped: data.skipped ?? 0,
        });
      })
      .catch(() => undefined)
      .finally(() => setBoardLoading(false));
  }, []);

  useEffect(() => loadBoard(false), [loadBoard]);

  /**
   * The Plano Milhão is there before anyone creates anything.
   *
   * Nothing is written to the database until the first bet: opening the tab
   * should not create rows, and deleting the challenge should give this back
   * rather than an empty page. The id is empty until it is saved, which is how
   * the rest of the page knows it is not real yet.
   */
  const preview = useMemo<PlanRecord>(
    () => ({
      id: "",
      name: "Plano Milhão",
      starting_bankroll: 10,
      target: 1_000_000,
      created_by: user?.id ?? "",
      start_date: null,
      days: MILLION_PLAN_RULES.days,
      rules: MILLION_PLAN_RULES,
    }),
    [user?.id],
  );

  const plan = useMemo(
    () =>
      plans.find((item) => item.id === planId) ??
      (plans.length === 0 ? preview : (plans[0] ?? null)),
    [plans, planId, preview],
  );
  const saved = Boolean(plan && plan.id);
  const ownsPlan = plan?.created_by === user?.id;
  const rules = useMemo(
    () => parseRules(plan?.rules, plan?.days),
    [plan?.rules, plan?.days],
  );

  const players = useMemo<PlanMember[]>(
    () =>
      saved || !user
        ? members
        : [
            {
              plan_id: "",
              user_id: user.id,
              display_name: user.email?.split("@")[0] ?? "Tu",
              starting_bankroll: Number(preview.starting_bankroll),
            },
          ],
    [saved, members, user, preview.starting_bankroll],
  );

  const standings = useMemo(
    () => players.map((member) => buildStanding(member, rules, bets)),
    [players, bets, rules],
  );
  const me = standings.find((standing) => standing.userId === user?.id) ?? null;
  const combined = standings.reduce(
    (sum, standing) => sum + standing.bankroll,
    0,
  );

  // Only once the whole table is open: the window shown by default already
  // has today in it, and scrolling the page on load threw a phone straight
  // past the instruction at the top.
  useEffect(() => {
    if (!wholeTable) return;
    // Optional call on purpose: not every environment the page renders in
    // implements scrolling, and a missing convenience must not take the page
    // down with it.
    currentRow.current?.scrollIntoView?.({ block: "center" });
  }, [wholeTable, me?.day]);

  const usedFixtures = useMemo(
    () =>
      new Set(
        (me?.bets ?? []).flatMap((bet) =>
          bet.legs
            .map((leg) => leg.fixtureId)
            .filter((id): id is number => id !== null),
        ),
      ),
    [me],
  );

  /** My bets still open, newest first — the ones waiting to be closed. */
  /**
   * Days still waiting on their owner: the ones not yet decided, and the ones
   * marked lost whose games nobody has named. Without the second kind, a day
   * closed before this existed could never be filled in, and the analysis
   * would carry "por decidir" forever.
   */
  const openBets = useMemo(
    () =>
      (me?.bets ?? [])
        .filter(
          (bet) =>
            bet.status === "pending" ||
            (bet.status === "red" &&
              bet.legs.length > 1 &&
              bet.legs.some((leg) => leg.status === "pending")),
        )
        .reverse(),
    [me],
  );

  // Open days close from the final scores without anyone pressing anything.
  // A game added by hand has no score to fetch, so those wait for their owner.
  useEffect(() => {
    if (!plan || bets.length === 0) return;
    const refs = openFixtureRefs(bets);
    if (refs.length === 0) return;

    let cancelled = false;

    fetchFixtureResults(refs)
      .then(async ({ results }) => {
        const scores = new Map<
          number,
          { homeGoals: number; awayGoals: number }
        >();
        refs.forEach((ref) => {
          const score = finalScore(results, ref.id);
          if (score) scores.set(ref.id, score);
        });
        if (scores.size === 0 || cancelled) return;

        const settled = bets
          .filter((bet) => bet.status === "pending")
          .map((bet) => ({ bet, payload: settleFromScores(bet, scores) }))
          .filter((entry) => entry.payload !== null);

        if (settled.length === 0 || cancelled) return;

        await Promise.all(
          settled.map((entry) =>
            updatePlanBet(plan.id, entry.bet.id, entry.payload!),
          ),
        );
        if (!cancelled) setToken((value) => value + 1);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [plan, bets]);

  const respond = useCallback(
    async (invitedPlanId: string, accept: boolean) => {
      setAnswering(true);
      try {
        await (accept
          ? acceptInvite(invitedPlanId)
          : declineInvite(invitedPlanId));
        setPendingInvites((previous) =>
          previous.filter((invite) => invite.plan_id !== invitedPlanId),
        );
        setToken((value) => value + 1);
      } catch {
        setError("Não foi possível responder ao convite.");
      } finally {
        setAnswering(false);
      }
    },
    [],
  );

  const place = useCallback(
    async (legs: PlanLeg[], odds: number, stake: number) => {
      if (!plan || !me || !user) return;
      setSaving(true);
      try {
        // The first bet is what brings the challenge into being. Until then it
        // is only the table on screen, and there is nothing to store.
        const id =
          plan.id ||
          (await createPlan({
            name: plan.name,
            startDate: null,
            startingBankroll: Number(plan.starting_bankroll),
            target: Number(plan.target),
            days: rules.days,
            rules,
          }));

        const stored = await savePlanBet(id, user.id, {
          legs,
          odds,
          stake,
          day: me.day,
          status: "pending",
          profitLoss: 0,
          placedAt: new Date().toISOString(),
          settledAt: null,
        });

        if (plan.id) {
          setBets((previous) => [...previous, stored]);
        } else {
          // Newly created: the members and the plan itself have to come back
          // from the server, so the page reloads instead of guessing them.
          setPlanId(id);
          setToken((value) => value + 1);
        }
      } catch {
        setError("A aposta não ficou guardada. Tenta outra vez.");
      } finally {
        setSaving(false);
      }
    },
    [plan, me, user, rules],
  );

  /** Records how one game inside a bet went, and closes the day if that decides it. */
  const markLeg = useCallback(
    async (bet: PlanBet, index: number, status: "green" | "red") => {
      if (!plan?.id) return;
      setMarking(index);
      try {
        const payload = setLegStatus(bet, index, status);
        await updatePlanBet(plan.id, bet.id, payload);
        const updated = { ...payload, id: bet.id, userId: bet.userId };
        setBets((previous) =>
          previous.map((entry) => (entry.id === bet.id ? updated : entry)),
        );
        setOpenBet((current) =>
          current && current.bet.id === bet.id
            ? { ...current, bet: updated }
            : current,
        );
      } catch {
        setError("Não foi possível guardar como correu esse jogo.");
      } finally {
        setMarking(null);
      }
    },
    [plan?.id],
  );

  /** Settles every game still open in one bet, for the day that went all one way. */
  const markRest = useCallback(
    async (bet: PlanBet, status: "green" | "red") => {
      if (!plan?.id) return;
      setMarking(-1);
      try {
        const payload = setRemainingLegs(bet, status);
        await updatePlanBet(plan.id, bet.id, payload);
        const updated = { ...payload, id: bet.id, userId: bet.userId };
        setBets((previous) =>
          previous.map((entry) => (entry.id === bet.id ? updated : entry)),
        );
        setOpenBet((current) =>
          current && current.bet.id === bet.id
            ? { ...current, bet: updated }
            : current,
        );
      } catch {
        setError("Não foi possível guardar como correram esses jogos.");
      } finally {
        setMarking(null);
      }
    },
    [plan?.id],
  );

  /** Closes a lost day from the games the person named as failed. */
  const loseWith = useCallback(
    async (bet: PlanBet, failed: number[]) => {
      if (!plan?.id) return;
      setClosing(bet.id);
      try {
        const payload = settleLostWith(bet, failed);
        await updatePlanBet(plan.id, bet.id, payload);
        setBets((previous) =>
          previous.map((entry) =>
            entry.id === bet.id
              ? { ...payload, id: bet.id, userId: bet.userId }
              : entry,
          ),
        );
        setLosing(null);
      } catch {
        setError("Não foi possível fechar a aposta.");
      } finally {
        setClosing(null);
      }
    },
    [plan?.id],
  );

  const closeBet = useCallback(
    async (bet: PlanBet, won: boolean) => {
      if (!plan) return;
      setClosing(bet.id);
      try {
        const payload = settleManually(bet, won);
        await updatePlanBet(plan.id, bet.id, payload);
        const updated = { ...payload, id: bet.id, userId: bet.userId };
        setBets((previous) =>
          previous.map((entry) => (entry.id === bet.id ? updated : entry)),
        );

        // A lost day of several games leaves every game undecided, and with
        // games typed by hand nothing else will ever fill that in. So the bet
        // opens right here, while the person still remembers which one fell.
        if (!won && updated.legs.length > 1) {
          setOpenBet({ bet: updated, player: me?.name ?? "" });
        }
      } catch {
        setError("Não foi possível fechar a aposta.");
      } finally {
        setClosing(null);
      }
    },
    [plan, me?.name],
  );

  if (loading) {
    return (
      <AppLayout>
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A abrir os desafios...
        </p>
      </AppLayout>
    );
  }

  const inviteBanner = pendingInvites.length > 0 && (
    <div className="space-y-2">
      {pendingInvites.map((invite) => (
        <div
          key={invite.plan_id}
          className="sl-card border-primary/30 p-4 ring-1 ring-primary/20"
        >
          <p className="text-sm font-semibold text-foreground">
            {invite.invited_by_name} convidou-te para o {invite.plan_name}.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Se aceitares, passam a ver as apostas um do outro e cada um segue
            com a sua banca.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              className="sl-btn-primary h-10 flex-1 text-xs"
              disabled={answering}
              onClick={() => respond(invite.plan_id, true)}
            >
              {answering ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Aceitar"
              )}
            </Button>
            <button
              type="button"
              disabled={answering}
              onClick={() => respond(invite.plan_id, false)}
              className="h-10 flex-none rounded-lg border border-border px-4 text-xs font-semibold text-muted-foreground"
            >
              Recusar
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const schedule = planSchedule(
    plan.start_date,
    me?.bets.length ?? 0,
    rules.days,
  );
  const ladder = ladderFor(rules, Number(plan.starting_bankroll));
  const move = me
    ? nextMove({
        rules,
        ladder,
        standing: me,
        schedule,
        target: Number(plan.target),
      })
    : null;
  // Two days behind for context, five ahead for what is coming.
  const day = me?.day ?? 1;
  const visibleLadder = wholeTable
    ? ladder
    : ladder.slice(Math.max(0, day - 3), day + 5);
  const chance = chanceOfCompleting(ladder, me?.day ?? 1);
  const loss = me ? costOfOneLoss(ladder, me.bankroll, me.day) : null;
  const startedWith = standings.reduce(
    (sum, standing) => sum + standing.startingBankroll,
    0,
  );

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3"
      >
        <motion.div
          variants={fadeUp}
          className="flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <h1 className="sl-section-title text-[15px]">{plan.name}</h1>
            {/* The rules have a card of their own further down. Repeating
                them here was a line of small print above everything else. */}
            {schedule.state === "before" && (
              <p className="sl-meta mt-0.5 text-[11px]">
                Começa daqui a {schedule.daysUntilStart}{" "}
                {schedule.daysUntilStart === 1 ? "dia" : "dias"}
              </p>
            )}
            {schedule.state === "finished" && (
              <p className="sl-meta mt-0.5 text-[11px]">
                Os {rules.days} dias já passaram
              </p>
            )}
            {schedule.behindBy > 0 && (
              <p className="mt-0.5 text-[11px] text-amber-700">
                {schedule.behindBy} {schedule.behindBy === 1 ? "dia" : "dias"}{" "}
                sem aposta tua
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-none rounded-lg text-muted-foreground"
            title="Atualizar"
            onClick={() => {
              setToken((value) => value + 1);
              loadBoard(true);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </motion.div>

        {inviteBanner && (
          <motion.div variants={fadeUp}>{inviteBanner}</motion.div>
        )}

        {plans.length > 1 && (
          <motion.div variants={fadeUp} className="flex flex-wrap gap-1.5">
            {plans.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPlanId(item.id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                  item.id === plan.id
                    ? "bg-primary text-white"
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.name}
              </button>
            ))}
          </motion.div>
        )}

        {move && (
          <motion.div variants={fadeUp}>
            <NextMoveCard
              move={move}
              bankroll={me?.bankroll ?? 0}
              onStart={() => setPickSignal((value) => value + 1)}
              onClose={() =>
                openDays.current?.scrollIntoView?.({
                  behavior: "smooth",
                  block: "center",
                })
              }
            />
          </motion.div>
        )}

        {openBets.length > 0 && (
          <motion.section
            ref={openDays}
            variants={fadeUp}
            className="sl-card overflow-hidden"
          >
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-bold text-foreground">Por fechar</h2>
            </div>
            <div className="divide-y divide-border">
              {openBets.map((bet) => {
                const manual = bet.legs.some(isManualLeg);
                return (
                  <div key={bet.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {bet.legs.length === 1
                            ? bet.legs[0].match
                            : `${bet.legs.length} jogos`}
                        </p>
                        <p className="sl-meta truncate text-[11px]">
                          Dia {bet.day} · {eur.format(bet.stake)} @{" "}
                          {bet.odds.toFixed(2)} · ganha{" "}
                          {eur.format(bet.stake * (bet.odds - 1))}
                        </p>
                      </div>
                      <span
                        className={`sl-pill flex-none ${
                          bet.status === "red" ? "sl-pill-loss" : "sl-pill-open"
                        }`}
                      >
                        {bet.status === "red"
                          ? "falta dizer quais"
                          : manual
                            ? "à espera de ti"
                            : "à espera do resultado"}
                      </span>
                    </div>

                    {bet.legs.length > 1 && (
                      <div className="mt-2 space-y-1">
                        {bet.legs.map((leg, index) => (
                          <p
                            key={`${bet.id}-${index}`}
                            className="sl-meta truncate text-[11px]"
                          >
                            {leg.status === "green"
                              ? "✓ "
                              : leg.status === "red"
                                ? "✗ "
                                : "· "}
                            {leg.match} ·{" "}
                            {MARKET_LABELS[leg.market] ??
                              canonicalMarket(leg.market)}{" "}
                            @ {leg.odds.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    )}

                    {losing === bet.id ? (
                      <FailedPicker
                        bet={bet}
                        saving={closing === bet.id}
                        onSave={(failed) => loseWith(bet, failed)}
                        onCancel={() => setLosing(null)}
                      />
                    ) : bet.status === "red" ? (
                      <button
                        type="button"
                        onClick={() => setLosing(bet.id)}
                        className="sl-tap mt-2.5 h-10 w-full rounded-xl text-xs font-semibold text-destructive ring-1 ring-destructive/40"
                      >
                        Dizer quais falharam
                      </button>
                    ) : (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          disabled={closing === bet.id}
                          onClick={() => closeBet(bet, true)}
                          className="sl-tap flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[hsl(var(--sl-green))] ring-1 ring-[hsl(var(--sl-green))]/40 disabled:opacity-40"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {bet.legs.length === 1 ? "Entrou" : "Entraram todos"}
                        </button>
                        <button
                          type="button"
                          disabled={closing === bet.id}
                          onClick={() =>
                            bet.legs.length === 1
                              ? closeBet(bet, false)
                              : setLosing(bet.id)
                          }
                          className="sl-tap flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-destructive ring-1 ring-destructive/40 disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                          {bet.legs.length === 1 ? "Falhou" : "Perdi o dia"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        <motion.section variants={fadeUp} className="sl-card px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                {standings.length > 1 ? "Banca somada" : "A caminho de"}
              </p>
              {/* Solo, the money is already the headline of the card above and
                  of the player card below; repeating it a third time is what
                  makes a phone screen feel like a wall. What is missing there
                  is the distance left to go, so that is what this says. */}
              <p className="sl-figure mt-1 text-[1.7rem] leading-8 text-foreground">
                {standings.length > 1
                  ? eur.format(combined)
                  : eur.format(Number(plan.target))}
              </p>
            </div>
            <div className="text-right">
              <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                {standings.length > 1 ? "Objetivo" : "Faltam"}
              </p>
              <p className="sl-figure mt-1 text-sm text-foreground">
                {standings.length > 1
                  ? eur.format(Number(plan.target))
                  : eur.format(Math.max(0, Number(plan.target) - combined))}
              </p>
            </div>
          </div>

          {/* The bar tracks the days, not the money: a ladder that multiplies
              leaves the bankroll at 0.002% of a million for thirty of the
              thirty-eight days, and a bar that never moves says nothing. */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--sl-surface))]">
            <motion.div
              className="h-full rounded-full [background:var(--sl-gradient)]"
              initial={{ width: 0 }}
              animate={{ width: `${Math.max((day / rules.days) * 100, 2)}%` }}
              transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </div>
          <p className="sl-meta mt-1.5 text-[11px]">
            Dia {day} de {rules.days} ·{" "}
            <span
              className={
                combined > startedWith + 0.005
                  ? "font-semibold text-[hsl(var(--sl-green))]"
                  : combined < startedWith - 0.005
                    ? "font-semibold text-destructive"
                    : ""
              }
            >
              {sinceStart(combined, startedWith)}
            </span>
            {standings.length > 1 ? "" : ` · ${eur.format(combined)} na banca`}
          </p>
        </motion.section>

        <motion.div variants={fadeUp} className="grid gap-2 md:grid-cols-2">
          {standings.map((standing) => (
            <PlayerCard
              key={standing.userId}
              standing={standing}
              isMe={standing.userId === user?.id}
              rules={rules}
              startingBankroll={Number(plan.starting_bankroll)}
            />
          ))}
        </motion.div>

        {me && (
          <motion.div variants={fadeUp}>
            <BetComposer
              board={board}
              rules={rules}
              day={me.day}
              bankroll={me.bankroll}
              betsToday={betsPlacedToday(me)}
              lossStreak={me.lossStreak}
              openBets={me.openBets}
              targetOdds={move?.targetOdds ?? 0}
              plannedStake={move?.stake ?? 0}
              unavailable={unavailable}
              openSignal={pickSignal}
              boardAt={boardAt}
              boardLoading={boardLoading}
              onRefreshBoard={() => loadBoard(true)}
              entryElsewhere={move?.state === "play"}
              usedFixtures={usedFixtures}
              saving={saving}
              onPlace={place}
            />
          </motion.div>
        )}

        {saved && (
          <motion.div variants={fadeUp}>
            <ChallengeSettings
              plan={plan}
              isOwner={Boolean(ownsPlan)}
              onSaved={() => setToken((value) => value + 1)}
              onGone={() => {
                setPlanId(null);
                setToken((value) => value + 1);
              }}
            />
          </motion.div>
        )}

        {saved && (
          <motion.div variants={fadeUp}>
            <PlanPlayers
              planId={plan.id}
              members={members}
              onChanged={() => setToken((value) => value + 1)}
            />
          </motion.div>
        )}

        {saved && (
          <motion.div variants={fadeUp}>
            <Link
              to="/desafios/analise"
              className="sl-card sl-tap flex items-center gap-3 px-4 py-3.5"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-foreground">
                  Abrir análise de apostador
                </span>
                <span className="sl-meta block text-[11px]">
                  Em que mercados apostam e quais é que acertam
                </span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
            </Link>
          </motion.div>
        )}

        {saved && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-bold text-foreground">
                O que cada um escolheu
              </h2>
            </div>
            <div className="grid gap-px bg-border md:grid-cols-2">
              {standings.map((standing) => (
                <div key={standing.userId} className="bg-card p-4">
                  <p className="text-[13px] font-semibold text-foreground">
                    {standing.name}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {[...standing.bets]
                      .reverse()
                      .slice(0, allDays ? 40 : 2)
                      .map((bet) => (
                        <button
                          key={bet.id}
                          type="button"
                          onClick={() =>
                            setOpenBet({ bet, player: standing.name })
                          }
                          aria-label={`Ver a aposta do dia ${bet.day} de ${standing.name}`}
                          className="sl-tap flex w-full items-center gap-2.5 rounded-2xl bg-[hsl(var(--sl-surface))] px-3 py-2.5 text-left hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {bet.legs.length === 1
                                ? bet.legs[0].match
                                : `${bet.legs[0]?.match ?? "—"} + ${bet.legs.length - 1}`}
                            </p>
                            <p className="sl-meta truncate text-[11px]">
                              Dia {bet.day} ·{" "}
                              {bet.legs.length === 1
                                ? (MARKET_LABELS[bet.legs[0].market] ??
                                  canonicalMarket(bet.legs[0].market))
                                : `${bet.legs.length} jogos`}{" "}
                              @ {bet.odds.toFixed(2)}
                            </p>
                          </div>
                          <span
                            className={`sl-pill flex-none ${
                              bet.status === "green"
                                ? "sl-pill-win"
                                : bet.status === "red"
                                  ? "sl-pill-loss"
                                  : "sl-pill-open"
                            }`}
                          >
                            {bet.status === "green"
                              ? `+${bet.profitLoss.toFixed(2)}`
                              : bet.status === "red"
                                ? bet.profitLoss.toFixed(2)
                                : "aberta"}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                        </button>
                      ))}
                    {standing.bets.length === 0 && (
                      <p className="sl-meta text-[11px]">Ainda não apostou.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Two days is what anyone looks at. The rest is history, and a
                history that is always open turns the page into a scroll. */}
            {standings.some((standing) => standing.bets.length > 2) && (
              <button
                type="button"
                onClick={() => setAllDays((open) => !open)}
                className="w-full border-t border-border py-2.5 text-[11px] font-semibold text-primary"
              >
                {allDays ? "Mostrar só os últimos 2 dias" : "Ver todos os dias"}
              </button>
            )}
          </motion.section>
        )}

        <motion.section variants={fadeUp} className="sl-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Trophy className="h-4 w-4 text-primary" />A escada
            </h2>
            <span className="sl-meta text-[11px]">
              {me ? `estás no dia ${me.day}` : ""}
            </span>
          </div>

          {/* What the ladder costs, in the same card as the ladder. Two cards
              about the same thing is one card too many on a phone — and a
              bankroll tool that buries this is not doing its job. */}
          <div className="space-y-2 border-b border-border p-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
              <span className="sl-meta min-w-0 flex-1 text-[11px]">
                Chegar do dia {me?.day ?? 1} ao fim
              </span>
              <span className="font-mono-data flex-none text-sm font-bold text-foreground">
                {chance < 0.0001
                  ? `1 em ${Math.round(1 / chance).toLocaleString("pt-PT")}`
                  : `${(chance * 100).toFixed(2)}%`}
              </span>
            </div>
            {loss && (
              <div className="rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
                <p className="sl-meta text-[11px]">Perder hoje deixa-te em</p>
                <p className="mt-0.5 font-mono-data text-sm font-bold text-foreground">
                  {eur.format(loss.bankrollAfter)}
                  <span className="sl-meta font-normal">
                    {loss.dayAfter === loss.dayBefore
                      ? " · e ainda no dia 1"
                      : ` · de volta ao dia ${loss.dayAfter}, que pede ${eur.format(
                          ladder[loss.dayAfter - 1]?.stake ?? 0,
                        )}`}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* The document's own columns, in its order, so the sheet on the
              table and the screen can be read side by side. */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-1.5">
            <span className="sl-meta w-6 flex-none text-[10px] uppercase tracking-[0.1em]">
              Dia
            </span>
            <span className="sl-meta ml-0.5 flex-1 text-[10px] uppercase tracking-[0.1em]">
              Banca
            </span>
            <span className="sl-meta flex-1 text-right text-[10px] uppercase tracking-[0.1em]">
              Aposta
            </span>
            <span className="sl-meta w-10 flex-none text-right text-[10px] uppercase tracking-[0.1em]">
              Odd
            </span>
            <span className="sl-meta flex-1 text-right text-[10px] uppercase tracking-[0.1em]">
              Total
            </span>
          </div>

          {/* A window around today by default. Thirty-eight rows on a phone is
              a scroll inside a scroll, and the rows that matter are the one
              being played and the few on either side of it. */}
          <div
            className={
              wholeTable
                ? "max-h-[320px] divide-y divide-border overflow-y-auto"
                : "divide-y divide-border"
            }
          >
            {visibleLadder.map((rung) => {
              const today = me?.day === rung.day;
              const done = me ? rung.day < me.day : false;
              return (
                <div
                  key={rung.day}
                  ref={today ? currentRow : undefined}
                  className={`flex items-center gap-2 px-4 py-2 ${
                    today
                      ? "bg-gradient-to-r from-primary/12 to-transparent"
                      : done
                        ? ""
                        : "opacity-55"
                  }`}
                >
                  <span
                    className={`sl-figure flex h-6 w-6 flex-none items-center justify-center rounded-lg text-[11px] ${
                      today
                        ? "text-white shadow-sm [background:var(--sl-gradient)]"
                        : done
                          ? "bg-primary/12 text-primary"
                          : "text-muted-foreground"
                    }`}
                  >
                    {rung.day}
                  </span>
                  <span className="font-mono-data min-w-0 flex-1 text-[11px] text-muted-foreground">
                    {eur.format(rung.bankrollStart)}
                  </span>
                  <span className="font-mono-data min-w-0 flex-1 text-right text-[11px] font-bold text-foreground">
                    {eur.format(rung.stake)}
                  </span>
                  <span className="font-mono-data w-10 flex-none text-right text-[11px] text-muted-foreground">
                    {rung.odds.toFixed(2)}
                  </span>
                  <span className="font-mono-data min-w-0 flex-1 text-right text-[11px] text-muted-foreground">
                    {eur.format(rung.bankrollEnd)}
                  </span>
                </div>
              );
            })}
          </div>

          {ladder.length > visibleLadder.length && (
            <button
              type="button"
              onClick={() => setWholeTable(true)}
              className="w-full border-t border-border py-2.5 text-[11px] font-semibold text-primary"
            >
              Ver o quadro todo ({ladder.length} dias)
            </button>
          )}
          {wholeTable && (
            <button
              type="button"
              onClick={() => setWholeTable(false)}
              className="w-full border-t border-border py-2.5 text-[11px] font-semibold text-muted-foreground"
            >
              Mostrar só à volta do dia de hoje
            </button>
          )}
        </motion.section>

        <motion.div variants={fadeUp}>
          <CreateChallenge onCreated={() => setToken((value) => value + 1)} />
        </motion.div>

        <BetDetailDialog
          bet={openBet?.bet ?? null}
          player={openBet?.player ?? ""}
          mine={openBet?.bet.userId === user?.id}
          marking={marking}
          onMarkLeg={markLeg}
          onMarkRest={markRest}
          onClose={() => setOpenBet(null)}
        />

        {error && (
          <motion.p variants={fadeUp} className="text-[11px] text-destructive">
            {error}
          </motion.p>
        )}
      </motion.div>
    </AppLayout>
  );
}
