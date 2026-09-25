import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Loader2, RefreshCw, Trophy } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  ODDS_MAX,
  ODDS_MIN,
  PLAN_DAYS,
  PLAN_TARGET,
  buildLadder,
  chanceOfCompleting,
  planSchedule,
  checkBet,
  costOfOneLoss,
  plannedStake,
  rungForBankroll,
  stakePctForDay,
} from "@/lib/millionPlan";
import { PlanPlayers } from "@/components/PlanPlayers";
import { combineOdds, openFixtureRefs, settleFromScores, updatePlanBet } from "@/lib/planStore";
import { fetchFixtureResults, finalScore } from "@/lib/resultsSync";
import { CreatePlan, PlanSettings } from "@/components/PlanSettings";
import {
  acceptInvite,
  betsPlacedToday,
  buildStanding,
  declineInvite,
  fetchMyPendingInvites,
  fetchPlanBets,
  fetchPlanMembers,
  fetchPlans,
  savePlanBet,
  type PendingInvite,
  type PlanBet,
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
const SHORTLIST_SIZE = 10;

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

function kickoffTime(kickoff: string | null) {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const ladder = buildLadder();

/** Where one brother stands: his money, his day, and what he has open. */
function PlayerCard({
  standing,
  isMe,
}: {
  standing: PlayerStanding;
  isMe: boolean;
}) {
  const planned = ladder[Math.min(standing.day, PLAN_DAYS) - 1];
  const rung = rungForBankroll(standing.bankroll, ladder);
  const aheadOfLadder = standing.bankroll - (planned?.bankrollStart ?? 0);

  return (
    <div
      className={`sl-card px-4 py-3.5 ${
        isMe ? "ring-1 ring-primary/30" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-foreground">
          {standing.name}
          {isMe && <span className="sl-meta font-normal"> · tu</span>}
        </p>
        <span className="sl-pill sl-pill-muted flex-none">Dia {standing.day}</span>
      </div>

      <p className="mt-2 font-mono-data text-[1.35rem] font-bold text-foreground">
        {eur.format(standing.bankroll)}
      </p>

      <p className="sl-meta mt-1 text-[11px]">
        {rung === 0
          ? "Abaixo do primeiro degrau"
          : `Escada no degrau ${rung} de ${PLAN_DAYS}`}
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
              {eur.format(aheadOfLadder)} vs plano
            </span>
          </>
        )}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2.5">
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

      {standing.lossStreak >= 3 && (
        <p className="mt-2 text-[11px] leading-relaxed text-destructive">
          {standing.lossStreak} perdas seguidas. O plano manda parar um dia.
        </p>
      )}
    </div>
  );
}

export default function MillionPlan() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [planId, setPlanId] = useState<string | null>(null);
  const [members, setMembers] = useState<PlanMember[]>([]);
  const [bets, setBets] = useState<PlanBet[]>([]);
  const [board, setBoard] = useState<BoardMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // What this player has lined up for today: the games chosen, each with the
  // odd their bookmaker is offering.
  const [selection, setSelection] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState(0);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [answering, setAnswering] = useState(false);

  // Which plans this account is in. Switching between them must not refetch
  // this list, so it is loaded on its own.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // An invitation is the one thing someone can see about a plan they are not
    // in yet, so it is fetched whether or not a plan loads.
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
          setError("Não foi possível abrir o plano. Tenta novamente daqui a pouco.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  // The contents of whichever plan is being looked at.
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
        if (!cancelled) setError("Não foi possível abrir este plano.");
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

  const standings = useMemo(
    () => members.map((member) => buildStanding(member, bets)),
    [members, bets]
  );
  const me = standings.find((standing) => standing.userId === user?.id) ?? null;
  const combined = standings.reduce((sum, standing) => sum + standing.bankroll, 0);

  /** The plan's shortlist: the ten strongest calls on the board, by probability. */
  const shortlist = useMemo(
    () =>
      [...board]
        .sort((a, b) => b.headline_pct - a.headline_pct)
        .slice(0, SHORTLIST_SIZE),
    [board]
  );

  const takenByMe = useMemo(
    () =>
      new Set(
        (me?.bets ?? []).flatMap((bet) => bet.legs.map((leg) => leg.fixtureId))
      ),
    [me]
  );

  const myStake = me ? plannedStake(me.bankroll, me.day) : 0;

  /** The games picked for today, in board order, with valid prices only. */
  const chosenLegs = useMemo(() => {
    return shortlist
      .filter((match) => selection[match.fixture_id] !== undefined)
      .map((match) => {
        const raw = (selection[match.fixture_id] ?? "").replace(",", ".");
        const odds = Number(raw);
        return {
          match,
          odds: Number.isFinite(odds) && odds > 1 ? odds : 0,
        };
      });
  }, [shortlist, selection]);

  const allPriced =
    chosenLegs.length > 0 && chosenLegs.every((leg) => leg.odds > 0);
  const combinedOdd = allPriced ? combineOdds(chosenLegs) : 0;
  const hasOdds = combinedOdd > 1;
  const oddsValue = combinedOdd;
  const violations = useMemo(() => {
    if (!me || !hasOdds) return [];
    return checkBet({
      odds: oddsValue,
      stake: myStake,
      bankroll: me.bankroll,
      day: me.day,
      betsPlacedToday: betsPlacedToday(me),
      lossStreak: me.lossStreak,
    });
  }, [me, hasOdds, oddsValue, myStake]);

  // Open days are closed from the final scores, without anyone pressing
  // anything: the bet is all-or-nothing and the score decides it.
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
    async (planId: string, accept: boolean) => {
      setAnswering(true);
      try {
        await (accept ? acceptInvite(planId) : declineInvite(planId));
        setPendingInvites((previous) =>
          previous.filter((invite) => invite.plan_id !== planId)
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

  const place = useCallback(async () => {
    if (!plan || !me || !hasOdds || !user) return;
    setSaving(true);
    try {
      const saved = await savePlanBet(plan.id, user.id, {
        legs: chosenLegs.map(({ match, odds }) => ({
          match: `${match.home_name} vs ${match.away_name}`,
          homeTeam: match.home_name,
          awayTeam: match.away_name,
          league: match.league,
          market: match.headline_market,
          odds,
          modelProb: match.headline_pct,
          fixtureId: match.fixture_id,
          kickoff: match.kickoff,
          status: "pending",
        })),
        odds: combinedOdd,
        stake: myStake,
        day: me.day,
        status: "pending",
        profitLoss: 0,
        placedAt: new Date().toISOString(),
        settledAt: null,
      });
      setBets((previous) => [...previous, saved]);
      setSelection({});
    } catch {
      setError("A aposta não ficou guardada. Tenta outra vez.");
    } finally {
      setSaving(false);
    }
  }, [plan, me, hasOdds, user, chosenLegs, combinedOdd, myStake]);

  if (loading) {
    return (
      <AppLayout>
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A abrir o plano...
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

  if (!plan) {
    return (
      <AppLayout>
        <div className="space-y-3 py-2">
          {inviteBanner}
          <CreatePlan onCreated={() => setToken((value) => value + 1)} />
          {error && (
            <p className="text-center text-sm text-muted-foreground">{error}</p>
          )}
        </div>
      </AppLayout>
    );
  }

  const schedule = planSchedule(
    plan.start_date,
    me?.bets.length ?? 0,
    plan.days ?? PLAN_DAYS
  );

  const chance = me ? chanceOfCompleting(me.day) : chanceOfCompleting(1);
  const loss = me ? costOfOneLoss(me.bankroll, me.day, ladder) : null;
  const progress = Math.min(100, (combined / PLAN_TARGET) * 100);

  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="sl-section-title text-[15px]">
              {plan.name}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {schedule.state === "before"
                ? `Começa daqui a ${schedule.daysUntilStart} ${
                    schedule.daysUntilStart === 1 ? "dia" : "dias"
                  }. ${plan.days ?? PLAN_DAYS} dias, uma aposta por dia cada um.`
                : schedule.state === "finished"
                ? `Os ${plan.days ?? PLAN_DAYS} dias do plano já passaram.`
                : schedule.state === "running"
                ? `Dia ${schedule.calendarDay} de ${plan.days ?? PLAN_DAYS} no calendário, uma aposta por dia cada um.`
                : `${plan.days ?? PLAN_DAYS} dias, uma aposta por dia cada um, a ganhar sempre sobre o que o dia anterior deixou.`}
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
                Banca somada
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
                {eur.format(PLAN_TARGET)}
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
            faltam {eur.format(Math.max(0, PLAN_TARGET - combined))}
          </p>
        </motion.section>

        <motion.div variants={fadeUp} className="grid gap-2 md:grid-cols-2">
          {standings.map((standing) => (
            <PlayerCard
              key={standing.userId}
              standing={standing}
              isMe={standing.userId === user?.id}
            />
          ))}
        </motion.div>

        {me && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-bold text-foreground">
                A tua aposta do dia {me.day}
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                O plano manda {(stakePctForDay(me.day) * 100).toFixed(0)}% da
                banca hoje:{" "}
                <span className="font-mono-data font-semibold text-foreground">
                  {eur.format(myStake)}
                </span>{" "}
                a uma odd entre {ODDS_MIN.toFixed(2)} e {ODDS_MAX.toFixed(2)}.
              </p>
            </div>

            <div className="divide-y divide-border">
              {shortlist.map((match) => {
                const taken = takenByMe.has(match.fixture_id);
                const chosen = selection[match.fixture_id] !== undefined;

                return (
                  <div key={match.fixture_id} className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">
                          {match.home_name} vs {match.away_name}
                        </p>
                        <p className="sl-meta truncate text-[11px]">
                          {MARKET_LABELS[match.headline_market] ??
                            match.headline_market}{" "}
                          · {kickoffTime(match.kickoff)}
                        </p>
                      </div>
                      <span className="font-mono-data flex-none text-sm font-bold text-[hsl(var(--sl-green))]">
                        {match.headline_pct.toFixed(1)}%
                      </span>

                      {chosen ? (
                        <input
                          inputMode="decimal"
                          autoFocus
                          value={selection[match.fixture_id]}
                          onChange={(event) =>
                            setSelection((previous) => ({
                              ...previous,
                              [match.fixture_id]: event.target.value,
                            }))
                          }
                          placeholder="1.85"
                          aria-label={`Odd para ${match.home_name} vs ${match.away_name}`}
                          className="h-9 w-[72px] flex-none rounded-lg border border-primary/40 bg-card px-2 text-center font-mono-data text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      ) : null}

                      <button
                        type="button"
                        disabled={taken}
                        onClick={() =>
                          setSelection((previous) => {
                            const next = { ...previous };
                            if (chosen) delete next[match.fixture_id];
                            else next[match.fixture_id] = "";
                            return next;
                          })
                        }
                        className={`flex-none rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40 ${
                          chosen
                            ? "border-border text-muted-foreground"
                            : "border-primary/40 text-primary"
                        }`}
                      >
                        {taken ? "Feito" : chosen ? "Tirar" : "Juntar"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {shortlist.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  Sem jogos no quadro de probabilidades neste momento.
                </p>
              )}
            </div>

            {chosenLegs.length > 0 && (
              <div className="space-y-2 border-t border-border p-4">
                <div className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2.5">
                  <span className="sl-meta text-[11px]">
                    {chosenLegs.length === 1
                      ? "1 jogo"
                      : `${chosenLegs.length} jogos, odds multiplicadas`}
                  </span>
                  <span className="font-mono-data text-lg font-bold text-foreground">
                    {allPriced ? combinedOdd.toFixed(2) : "—"}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2">
                  <span className="sl-meta text-[11px]">Stake do plano</span>
                  <span className="font-mono-data text-sm font-bold text-foreground">
                    {eur.format(myStake)}
                  </span>
                </div>

                {hasOdds && (
                  <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--sl-green))]/30 bg-[hsl(var(--sl-green))]/5 px-3 py-2.5">
                    <span className="text-xs font-semibold text-foreground">
                      Banca se entrar tudo
                    </span>
                    <span className="font-mono-data text-sm font-bold text-[hsl(var(--sl-green))]">
                      {eur.format(me.bankroll + myStake * (combinedOdd - 1))}
                    </span>
                  </div>
                )}

                {!allPriced && (
                  <p className="sl-meta text-[11px]">
                    Falta meter a odd de cada jogo escolhido.
                  </p>
                )}

                {violations.map((violation) => (
                  <p
                    key={violation.code}
                    className={`text-[11px] leading-relaxed ${
                      violation.severity === "breach"
                        ? "text-destructive"
                        : "sl-meta"
                    }`}
                  >
                    {violation.message}
                  </p>
                ))}

                <Button
                  className="sl-btn-primary h-10 w-full text-xs disabled:opacity-40"
                  disabled={!hasOdds || saving}
                  onClick={place}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    `Registar aposta do dia ${me.day}`
                  )}
                </Button>
              </div>
            )}
          </motion.section>
        )}

        {ownsPlan && (
          <motion.div variants={fadeUp}>
            <PlanSettings
              plan={plan}
              onSaved={() => setToken((value) => value + 1)}
            />
          </motion.div>
        )}

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
                            : `${bet.legs[0]?.match ?? "—"} + ${
                                bet.legs.length - 1
                              }`}
                        </p>
                        <p className="sl-meta truncate text-[11px]">
                          Dia {bet.day} ·{" "}
                          {bet.legs.length === 1
                            ? MARKET_LABELS[bet.legs[0].market] ??
                              bet.legs[0].market
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

        {/* The plan reads like a schedule. It is a parlay, and a bankroll tool
            that hides that is not doing its job. */}
        <motion.section variants={fadeUp} className="sl-card overflow-hidden">
          <div className="border-b border-border px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-600" />O que a escada
              exige
            </h2>
          </div>
          <div className="space-y-2 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Cada degrau só conta se a aposta entrar, por isso o plano inteiro
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
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              O plano diz para seguir em frente sem dobrar a stake depois de uma
              perda, e parar um dia ao fim de três seguidas. Isso protege a
              banca, mas não devolve os degraus.
            </p>
          </div>
        </motion.section>

        <motion.div variants={fadeUp}>
          <CreatePlan onCreated={() => setToken((value) => value + 1)} />
        </motion.div>

        <motion.section variants={fadeUp} className="sl-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Trophy className="h-4 w-4 text-primary" />A escada
            </h2>
            <button
              type="button"
              onClick={() => navigate("/probability")}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary"
            >
              Ver todos os jogos
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border">
            {ladder.map((rung) => {
              const reached = me ? me.bankroll >= rung.bankrollStart : false;
              return (
                <div
                  key={rung.day}
                  className={`flex items-center gap-3 px-4 py-2 ${
                    reached ? "" : "opacity-60"
                  }`}
                >
                  <span className="font-mono-data w-8 flex-none text-xs text-muted-foreground">
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
      </motion.div>
    </AppLayout>
  );
}
