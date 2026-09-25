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
  checkBet,
  costOfOneLoss,
  plannedStake,
  rungForBankroll,
  stakePctForDay,
} from "@/lib/millionPlan";
import {
  betsPlacedToday,
  buildStanding,
  fetchPlan,
  fetchPlanBets,
  savePlanBet,
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

  const [plan, setPlan] = useState<PlanRecord | null>(null);
  const [members, setMembers] = useState<PlanMember[]>([]);
  const [bets, setBets] = useState<PlanBet[]>([]);
  const [board, setBoard] = useState<BoardMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<BoardMatch | null>(null);
  const [odds, setOdds] = useState("");
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const found = await fetchPlan();
      if (!found) {
        if (!cancelled) setError("Ainda não há nenhum plano criado nesta conta.");
        return;
      }
      const planBets = await fetchPlanBets(found.plan.id);
      if (cancelled) return;
      setPlan(found.plan);
      setMembers(found.members);
      setBets(planBets);
    })()
      .catch(() => {
        if (!cancelled) {
          setError("Não foi possível abrir o plano. Tenta novamente daqui a pouco.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

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
    () => new Set(me?.bets.map((bet) => bet.fixture?.id).filter(Boolean)),
    [me]
  );

  const oddsValue = Number(odds.replace(",", "."));
  const hasOdds = Number.isFinite(oddsValue) && oddsValue > 1;
  const myStake = me ? plannedStake(me.bankroll, me.day) : 0;
  const violations = useMemo(() => {
    if (!me || !picking || !hasOdds) return [];
    return checkBet({
      odds: oddsValue,
      stake: myStake,
      bankroll: me.bankroll,
      day: me.day,
      betsPlacedToday: betsPlacedToday(me),
      lossStreak: me.lossStreak,
    });
  }, [me, picking, hasOdds, oddsValue, myStake]);

  const place = useCallback(async () => {
    if (!plan || !me || !picking || !hasOdds || !user) return;
    setSaving(true);
    try {
      const saved = await savePlanBet(plan.id, user.id, {
        match: `${picking.home_name} vs ${picking.away_name}`,
        homeTeam: picking.home_name,
        awayTeam: picking.away_name,
        league: picking.league,
        market: picking.headline_market,
        odds: oddsValue,
        stake: myStake,
        modelProb: picking.headline_pct,
        day: me.day,
        status: "pending",
        profitLoss: 0,
        placedAt: new Date().toISOString(),
        settledAt: null,
        fixture: {
          id: picking.fixture_id,
          league: picking.league,
          kickoff: picking.kickoff,
        },
      });
      setBets((previous) => [...previous, saved]);
      setPicking(null);
      setOdds("");
    } catch {
      setError("A aposta não ficou guardada. Tenta outra vez.");
    } finally {
      setSaving(false);
    }
  }, [plan, me, picking, hasOdds, user, oddsValue, myStake]);

  if (loading) {
    return (
      <AppLayout>
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A abrir o plano...
        </p>
      </AppLayout>
    );
  }

  if (error && !plan) {
    return (
      <AppLayout>
        <p className="py-12 text-center text-sm text-muted-foreground">{error}</p>
      </AppLayout>
    );
  }

  const chance = me ? chanceOfCompleting(me.day) : chanceOfCompleting(1);
  const loss = me ? costOfOneLoss(me.bankroll, me.day, ladder) : null;
  const progress = Math.min(100, (combined / PLAN_TARGET) * 100);

  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="sl-section-title text-[15px]">
              {plan?.name ?? "Plano Milhão"}
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {PLAN_DAYS} dias, uma aposta por dia cada um, a ganhar sempre
              sobre o que o dia anterior deixou.
            </p>
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
                const isPicking = picking?.fixture_id === match.fixture_id;

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
                      <button
                        type="button"
                        disabled={taken}
                        onClick={() => {
                          setPicking(isPicking ? null : match);
                          setOdds("");
                        }}
                        className="flex-none rounded-lg border border-primary/40 px-2.5 py-1.5 text-[11px] font-semibold text-primary disabled:opacity-40"
                      >
                        {taken ? "Escolhido" : isPicking ? "Fechar" : "Escolher"}
                      </button>
                    </div>

                    {isPicking && (
                      <div className="mt-3 space-y-2 rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-3">
                        <label className="block">
                          <span className="sl-meta text-[11px]">
                            Odd da tua casa
                          </span>
                          <input
                            inputMode="decimal"
                            value={odds}
                            onChange={(event) => setOdds(event.target.value)}
                            placeholder="1.85"
                            className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 font-mono-data text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </label>

                        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                          <span className="sl-meta text-[11px]">
                            Stake do plano
                          </span>
                          <span className="font-mono-data text-sm font-bold text-foreground">
                            {eur.format(myStake)}
                          </span>
                        </div>

                        {hasOdds && (
                          <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--sl-green))]/30 bg-[hsl(var(--sl-green))]/5 px-3 py-2">
                            <span className="text-xs font-semibold text-foreground">
                              Banca se entrar
                            </span>
                            <span className="font-mono-data text-sm font-bold text-[hsl(var(--sl-green))]">
                              {eur.format(
                                me.bankroll + myStake * (oddsValue - 1)
                              )}
                            </span>
                          </div>
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
                  </div>
                );
              })}

              {shortlist.length === 0 && (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  Sem jogos no quadro de probabilidades neste momento.
                </p>
              )}
            </div>
          </motion.section>
        )}

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
                          {bet.match}
                        </p>
                        <p className="sl-meta truncate text-[11px]">
                          Dia {bet.day} ·{" "}
                          {MARKET_LABELS[bet.market] ?? bet.market} @{" "}
                          {bet.odds.toFixed(2)}
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
