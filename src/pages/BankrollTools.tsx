import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Plus } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BankrollTrend } from "@/components/BankrollTrend";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import type { HomeChallenge } from "@/lib/homeBoard";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const fadeUp = { hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } };
const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } };

const signed = (value: number) =>
  `${value >= 0 ? "+" : ""}${eur.format(value)}`;

const days = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const tone = (value: number) =>
  value > 0
    ? "text-[hsl(var(--sl-green))]"
    : value < 0
      ? "text-destructive"
      : "text-foreground";

/**
 * How much money each challenge is holding.
 *
 * Magnitude, so one hue and no legend — the heading names it. The tick is
 * where the challenge started: a bar can be the longest on screen and still be
 * behind, and that is the thing worth seeing at a glance.
 */
function WhereTheMoneyIs({ rows }: { rows: HomeChallenge[] }) {
  const top = Math.max(
    ...rows.map((row) => Math.max(row.standing.bankroll, row.standing.startingBankroll)),
    1,
  );

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-foreground">
          Onde está a banca
        </h2>
        <p className="sl-meta text-[11px]">
          A marca em cada barra é onde esse desafio começou.
        </p>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {rows.map(({ plan, standing }) => {
          const width = (standing.bankroll / top) * 100;
          const start = (standing.startingBankroll / top) * 100;
          const moved = standing.bankroll - standing.startingBankroll;

          return (
            <div key={plan.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
                  {plan.name}
                </span>
                <span className="sl-figure flex-none text-[12px] text-foreground">
                  {eur.format(standing.bankroll)}
                </span>
              </div>

              <div
                className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-muted"
                title={`${plan.name}: ${eur.format(standing.bankroll)}, começou em ${eur.format(standing.startingBankroll)}`}
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(width, 2)}%` }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-foreground/45"
                  style={{ left: `${Math.min(start, 99.5)}%` }}
                />
              </div>

              <p className="sl-meta mt-1 text-[10px]">
                começou em {eur.format(standing.startingBankroll)} ·{" "}
                <span className={tone(moved)}>{signed(moved)}</span>
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * What the betting alone did to each challenge.
 *
 * Polarity, so the bars leave a middle line in the direction they went. Green
 * and red are only eight units apart for a deuteranope, which is why the side
 * of the line, the sign and the figure all say it too — the colour is the last
 * of four ways to read this, not the only one.
 */
function WhatEachOneDid({ rows }: { rows: HomeChallenge[] }) {
  const worst = Math.max(
    ...rows.map((row) => Math.abs(row.standing.profit)),
    1,
  );

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-[13px] font-semibold text-foreground">
          O que cada desafio deu
        </h2>
        <p className="sl-meta text-[11px]">
          Só as apostas. O dinheiro que puseste fica de fora desta conta.
        </p>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {rows.map(({ plan, standing }) => {
          const up = standing.profit >= 0;
          const half = (Math.abs(standing.profit) / worst) * 50;

          return (
            <div key={plan.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
                  {plan.name}
                </span>
                <span
                  className={`sl-figure flex-none text-[12px] ${tone(standing.profit)}`}
                >
                  {signed(standing.profit)}
                </span>
              </div>

              <div
                className="relative mt-1 h-2.5 rounded-full bg-muted"
                title={`${plan.name}: ${signed(standing.profit)} das apostas`}
              >
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                {standing.profit !== 0 && (
                  <div
                    className={`absolute inset-y-0 rounded-full ${
                      up ? "bg-[hsl(var(--sl-green))]" : "bg-destructive"
                    }`}
                    style={
                      up
                        ? { left: "calc(50% + 1px)", width: `${Math.max(half, 1)}%` }
                        : { right: "calc(50% + 1px)", width: `${Math.max(half, 1)}%` }
                    }
                  />
                )}
              </div>

              <p className="sl-meta mt-1 text-[10px]">
                {days(standing.greens, "ganho", "ganhos")} ·{" "}
                {days(standing.reds, "perdido", "perdidos")}
                {standing.added !== 0
                  ? ` · ${signed(standing.added)} postos à parte`
                  : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** What is riding on days nobody has closed yet. */
function AtRisk({ staked, could, bankroll }: {
  staked: number;
  could: number;
  bankroll: number;
}) {
  const share = bankroll > 0 ? Math.min((staked / bankroll) * 100, 100) : 0;

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Clock className="h-3.5 w-3.5 text-amber-700" />
        <h2 className="text-[13px] font-semibold text-foreground">
          O que está em jogo
        </h2>
      </div>

      <div className="px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="sl-figure text-[17px] text-foreground">
            {eur.format(staked)}
          </span>
          <span className="sl-meta text-[11px]">
            {share.toFixed(0)}% da banca
          </span>
        </div>

        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-amber-500"
            style={{ width: `${Math.max(share, 2)}%` }}
          />
        </div>

        <p className="sl-meta mt-2 text-[11px]">
          Se entrarem todos, a banca passa a{" "}
          <span className="sl-figure text-foreground">
            {eur.format(bankroll + could)}
          </span>
          .
        </p>
      </div>
    </section>
  );
}

/**
 * The money, and what moved it.
 *
 * The page that used to live here ran on the saved analyses — a store the
 * challenges never write to — so it showed a bankroll nobody recognised and
 * eleven panels of text about it. This is the same money the rest of the app
 * counts, drawn rather than described.
 */
export default function BankrollTools() {
  const { board, bets, started, loading } = usePlanBoard();

  const rows = board?.challenges ?? [];
  const staked = rows.reduce((sum, row) => sum + row.standing.openStake, 0);
  const could = rows.reduce(
    (sum, row) =>
      sum +
      row.standing.bets
        .filter((bet) => bet.status === "pending")
        .reduce((total, bet) => total + bet.stake * bet.odds - bet.stake, 0),
    0,
  );
  const added = rows.reduce((sum, row) => sum + row.standing.added, 0);

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0 md:p-6 md:pt-0"
      >
        <motion.div variants={fadeUp}>
          <h1 className="sl-section-title text-[15px]">Banca</h1>
          <p className="sl-meta mt-1 text-[11px]">
            Onde está o dinheiro, e o que o fez mexer.
          </p>
        </motion.div>

        {!loading && rows.length === 0 && (
          <motion.div
            variants={fadeUp}
            className="sl-card flex items-center gap-3 px-4 py-4"
          >
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/12">
              <Plus className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">
              A banca vive dentro dos desafios. Ainda não tens nenhum.
            </span>
            <Link
              to="/desafios"
              className="sl-btn-primary sl-tap flex h-10 flex-none items-center rounded-xl px-4 text-xs font-semibold"
            >
              Ver
            </Link>
          </motion.div>
        )}

        {rows.length > 0 && (
          <>
            <motion.div
              variants={fadeUp}
              className="sl-card grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4"
            >
              {[
                { label: "Banca somada", value: eur.format(board?.bankroll ?? 0) },
                { label: "Dinheiro posto", value: eur.format(started + added) },
                {
                  label: "Das apostas",
                  value: signed(board?.profit ?? 0),
                  tint: tone(board?.profit ?? 0),
                },
                {
                  label: "Em jogo agora",
                  value: eur.format(staked),
                  tint: staked > 0 ? "text-amber-700" : "",
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

            {bets.length > 0 && (
              <motion.div variants={fadeUp}>
                <BankrollTrend startingBankroll={started} bets={bets} />
              </motion.div>
            )}

            <motion.div variants={fadeUp}>
              <WhereTheMoneyIs rows={rows} />
            </motion.div>

            <motion.div variants={fadeUp}>
              <WhatEachOneDid rows={rows} />
            </motion.div>

            {staked > 0 && (
              <motion.div variants={fadeUp}>
                <AtRisk
                  staked={staked}
                  could={could}
                  bankroll={board?.bankroll ?? 0}
                />
              </motion.div>
            )}

            <motion.div variants={fadeUp}>
              <Link
                to="/dashboard/analises"
                className="sl-card sl-tap flex items-center gap-3 px-4 py-3"
              >
                <span className="sl-meta min-w-0 flex-1 text-[12px]">
                  O que as apostas dizem, por mercado, por odd e por dia da semana
                </span>
                <ArrowRight className="h-4 w-4 flex-none text-muted-foreground" />
              </Link>
            </motion.div>
          </>
        )}
      </motion.div>
    </AppLayout>
  );
}
