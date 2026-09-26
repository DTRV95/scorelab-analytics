import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { canonicalMarket } from "@/lib/marketNames";
import { BarLegend, StackedBar } from "@/components/StackedBar";
import { useAuth } from "@/contexts/AuthContext";
import {
  MIN_DECIDED,
  buildCombinedStyle,
  buildPlayerStyle,
  type PlayerStyle,
} from "@/lib/bettingStyle";
import {
  fetchPlanBets,
  fetchPlanMembers,
  fetchPlans,
  type PlanBet,
  type PlanMember,
} from "@/lib/planStore";

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

const LEGEND = [
  { tone: "good" as const, label: "Entrou" },
  { tone: "bad" as const, label: "Falhou" },
  { tone: "none" as const, label: "Por decidir" },
];

/** "4 entraram", "1 entrou · 1 falhou", "1 por decidir" — never "entrouram". */
function describeLegs(row: {
  backed: number;
  landed: number;
  failed: number;
  unknown: number;
}): string {
  const parts = [`${row.backed} ${row.backed === 1 ? "jogo" : "jogos"}`];
  if (row.landed > 0) {
    parts.push(`${row.landed} ${row.landed === 1 ? "entrou" : "entraram"}`);
  }
  if (row.failed > 0) {
    parts.push(`${row.failed} ${row.failed === 1 ? "falhou" : "falharam"}`);
  }
  if (row.unknown > 0) parts.push(`${row.unknown} por decidir`);
  return parts.join(" · ");
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-[hsl(var(--sl-surface))] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className={`sl-figure mt-0.5 text-[17px] ${tone ?? "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * What the numbers add up to, in a sentence.
 *
 * The charts below show everything; this says the one thing worth knowing
 * before reading them, and says nothing at all when there is not enough
 * behind it to be worth saying.
 */
function headline(style: PlayerStyle): string {
  if (style.bets === 0) return "Ainda não há apostas registadas.";

  const parts: string[] = [];

  if (style.favourite) {
    parts.push(
      `O mercado mais jogado é ${
        MARKET_LABELS[style.favourite.market] ?? canonicalMarket(style.favourite.market)
      }, ${style.favourite.backed} ${
        style.favourite.backed === 1 ? "vez" : "vezes"
      }.`
    );
  }

  if (style.sharpest && style.sharpest.hitPct !== null) {
    parts.push(
      `O que mais acerta é ${
        MARKET_LABELS[style.sharpest.market] ?? canonicalMarket(style.sharpest.market)
      }: ${style.sharpest.landed} de ${style.sharpest.landed + style.sharpest.failed}.`
    );
  } else {
    parts.push(
      `Ainda não há nenhum mercado com ${MIN_DECIDED} jogos decididos, que é o mínimo para a percentagem dizer alguma coisa.`
    );
  }

  const best = [...style.sizes]
    .filter((row) => row.winPct !== null && row.won + row.lost >= 2)
    .sort((a, b) => (b.winPct ?? 0) - (a.winPct ?? 0))[0];

  if (best) {
    parts.push(
      `Nas apostas de ${best.label.toLowerCase()}: ${best.won} ganhas em ${
        best.won + best.lost
      }.`
    );
  }

  return parts.join(" ");
}

export default function BettorAnalysis() {
  const { user } = useAuth();
  const [members, setMembers] = useState<PlanMember[]>([]);
  const [bets, setBets] = useState<PlanBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<string>("__all__");

  useEffect(() => {
    let cancelled = false;

    fetchPlans()
      .then(async (plans) => {
        const plan = plans[0];
        if (!plan) return { members: [], bets: [] };
        const [planMembers, planBets] = await Promise.all([
          fetchPlanMembers(plan.id),
          fetchPlanBets(plan.id),
        ]);
        return { members: planMembers, bets: planBets };
      })
      .then((data) => {
        if (cancelled) return;
        setMembers(data.members);
        setBets(data.bets);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível abrir a análise.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const style = useMemo(() => {
    if (who === "__all__") return buildCombinedStyle(bets);
    const member = members.find((item) => item.user_id === who);
    return buildPlayerStyle(who, member?.display_name ?? "Jogador", bets);
  }, [who, members, bets]);

  const topMarkets = style.markets.slice(0, 8);
  const widest = Math.max(1, ...topMarkets.map((row) => row.backed));

  if (loading) {
    return (
      <AppLayout>
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A ler as apostas...
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-3"
      >
        <motion.div variants={fadeUp}>
          <Link
            to="/desafios"
            className="sl-meta mb-1 inline-flex items-center gap-1.5 text-[11px]"
          >
            <ArrowLeft className="h-3 w-3" />
            Voltar ao desafio
          </Link>
          <h1 className="sl-section-title text-[15px]">Análise de apostador</h1>
        </motion.div>

        {members.length > 1 && (
          <motion.div variants={fadeUp} className="flex flex-wrap gap-1.5">
            {[{ user_id: "__all__", display_name: "Os dois" }, ...members].map(
              (member) => (
                <button
                  key={member.user_id}
                  type="button"
                  onClick={() => setWho(member.user_id)}
                  className={`sl-tap rounded-full px-3.5 py-2 text-[12px] font-semibold ${
                    who === member.user_id
                      ? "text-white [background:var(--sl-gradient)]"
                      : "bg-card text-muted-foreground ring-1 ring-border"
                  }`}
                >
                  {member.display_name}
                  {member.user_id === user?.id ? " · tu" : ""}
                </button>
              )
            )}
          </motion.div>
        )}

        <motion.section variants={fadeUp} className="sl-card p-4">
          <p className="text-[13px] leading-6 text-foreground">{headline(style)}</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Apostas" value={String(style.bets)} />
            <Stat
              label="Acerto"
              value={style.winPct === null ? "—" : `${style.winPct.toFixed(0)}%`}
            />
            <Stat
              label="Lucro"
              value={`${style.profit >= 0 ? "+" : ""}${eur.format(style.profit)}`}
              tone={
                style.profit > 0
                  ? "text-[hsl(var(--sl-green))]"
                  : style.profit < 0
                    ? "text-destructive"
                    : undefined
              }
            />
            <Stat label="Jogos por aposta" value={style.avgLegs.toFixed(1)} />
          </div>
        </motion.section>

        {topMarkets.length > 0 && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-bold text-foreground">
                Em que mercados apostam
              </h2>
              <p className="sl-meta mt-1 text-[11px]">
                Cada barra é um mercado, do mais jogado para o menos.
              </p>
              <div className="mt-2">
                <BarLegend items={LEGEND} />
              </div>
            </div>

            <div className="divide-y divide-border">
              {topMarkets.map((row) => (
                <div key={row.market} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                      {MARKET_LABELS[row.market] ?? canonicalMarket(row.market)}
                    </p>
                    <p className="sl-figure flex-none text-[13px] text-foreground">
                      {row.hitPct === null ? "—" : `${row.hitPct.toFixed(0)}%`}
                    </p>
                  </div>

                  {/* The bar is scaled against the most-backed market, so the
                      lengths compare across rows instead of each row filling
                      its own width. */}
                  <div className="mt-1.5" style={{ width: `${(row.backed / widest) * 100}%` }}>
                    <StackedBar
                      segments={[
                        { tone: "good", value: row.landed, label: "Entrou" },
                        { tone: "bad", value: row.failed, label: "Falhou" },
                        { tone: "none", value: row.unknown, label: "Por decidir" },
                      ]}
                    />
                  </div>

                  <p className="sl-meta mt-1.5 text-[11px]">
                    {describeLegs(row)}
                    {row.avgModelProb !== null
                      ? ` · o modelo dava ${row.avgModelProb.toFixed(0)}%`
                      : ""}
                  </p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {style.sizes.length > 0 && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="text-sm font-bold text-foreground">
                Quantos jogos por aposta
              </h2>
              <p className="sl-meta mt-1 text-[11px]">
                Juntar jogos multiplica a odd e multiplica as maneiras de perder.
              </p>
              <div className="mt-2">
                <BarLegend
                  items={[
                    { tone: "good", label: "Ganhas" },
                    { tone: "bad", label: "Perdidas" },
                    { tone: "none", label: "Abertas" },
                  ]}
                />
              </div>
            </div>

            <div className="divide-y divide-border">
              {style.sizes.map((row) => (
                <div key={row.legs} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[13px] font-semibold text-foreground">
                      {row.label}
                    </p>
                    <p className="sl-figure flex-none text-[13px] text-foreground">
                      {row.winPct === null ? "—" : `${row.winPct.toFixed(0)}%`}
                    </p>
                  </div>

                  <div className="mt-1.5">
                    <StackedBar
                      segments={[
                        { tone: "good", value: row.won, label: "Ganhas" },
                        { tone: "bad", value: row.lost, label: "Perdidas" },
                        { tone: "none", value: row.open, label: "Abertas" },
                      ]}
                    />
                  </div>

                  <p className="sl-meta mt-1.5 text-[11px]">
                    {row.bets} {row.bets === 1 ? "aposta" : "apostas"} ·{" "}
                    {row.won} {row.won === 1 ? "ganha" : "ganhas"} · {row.lost}{" "}
                    {row.lost === 1 ? "perdida" : "perdidas"}
                    {row.open > 0
                      ? ` · ${row.open} ${row.open === 1 ? "aberta" : "abertas"}`
                      : ""}{" "}
                    ·{" "}
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
                  </p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {style.undecided > 0 && (
          <motion.p variants={fadeUp} className="sl-meta px-1 text-[11px] leading-5">
            {style.undecided}{" "}
            {style.undecided === 1 ? "jogo está" : "jogos estão"} por decidir:
            ou a aposta ainda está em aberto, ou o dia foi dado como perdido sem
            se dizer qual dos jogos falhou. Ficam de fora das percentagens em vez
            de serem atribuídos a palpite — abre a aposta no desafio para dizeres
            como correu cada um.
          </motion.p>
        )}

        {error && (
          <motion.p variants={fadeUp} className="text-[11px] text-destructive">
            {error}
          </motion.p>
        )}
      </motion.div>
    </AppLayout>
  );
}
