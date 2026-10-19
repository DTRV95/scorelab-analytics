import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Ticket, Trash2, X } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { useMaybeAuth } from "@/contexts/AuthContext";
import { useMaybePlanBoard } from "@/hooks/usePlanBoard";
import { draftSlip, useDraftSlip } from "@/hooks/useDraftSlip";
import { isPriced, slipOdds, toOdds } from "@/lib/draftSlip";
import {
  checkBet,
  ladderFor,
  parseRules,
  stakeForDay,
} from "@/lib/challengeRules";
import { spring } from "@/lib/motion";
import {
  betsPlacedToday,
  savePlanBet,
  type PlanLeg,
} from "@/lib/planStore";
import { toast } from "@/hooks/use-toast";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/**
 * O boletim que anda com a pessoa.
 *
 * Fica por cima de todas as páginas, como o da Betano: escolhe-se um jogo na
 * lista das probabilidades e ele aparece aqui em baixo, com a conta feita e
 * o botão de registar. Continua lá na página seguinte, porque uma aposta
 * combinada precisa de mais do que uma página para se montar.
 *
 * Fechado é uma barra: quantos jogos, a odd, e o que se ganha. Aberto é o
 * boletim inteiro, com o preço de cada perna por escrever e o que o desafio
 * tem a dizer sobre a aposta antes de ela ir.
 */
export function DraftSlipBar() {
  const slip = useDraftSlip();
  const planBoard = useMaybePlanBoard();
  const user = useMaybeAuth()?.user ?? null;
  const [aberto, setAberto] = useState(false);
  const [aGuardar, setAGuardar] = useState(false);

  const entry = useMemo(() => {
    if (!slip.planId) return null;
    return (
      (planBoard?.board?.challenges ?? []).find(
        (candidate) => candidate.plan.id === slip.planId,
      ) ?? null
    );
  }, [planBoard, slip.planId]);

  const conta = useMemo(() => {
    if (!entry) return null;
    const rules = parseRules(entry.plan.rules, entry.plan.days);
    const ladder = ladderFor(rules, Number(entry.plan.starting_bankroll));
    const pedido = stakeForDay(
      ladder,
      entry.standing.day,
      entry.standing.bankroll,
    );
    return { rules, pedido };
  }, [entry]);

  const odds = slipOdds(slip);
  const pedido = conta?.pedido ?? 0;
  const stake =
    slip.stake === null
      ? pedido
      : Math.max(0, Number(slip.stake.replace(",", ".")) || 0);

  const pronto = Boolean(entry) && isPriced(slip) && odds > 1 && stake > 0;

  const breach = useMemo(() => {
    if (!pronto || !conta || !entry) return null;
    return (
      checkBet(conta.rules, {
        odds,
        stake,
        bankroll: entry.standing.bankroll,
        day: entry.standing.day,
        betsPlacedToday: betsPlacedToday(entry.standing),
        lossStreak: entry.standing.lossStreak,
        openBets: entry.standing.openBets,
        plannedStake: conta.pedido,
      }).find((violation) => violation.severity === "breach") ?? null
    );
  }, [pronto, conta, entry, odds, stake]);

  if (slip.legs.length === 0) return null;

  const registar = async () => {
    if (!pronto || !entry || !user || aGuardar) return;
    setAGuardar(true);
    try {
      const legs: PlanLeg[] = slip.legs.map((leg) => ({
        match: `${leg.homeTeam} vs ${leg.awayTeam}`,
        homeTeam: leg.homeTeam,
        awayTeam: leg.awayTeam,
        league: leg.league,
        market: leg.market,
        odds: toOdds(leg.odds),
        modelProb: leg.modelProb,
        fixtureId: leg.fixtureId,
        kickoff: leg.kickoff,
        status: "pending",
      }));

      await savePlanBet(entry.plan.id, user.id, {
        legs,
        odds,
        stake,
        day: entry.standing.day,
        status: "pending",
        profitLoss: 0,
        placedAt: new Date().toISOString(),
        settledAt: null,
      });

      toast({
        title: `Nível ${entry.standing.day} registado`,
        description: `${
          legs.length === 1 ? "1 jogo" : `${legs.length} jogos`
        } @ ${odds.toFixed(2)} · ${eur.format(stake)}`,
      });

      draftSlip.clear();
      setAberto(false);
    } catch {
      toast({
        variant: "destructive",
        title: "A aposta não ficou guardada",
        description: "Tenta outra vez.",
      });
    } finally {
      setAGuardar(false);
    }
  };

  const titulo = entry
    ? `${entry.plan.name} · Nível ${entry.standing.day}`
    : "Desafio não encontrado";

  return (
    // Acima do rodapé no telemóvel, ao canto no computador. As 7rem são
    // medidas e não arredondadas: o botão Início sobe para fora da barra
    // e o topo do anel dele fica a 93px do fundo, por isso qualquer coisa
    // mais baixa do que isto encosta-lhe.
    //
    // A tira à volta deixa passar os toques, para a página por baixo
    // continuar a ser tocável onde o boletim não está.
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(7rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-5 lg:px-5">
      <div className="pointer-events-auto mx-auto w-full max-w-md overflow-hidden rounded-[22px] bg-[hsl(var(--sl-nav))] text-white shadow-[0_18px_40px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10 lg:ml-auto lg:mr-0">
        <AnimatePresence initial={false}>
          {aberto && (
            <motion.div
              key="aberto"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={spring}
              className="overflow-hidden"
            >
              <div className="max-h-[45vh] overflow-y-auto">
                {slip.legs.map((leg) => (
                  <div
                    key={leg.key}
                    className="flex items-center gap-2.5 border-b border-white/[0.07] px-3.5 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">
                        {leg.homeTeam} vs {leg.awayTeam}
                      </p>
                      <p className="truncate text-[11px] text-white/55">
                        {MARKET_LABELS[leg.market] ?? leg.market}
                        {leg.modelProb > 0 &&
                          ` · modelo ${leg.modelProb.toFixed(0)}%`}
                      </p>
                    </div>
                    <input
                      inputMode="decimal"
                      value={leg.odds}
                      placeholder="odd"
                      aria-label={`Odd de ${leg.homeTeam} vs ${leg.awayTeam}`}
                      onChange={(event) =>
                        draftSlip.setOdds(leg.key, event.target.value)
                      }
                      className="font-mono-data h-9 w-[66px] flex-none rounded-xl border-0 bg-white/10 px-2 text-center text-[14px] font-bold text-white placeholder:font-sans placeholder:text-[11px] placeholder:font-normal placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
                    />
                    <button
                      type="button"
                      aria-label={`Tirar ${leg.homeTeam} vs ${leg.awayTeam} do boletim`}
                      onClick={() => draftSlip.remove(leg.key)}
                      className="sl-tap flex h-8 w-8 flex-none items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-end gap-3 px-3.5 py-3">
                <label className="min-w-0 flex-1">
                  <span className="block text-[10px] uppercase tracking-[0.13em] text-white/45">
                    A apostar
                  </span>
                  <div className="flex items-baseline gap-0.5">
                    <input
                      inputMode="decimal"
                      // Vírgula, como em todo o resto do ecrã: o 7,50 fica
                      // ao lado de um "27,75 €" e um ponto ali lê-se como
                      // outra moeda.
                      value={slip.stake ?? pedido.toFixed(2).replace(".", ",")}
                      aria-label="Valor a apostar"
                      onChange={(event) =>
                        draftSlip.setStake(event.target.value)
                      }
                      className="font-mono-data w-[54px] min-w-0 bg-transparent text-[16px] font-bold text-white focus:outline-none"
                    />
                    <span className="font-mono-data text-[13px] font-bold text-white/55">
                      €
                    </span>
                  </div>
                </label>
                <div className="flex-none text-right">
                  <span className="block text-[10px] uppercase tracking-[0.13em] text-white/45">
                    Se entrar
                  </span>
                  <span className="font-mono-data text-[16px] font-bold text-[hsl(var(--sl-green))]">
                    {odds > 1 ? eur.format(stake * odds) : "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => draftSlip.clear()}
                  aria-label="Limpar o boletim"
                  className="sl-tap flex h-9 w-9 flex-none items-center justify-center rounded-xl text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* O que o desafio tem a dizer, dito antes de a aposta ir e
                  não depois. É uma linha porque a regra inteira está na
                  página do desafio; aqui só interessa que há uma. */}
              {breach && (
                <p className="border-t border-white/[0.07] px-3.5 py-2 text-[11.5px] font-semibold text-[hsl(22_100%_68%)]">
                  {breach.message}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <button
            type="button"
            onClick={() => setAberto((open) => !open)}
            aria-expanded={aberto}
            className="sl-tap flex min-w-0 flex-1 items-center gap-2.5 text-left"
          >
            <span className="relative flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-white/10">
              <Ticket className="h-[18px] w-[18px]" />
              <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {slip.legs.length}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold">
                {titulo}
              </span>
              <span className="font-mono-data block text-[11px] text-white/55">
                {odds > 1 ? `odd ${odds.toFixed(2)}` : "falta o preço"}
                {" · "}
                {eur.format(stake)}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 flex-none text-white/45 transition-transform ${
                aberto ? "" : "rotate-180"
              }`}
            />
          </button>

          <Button
            size="sm"
            disabled={!pronto || !user || aGuardar}
            onClick={registar}
            className="h-9 flex-none rounded-xl px-4 text-[12.5px] font-bold"
          >
            {aGuardar ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Registar"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
