import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Clock, Plus, X } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BetDetailDialog } from "@/components/BetDetailDialog";
import { LooseComposer } from "@/components/LooseComposer";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { useToast } from "@/hooks/use-toast";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import { useAuth } from "@/contexts/AuthContext";
import type { BoardAccess } from "@/components/GamePicker";
import { buildPlayerStyle } from "@/lib/bettingStyle";
import { canonicalMarket } from "@/lib/marketNames";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  deleteLooseBet,
  fetchLooseBets,
  looseBetPayload,
  looseTotals,
  saveLooseBet,
  updateLooseBet,
  type LooseBet,
} from "@/lib/looseBets";
import {
  editBet,
  reopenBet,
  resettleBet,
  openFixtureRefs,
  setLegStatus,
  setRemainingLegs,
  settleFromScores,
  type PlanBetPayload,
  type PlanLeg,
} from "@/lib/planStore";
import {
  readCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";
import { fetchFixtureResults, finalScore } from "@/lib/resultsSync";
import { typingMemory } from "@/lib/typingMemory";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };

const signed = (value: number) =>
  `${value >= 0 ? "+" : ""}${eur.format(value)}`;

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const TONE = {
  green: "text-[hsl(var(--sl-green))]",
  red: "text-destructive",
  pending: "text-amber-700",
} as const;

function Row({ bet, onOpen }: { bet: LooseBet; onOpen: () => void }) {
  const Icon =
    bet.status === "green" ? Check : bet.status === "red" ? X : Clock;
  const names = bet.legs.map((leg) => leg.match).join(" + ");

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ver a aposta de ${when(bet.placedAt)}`}
      className="sl-tap flex w-full items-start gap-3 border-t border-border px-4 py-3 text-left first:border-t-0"
    >
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${TONE[bet.status]}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-foreground">
          {names || "Aposta"}
        </p>
        <p className="sl-meta truncate text-[11px]">
          {bet.legs
            .map(
              (leg) => MARKET_LABELS[leg.market] ?? canonicalMarket(leg.market),
            )
            .join(" · ")}
        </p>
        <p className="sl-meta text-[10px]">
          {eur.format(bet.stake)} @ {bet.odds.toFixed(2)} · {when(bet.placedAt)}
        </p>
      </div>

      {/* An arrow, because a return sitting in the same column as a profit
          and a loss invites them to be read as the same kind of number. */}
      <span className={`sl-figure flex-none text-[13px] ${TONE[bet.status]}`}>
        {bet.status === "pending"
          ? `→ ${eur.format(bet.stake * bet.odds)}`
          : signed(bet.profitLoss)}
      </span>
    </button>
  );
}

/**
 * Bets that answer to no challenge.
 *
 * Everything the app could record had to belong to a ladder, with a day and a
 * target, which is a lot of ceremony for "I put a tenner on two games". These
 * are the same bets, settled the same way and counted by the same analysis —
 * they simply have nowhere to climb.
 */
export default function LooseBets() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bets, setBets] = useState<LooseBet[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState<number | null>(null);
  const [openBet, setOpenBet] = useState<LooseBet | null>(null);
  const [board, setBoard] = useState<BoardMatch[]>([]);
  const [boardAt, setBoardAt] = useState<number | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const { allBets } = usePlanBoard();

  const load = useCallback(() => {
    fetchLooseBets()
      .then(setBets)
      .catch(() =>
        toast({
          title: "Não foi possível ler as apostas.",
          variant: "destructive",
        }),
      );
  }, [toast]);

  useEffect(load, [load]);

  // The games the challenge page already fetched. Asking again would spend one
  // of the ten requests a minute the provider allows on something already here.
  const loadBoard = useCallback((force: boolean) => {
    const cached = readCachedBoard(7);
    if (cached && !force) {
      setBoard(cached.matches);
      setBoardAt(cached.fetchedAt);
      setUnavailable(cached.unavailable ?? []);
      return;
    }

    setBoardLoading(true);
    fetch(buildApiUrl("/data/probability-board?days=7"))
      .then((response) => response.json())
      .then((data) => {
        setBoard(data.matches ?? []);
        setBoardAt(Date.now());
        setUnavailable(data.unavailable ?? []);
      })
      .catch(() => undefined)
      .finally(() => setBoardLoading(false));
  }, []);

  useEffect(() => loadBoard(false), [loadBoard]);

  const access = useMemo<BoardAccess>(
    () => ({
      board,
      boardAt,
      boardLoading,
      skipped: 0,
      unavailable,
      usedFixtures: new Set<number>(),
      onRefreshBoard: () => loadBoard(true),
    }),
    [board, boardAt, boardLoading, unavailable, loadBoard],
  );

  // Names already written, from the challenges as well as from here: it is the
  // same person typing the same teams.
  const memory = useMemo(
    () => typingMemory([...allBets, ...bets]),
    [allBets, bets],
  );

  // The same record, for the same reason: what this person's own bets on a
  // market have done belongs beside the price being taken, challenge or not.
  const style = useMemo(
    () =>
      user
        ? buildPlayerStyle(user.id, "Tu", [
            ...allBets.filter((bet) => bet.userId === user.id),
            ...bets.map((bet) => ({ ...bet, userId: user.id })),
          ])
        : null,
    [user, allBets, bets],
  );

  const totals = useMemo(() => looseTotals(bets), [bets]);

  /**
   * Bets close themselves off the final scores, game by game.
   *
   * Exactly as they do inside a challenge, and from the same provider: a game
   * whose market came in goes green, one that failed goes red, and the bet is
   * green only when every one of its games is. A game typed by hand has no
   * fixture to look up and no result to fetch, so those wait for their owner.
   */
  useEffect(() => {
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
          settled.map((entry) => updateLooseBet(entry.bet.id, entry.payload!)),
        );
        if (!cancelled) load();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [bets, load]);

  const place = useCallback(
    async (legs: PlanLeg[], odds: number, stake: number) => {
      if (!user) return;
      setSaving(true);
      try {
        await saveLooseBet(user.id, looseBetPayload(legs, odds, stake));
        setOpen(false);
        load();
        toast({ title: "Aposta registada." });
      } catch {
        toast({
          title: "Não foi possível registar a aposta.",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [user, load, toast],
  );

  /** Every correction ends the same way: write it, and keep both views on it. */
  const apply = useCallback(
    async (bet: LooseBet, payload: PlanBetPayload, failure: string) => {
      setSaving(true);
      try {
        await updateLooseBet(bet.id, payload);
        const updated = { ...payload, id: bet.id, userId: bet.userId };
        setBets((previous) =>
          previous.map((entry) => (entry.id === bet.id ? updated : entry)),
        );
        setOpenBet((current) =>
          current && current.id === bet.id ? updated : current,
        );
      } catch {
        toast({ title: failure, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  const markLeg = useCallback(
    async (bet: LooseBet, index: number, status: "green" | "red") => {
      setMarking(index);
      await apply(
        bet,
        setLegStatus(bet, index, status),
        "Não foi possível guardar esse jogo.",
      );
      setMarking(null);
    },
    [apply],
  );

  const remove = useCallback(
    async (bet: LooseBet) => {
      setSaving(true);
      try {
        await deleteLooseBet(bet.id);
        setBets((previous) => previous.filter((entry) => entry.id !== bet.id));
        setOpenBet(null);
      } catch {
        toast({
          title: "Não foi possível apagar a aposta.",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0 md:p-6 md:pt-0"
      >
        <motion.div variants={fadeUp}>
          <h1 className="sl-section-title text-[15px]">Apostas</h1>
          <p className="sl-meta mt-1 text-[11px]">
            As que não entram em nenhum desafio. Contam na análise na mesma.
          </p>
        </motion.div>

        {bets.length > 0 && (
          <motion.div
            variants={fadeUp}
            className="sl-card grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4"
          >
            {[
              { label: "Apostado", value: eur.format(totals.staked) },
              {
                label: "Lucro",
                value: signed(totals.profit),
                tint:
                  totals.profit > 0
                    ? "text-[hsl(var(--sl-green))]"
                    : totals.profit < 0
                      ? "text-destructive"
                      : "",
              },
              {
                label: "Acerto",
                value: totals.winPct === null ? "—" : `${totals.winPct}%`,
              },
              {
                label: "Em jogo",
                value: eur.format(totals.atRisk),
                tint: totals.atRisk > 0 ? "text-amber-700" : "",
              },
            ].map((cell) => (
              <div key={cell.label} className="bg-card px-3 py-3">
                <p className="sl-meta text-[10px] uppercase tracking-[0.1em]">
                  {cell.label}
                </p>
                <p
                  className={`sl-figure mt-0.5 text-[15px] ${cell.tint || "text-foreground"}`}
                >
                  {cell.value}
                </p>
              </div>
            ))}
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="sl-btn-primary sl-tap flex h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-semibold"
          >
            <Plus className="h-4 w-4" />
            Registar aposta
          </button>
        </motion.div>

        {bets.length === 0 && (
          <motion.p
            variants={fadeUp}
            className="sl-card px-4 py-4 text-[13px] leading-6 text-muted-foreground"
          >
            Ainda não há nenhuma. Uma aposta registada aqui não tem nível nem
            escada: é só o que jogaste, por quanto, e como correu.
          </motion.p>
        )}

        {bets.length > 0 && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            {bets.map((bet) => (
              <Row key={bet.id} bet={bet} onOpen={() => setOpenBet(bet)} />
            ))}
          </motion.section>
        )}

        {totals.atRisk > 0 && (
          <motion.p variants={fadeUp} className="sl-meta px-1 text-[11px]">
            {eur.format(totals.atRisk)} por decidir. Se entrar tudo, são{" "}
            {signed(totals.couldWin)}.
          </motion.p>
        )}
      </motion.div>

      <LooseComposer
        open={open}
        onOpenChange={setOpen}
        access={access}
        memory={memory}
        style={style}
        saving={saving}
        onPlace={place}
      />

      <BetDetailDialog
        bet={openBet}
        access={access}
        memory={memory}
        player=""
        mine
        marking={marking}
        saving={saving}
        onMarkLeg={markLeg}
        onMarkRest={(bet, status) =>
          apply(
            bet,
            setRemainingLegs(bet, status),
            "Não foi possível fechar os jogos.",
          )
        }
        onSaveEdits={(bet, legs, stake) =>
          apply(bet, editBet(bet, legs, stake), "Não foi possível guardar.")
        }
        onDelete={remove}
        onResettle={(bet, won) =>
          apply(
            bet,
            resettleBet(bet, won),
            "Não foi possível trocar o resultado.",
          )
        }
        onReopen={(bet) =>
          apply(bet, reopenBet(bet), "Não foi possível reabrir a aposta.")
        }
        onClose={() => setOpenBet(null)}
      />

    </AppLayout>
  );
}
