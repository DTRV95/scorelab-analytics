import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Info } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { useAuth } from "@/contexts/AuthContext";
import { byOddsBand, byWeekday, summarise, type Band } from "@/lib/betAnalytics";
import { buildPlayerStyle, MIN_DECIDED } from "@/lib/bettingStyle";
import { canonicalMarket } from "@/lib/marketNames";
import {
  fetchBetsOfPlans,
  fetchPlans,
  type PlanBet,
} from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };

interface BarRow {
  label: string;
  /** What the bar is long by, 0 to 100. Null when there is not enough to say. */
  pct: number | null;
  /** The count behind it, which is what stops a percentage from lying. */
  detail: string;
  profit: number;
}

/**
 * One measure across a handful of categories.
 *
 * Horizontal bars, one hue: this is magnitude, not identity, so nothing here
 * needs a second colour or a legend. Every bar carries the count it came from,
 * because "100%" off two games is the kind of number that starts an argument.
 */
function Bars({
  title,
  hint,
  rows,
}: {
  title: string;
  hint: string;
  rows: BarRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        <p className="sl-meta text-[11px]">{hint}</p>
      </div>

      <div className="space-y-2.5 px-4 py-3.5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
                {row.label}
              </span>
              <span className="sl-meta flex-none text-[11px]">
                {row.detail} ·{" "}
                <span
                  className={
                    row.profit > 0
                      ? "text-[hsl(var(--sl-green))]"
                      : row.profit < 0
                        ? "text-destructive"
                        : ""
                  }
                >
                  {row.profit >= 0 ? "+" : ""}
                  {eur.format(row.profit)}
                </span>
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                {row.pct !== null && (
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(row.pct, 2)}%` }}
                  />
                )}
              </div>
              <span className="sl-figure w-10 flex-none text-right text-[11px] text-muted-foreground">
                {row.pct === null ? "—" : `${row.pct}%`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const fromBands = (bands: Band[]): BarRow[] =>
  bands.map((row) => ({
    label: row.label,
    pct: row.winPct,
    detail: `${row.won} de ${row.won + row.lost} · ${eur.format(row.staked)}`,
    profit: row.profit,
  }));

/**
 * What the bets add up to.
 *
 * The page that used to live here drew charts from a store nothing in this app
 * ever wrote to. These come from the bets themselves: by market, by how many
 * games went on the slip, by the price taken, and by the day of the week.
 */
export default function Analyses() {
  const { user } = useAuth();
  const [bets, setBets] = useState<PlanBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    fetchPlans()
      .then((plans) => fetchBetsOfPlans(plans.map((plan) => plan.id)))
      .then((placed) => {
        if (!cancelled) setBets(placed.filter((bet) => bet.userId === user.id));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const summary = useMemo(() => summarise(bets), [bets]);
  // Only this person's own record, by construction: the id goes in, rather
  // than every bet being relabelled as theirs on the way.
  const style = useMemo(
    () => buildPlayerStyle(user?.id ?? "", "", bets),
    [user?.id, bets],
  );

  const markets = useMemo<BarRow[]>(
    () =>
      style.markets
        .filter((row) => row.landed + row.failed > 0)
        .sort((a, b) => b.landed + b.failed - (a.landed + a.failed))
        .slice(0, 8)
        .map((row) => ({
          label: MARKET_LABELS[row.market] ?? canonicalMarket(row.market),
          pct: row.landed + row.failed >= MIN_DECIDED ? Math.round(row.hitPct ?? 0) : null,
          detail: `${row.landed} de ${row.landed + row.failed}`,
          profit: 0,
        })),
    [style],
  );

  const sizes = useMemo<BarRow[]>(
    () =>
      style.sizes.map((row) => {
        const staked = bets
          .filter(
            (bet) =>
              bet.status !== "pending" &&
              (row.legs === 4
                ? bet.legs.length >= 4
                : bet.legs.length === row.legs),
          )
          .reduce((sum, bet) => sum + bet.stake, 0);

        return {
          label: row.label,
          pct:
            row.won + row.lost >= MIN_DECIDED
              ? Math.round(row.winPct ?? 0)
              : null,
          detail: `${row.won} de ${row.won + row.lost} · ${eur.format(staked)}`,
          profit: row.profit,
        };
      }),
    [style, bets],
  );

  const odds = useMemo(() => fromBands(byOddsBand(bets)), [bets]);
  const days = useMemo(() => fromBands(byWeekday(bets)), [bets]);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3 p-4 sm:p-5 md:p-6"
      >
        <motion.div variants={fadeUp} className="flex items-start gap-3">
          <Link
            to="/dashboard"
            className="sl-tap mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border"
            aria-label="Voltar ao início"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="sl-section-title text-[15px]">Análises</h1>
            <p className="sl-meta mt-0.5 text-[11px]">
              O que as tuas apostas dizem, vistas de vários lados.
            </p>
          </div>
        </motion.div>

        {!loading && bets.length === 0 && (
          <motion.p
            variants={fadeUp}
            className="sl-card px-4 py-4 text-sm text-muted-foreground"
          >
            Ainda não há apostas para analisar. Regista a primeira num desafio e
            isto enche-se sozinho.
          </motion.p>
        )}

        {bets.length > 0 && (
          <>
            <motion.div
              variants={fadeUp}
              className="sl-card grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-5"
            >
              {[
                { label: "Apostas", value: `${summary.bets}` },
                { label: "Apostado", value: eur.format(summary.staked) },
                {
                  label: "Acerto",
                  value:
                    summary.winPct === null ? "—" : `${summary.winPct}%`,
                },
                {
                  label: "Das apostas",
                  value: `${summary.profit >= 0 ? "+" : ""}${eur.format(summary.profit)}`,
                  tone:
                    summary.profit > 0
                      ? "text-[hsl(var(--sl-green))]"
                      : summary.profit < 0
                        ? "text-destructive"
                        : "",
                },
                {
                  label: "Por euro apostado",
                  value: summary.roi === null ? "—" : `${summary.roi > 0 ? "+" : ""}${summary.roi}%`,
                  tone:
                    (summary.roi ?? 0) > 0
                      ? "text-[hsl(var(--sl-green))]"
                      : (summary.roi ?? 0) < 0
                        ? "text-destructive"
                        : "",
                },
              ].map((cell) => (
                <div key={cell.label} className="bg-card px-3 py-3">
                  <p className="sl-meta text-[10px] uppercase tracking-[0.1em]">
                    {cell.label}
                  </p>
                  <p className={`sl-figure mt-0.5 text-[15px] ${cell.tone ?? "text-foreground"}`}>
                    {cell.value}
                  </p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={fadeUp}>
              <Bars
                title="Por mercado"
                hint="Quantas vezes entrou cada aposta que costumas fazer. Sem valor apostado: a aposta é do boletim inteiro, não de cada jogo."
                rows={markets}
              />
            </motion.div>

            <motion.div variants={fadeUp}>
              <Bars
                title="Por jogos no boletim"
                hint="Um jogo ou vários: onde é que os teus dias se ganham"
                rows={sizes}
              />
            </motion.div>

            <motion.div variants={fadeUp}>
              <Bars
                title="Por odd"
                hint="As curtas estão a carregar isto, ou as longas?"
                rows={odds}
              />
            </motion.div>

            <motion.div variants={fadeUp}>
              <Bars
                title="Por dia da semana"
                hint="Quando é que apostas melhor"
                rows={days}
              />
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="sl-meta flex items-start gap-1.5 px-1 text-[11px] leading-5"
            >
              <Info className="mt-0.5 h-3 w-3 flex-none" />
              Uma percentagem só aparece com pelo menos {MIN_DECIDED} dias
              decididos. Abaixo disso fica um traço — o número existiria, mas
              não queria dizer nada.
            </motion.p>
          </>
        )}
      </motion.div>
    </AppLayout>
  );
}
