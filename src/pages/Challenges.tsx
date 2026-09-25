import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Flame,
  Loader2,
  RefreshCw,
  Trophy,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { BetComposer } from "@/components/BetComposer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  buildLadder,
  chanceOfCompleting,
  costOfOneLoss,
  describeRules,
  parseRules,
  rungForBankroll,
  type ChallengeRules,
} from "@/lib/challengeRules";
import { planSchedule } from "@/lib/challengeSchedule";
import { PlanPlayers } from "@/components/PlanPlayers";
import { CreateChallenge, ChallengeSettings } from "@/components/ChallengeSettings";
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
  savePlanBet,
  settleFromScores,
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

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };
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
    () => buildLadder(rules, startingBankroll),
    [rules, startingBankroll]
  );
  const planned = ladder[Math.min(standing.day, rules.days) - 1];
  const rung = rungForBankroll(standing.bankroll, ladder);
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
          <span className="sl-pill sl-pill-muted">Dia {standing.day}</span>
        </div>
      </div>

      <p className="mt-2 px-4 font-mono-data text-[1.35rem] font-bold text-foreground">
        {eur.format(standing.bankroll)}
      </p>

      <p className="sl-meta mt-1 px-4 text-[11px]">
        {rung === 0
          ? "Abaixo do primeiro degrau"
          : `Degrau ${rung} de ${rules.days}`}
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
              {eur.format(aheadOfLadder)} vs escada
            </span>
          </>
        )}
      </p>

      {/* How far up the ladder this player is, as a bar: the number alone does
          not show that the rungs get further apart as the money grows. */}
      <div className="mt-2.5 h-1.5 bg-[hsl(var(--sl-surface))]">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${Math.min(100, (rung / rules.days) * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-2.5">
        {[
          { label: "Ganhas", value: String(standing.greens) },
          { label: "Perdidas", value: String(standing.reds) },
          {
            label: "Em aberto",
            value: standing.openStake > 0 ? eur.format(standing.openStake) : "—",
          },
        ].map((item) => (
          <div key={item.label}>
            <p className="sl-meta text-[10px] uppercase tracking-[0.1em]">
              {item.label}
            </p>
            <p className="mt-0.5 font-mono-data text-sm font-semibold text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {rules.lossStreakPause !== null && standing.lossStreak >= rules.lossStreakPause && (
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const [token, setToken] = useState(0);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [answering, setAnswering] = useState(false);

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
            : mine[0]?.id ?? null
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

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedBoard(BOARD_DAYS);
    if (cached) {
      setBoard(cached.matches);
      return;
    }

    fetch(buildApiUrl(`/data/probability-board?days=${BOARD_DAYS}`))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setBoard(data.matches ?? []);
        writeCachedBoard({
          days: BOARD_DAYS,
          matches: data.matches ?? [],
          unavailable: data.unavailable ?? [],
          skipped: data.skipped ?? 0,
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const plan = useMemo(
    () => plans.find((item) => item.id === planId) ?? null,
    [plans, planId]
  );
  const ownsPlan = plan?.created_by === user?.id;
  const rules = useMemo(
    () => parseRules(plan?.rules, plan?.days),
    [plan?.rules, plan?.days]
  );

  const standings = useMemo(
    () => members.map((member) => buildStanding(member, bets)),
    [members, bets]
  );
  const me = standings.find((standing) => standing.userId === user?.id) ?? null;
  const combined = standings.reduce((sum, standing) => sum + standing.bankroll, 0);

  const usedFixtures = useMemo(
    () =>
      new Set(
        (me?.bets ?? []).flatMap((bet) =>
          bet.legs
            .map((leg) => leg.fixtureId)
            .filter((id): id is number => id !== null)
        )
      ),
    [me]
  );

  /** My bets still open, newest first — the ones waiting to be closed. */
  const openBets = useMemo(
    () => (me?.bets ?? []).filter((bet) => bet.status === "pending").reverse(),
    [me]
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
        const scores = new Map<number, { homeGoals: number; awayGoals: number }>();
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
          settled.map((entry) => updatePlanBet(plan.id, entry.bet.id, entry.payload!))
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
        await (accept ? acceptInvite(invitedPlanId) : declineInvite(invitedPlanId));
        setPendingInvites((previous) =>
          previous.filter((invite) => invite.plan_id !== invitedPlanId)
        );
        setToken((value) => value + 1);
      } catch {
        setError("Não foi possível responder ao convite.");
      } finally {
        setAnswering(false);
      }
    },
    []
  );

  const place = useCallback(
    async (legs: PlanLeg[], odds: number, stake: number) => {
      if (!plan || !me || !user) return;
      setSaving(true);
      try {
        const saved = await savePlanBet(plan.id, user.id, {
          legs,
          odds,
          stake,
          day: me.day,
          status: "pending",
          profitLoss: 0,
          placedAt: new Date().toISOString(),
          settledAt: null,
        });
        setBets((previous) => [...previous, saved]);
      } catch {
        setError("A aposta não ficou guardada. Tenta outra vez.");
      } finally {
        setSaving(false);
      }
    },
    [plan, me, user]
  );

  const closeBet = useCallback(
    async (bet: PlanBet, won: boolean) => {
      if (!plan) return;
      setClosing(bet.id);
      try {
        const payload = settleManually(bet, won);
        await updatePlanBet(plan.id, bet.id, payload);
        setBets((previous) =>
          previous.map((entry) =>
            entry.id === bet.id ? { ...payload, id: bet.id, userId: bet.userId } : entry
          )
        );
      } catch {
        setError("Não foi possível fechar a aposta.");
      } finally {
        setClosing(null);
      }
    },
    [plan]
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
              {answering ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aceitar"}
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

  if (!plan) {
    return (
      <AppLayout>
        <div className="space-y-3 py-2">
          <div>
            <h1 className="sl-section-title text-[15px]">Desafios</h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Um desafio é uma banca, um objetivo e as regras que aceitaste
              cumprir. Podes jogar sozinho ou convidar alguém.
            </p>
          </div>
          {inviteBanner}
          <CreateChallenge onCreated={() => setToken((value) => value + 1)} />
          {error && (
            <p className="text-center text-sm text-muted-foreground">{error}</p>
          )}
        </div>
      </AppLayout>
    );
  }

  const schedule = planSchedule(plan.start_date, me?.bets.length ?? 0, rules.days);
  const ladder = buildLadder(rules, Number(plan.starting_bankroll));
  const chance = chanceOfCompleting(rules, me?.day ?? 1);
  const loss = me ? costOfOneLoss(rules, me.bankroll, me.day, ladder) : null;
  const progress = Math.min(100, (combined / Number(plan.target)) * 100);

  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="sl-section-title text-[15px]">{plan.name}</h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {schedule.state === "before"
                ? `Começa daqui a ${schedule.daysUntilStart} ${
                    schedule.daysUntilStart === 1 ? "dia" : "dias"
                  }. ${describeRules(rules)}.`
                : schedule.state === "finished"
                ? `Os ${rules.days} dias já passaram.`
                : schedule.state === "running"
                ? `Dia ${schedule.calendarDay} de ${rules.days} no calendário · ${describeRules(
                    rules
                  )}.`
                : `${describeRules(rules)}.`}
            </p>
            {schedule.behindBy > 0 && (
              <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                Passaram {schedule.behindBy}{" "}
                {schedule.behindBy === 1 ? "dia" : "dias"} sem aposta tua. A
                escada não anda sozinha, só fica à espera.
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-none rounded-lg text-muted-foreground"
            title="Atualizar"
            onClick={() => setToken((value) => value + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </motion.div>

        {inviteBanner && <motion.div variants={fadeUp}>{inviteBanner}</motion.div>}

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

        <motion.section variants={fadeUp} className="sl-card px-4 py-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                {standings.length > 1 ? "Banca somada" : "Banca"}
              </p>
              <p className="mt-1 font-mono-data text-2xl font-bold text-foreground">
                {eur.format(combined)}
              </p>
            </div>
            <div className="text-right">
              <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
                Objetivo
              </p>
              <p className="mt-1 font-mono-data text-sm font-bold text-foreground">
                {eur.format(Number(plan.target))}
              </p>
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--sl-surface))]">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.max(progress, 0.4)}%` }}
            />
          </div>
          <p className="sl-meta mt-1.5 text-[11px]">
            {progress < 0.1 ? "menos de 0,1" : progress.toFixed(1)}% do caminho ·
            faltam {eur.format(Math.max(0, Number(plan.target) - combined))}
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

        {openBets.length > 0 && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-bold text-foreground">Por fechar</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                Os jogos do quadro fecham-se sozinhos quando sai o resultado. Um
                jogo que meteste à mão só tu sabes como acabou.
              </p>
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
                      <span className="sl-pill sl-pill-open flex-none">
                        {manual ? "à espera de ti" : "à espera do resultado"}
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
                            {MARKET_LABELS[leg.market] ?? leg.market} @{" "}
                            {leg.odds.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        disabled={closing === bet.id}
                        onClick={() => closeBet(bet, true)}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[hsl(var(--sl-green))]/40 text-xs font-semibold text-[hsl(var(--sl-green))] disabled:opacity-40"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {bet.legs.length === 1 ? "Entrou" : "Ganhei o dia"}
                      </button>
                      <button
                        type="button"
                        disabled={closing === bet.id}
                        onClick={() => closeBet(bet, false)}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive/40 text-xs font-semibold text-destructive disabled:opacity-40"
                      >
                        <X className="h-3.5 w-3.5" />
                        {bet.legs.length === 1 ? "Falhou" : "Perdi o dia"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.section>
        )}

        {me && (
          <motion.div variants={fadeUp}>
            <BetComposer
              board={board}
              rules={rules}
              day={me.day}
              bankroll={me.bankroll}
              betsToday={betsPlacedToday(me)}
              lossStreak={me.lossStreak}
              usedFixtures={usedFixtures}
              saving={saving}
              onPlace={place}
            />
          </motion.div>
        )}

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

        <motion.div variants={fadeUp}>
          <PlanPlayers
            planId={plan.id}
            members={members}
            onChanged={() => setToken((value) => value + 1)}
          />
        </motion.div>

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
                  {[...standing.bets].reverse().slice(0, 8).map((bet) => (
                    <div
                      key={bet.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2"
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
                            ? MARKET_LABELS[bet.legs[0].market] ?? bet.legs[0].market
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
                    </div>
                  ))}
                  {standing.bets.length === 0 && (
                    <p className="sl-meta text-[11px]">Ainda não apostou.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* The challenge reads like a schedule. It is a parlay, and a bankroll
            tool that hides that is not doing its job. */}
        <motion.section variants={fadeUp} className="sl-card overflow-hidden">
          <div className="border-b border-border px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-600" />O que a escada
              exige
            </h2>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cada degrau só conta se a aposta entrar, por isso o desafio inteiro
              é uma sequência de vitórias seguidas, não uma média.
            </p>
            <div className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
              <span className="sl-meta min-w-0 flex-1 text-[11px]">
                Chance de {me ? `chegar do dia ${me.day} ao fim` : "fazer a escada toda"}
              </span>
              <span className="font-mono-data flex-none text-sm font-bold text-foreground">
                {chance < 0.0001
                  ? `1 em ${Math.round(1 / chance).toLocaleString("pt-PT")}`
                  : `${(chance * 100).toFixed(2)}%`}
              </span>
            </div>
            {loss && (
              <div className="rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
                <p className="sl-meta text-[11px]">Uma derrota hoje deixa-te em</p>
                <p className="mt-0.5 font-mono-data text-sm font-bold text-foreground">
                  {eur.format(loss.bankrollAfter)}
                  <span className="sl-meta font-normal">
                    {loss.rungAfter === 0
                      ? " · abaixo do primeiro degrau"
                      : ` · degrau ${loss.rungAfter}, ${
                          loss.rungBefore - loss.rungAfter
                        } atrás`}
                  </span>
                </p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="sl-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Trophy className="h-4 w-4 text-primary" />A escada
            </h2>
            <span className="sl-meta text-[11px]">
              {me ? `estás no degrau ${rungForBankroll(me.bankroll, ladder)}` : ""}
            </span>
          </div>
          <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
            {ladder.map((rung) => {
              const reached = me ? me.bankroll >= rung.bankrollStart : false;
              return (
                <div
                  key={rung.day}
                  className={`flex items-center gap-3 px-4 py-2 ${
                    reached ? "" : "opacity-60"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-md font-mono-data text-[11px] ${
                      reached
                        ? "bg-primary/15 font-bold text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {rung.day}
                  </span>
                  <span className="font-mono-data min-w-0 flex-1 text-xs text-foreground">
                    {eur.format(rung.bankrollStart)}
                  </span>
                  <span className="sl-meta flex-none text-[11px]">
                    aposta {eur.format(rung.stake)} @ {rung.odds.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.section>

        <motion.div variants={fadeUp}>
          <CreateChallenge onCreated={() => setToken((value) => value + 1)} />
        </motion.div>

        {error && (
          <motion.p variants={fadeUp} className="text-[11px] text-destructive">
            {error}
          </motion.p>
        )}
      </motion.div>
    </AppLayout>
  );
}
