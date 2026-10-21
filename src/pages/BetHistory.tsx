import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, Search } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { BetSlip } from "@/components/BetSlip";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import {
  buildHistory,
  byMonth,
  filterHistory,
  historyTotals,
  type Outcome,
} from "@/lib/betHistory";
import { fadeUp, stagger } from "@/lib/motion";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** Uma percentagem como se escreve em português, com vírgula. */
const pct = (value: number, casas = 0) =>
  `${value.toFixed(casas).replace(".", ",")}%`;

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "ganhas", label: "Ganhas" },
  { key: "perdidas", label: "Perdidas" },
  { key: "abertas", label: "Em aberto" },
];

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">{label}</p>
      <p
        className={`sl-figure truncate text-[18px] leading-6 ${
          tone === "good"
            ? "text-[hsl(var(--sl-green))]"
            : tone === "bad"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Tudo o que esta pessoa apostou nos desafios, num sítio só.
 *
 * Cada desafio mostrava as suas apostas e mais nada, e os terminados estão
 * atrás de uma prateleira própria — por isso, na prática, o que se fez no
 * mês passado não se via. O registo existia inteiro na base de dados e não
 * existia em lado nenhum no ecrã.
 *
 * Os totais no topo são os da lista que está a ser vista, e não os do
 * registo inteiro: filtrada por equipa ou por desafio, a soma responde a
 * "e nisto, como é que me tenho saído?", que é a pergunta por que se filtra.
 */
export default function BetHistory() {
  const { user } = useAuth();
  const { bets, plans, loading } = usePlanBoard();
  const [outcome, setOutcome] = useState<Outcome>("todas");
  const [planId, setPlanId] = useState<string | null>(null);
  const [text, setText] = useState("");

  const history = useMemo(() => buildHistory(bets, plans), [bets, plans]);
  const shown = useMemo(
    () => filterHistory(history, { planId, outcome, text }),
    [history, planId, outcome, text],
  );
  const totals = useMemo(() => historyTotals(shown), [shown]);
  const months = useMemo(() => byMonth(shown), [shown]);

  // Só os desafios onde esta pessoa tem mesmo apostas: um filtro que não
  // filtra nada é uma pastilha a ocupar a linha.
  const mine = useMemo(() => {
    const used = new Set(history.map((entry) => entry.bet.planId));
    return plans.filter((plan) => used.has(plan.id));
  }, [history, plans]);

  const empty = !loading && history.length === 0;

  return (
    <AppLayout>
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        <motion.header variants={fadeUp}>
          <h1 className="sl-section-title text-[15px]">Histórico</h1>
          <p className="sl-meta mt-1 text-xs leading-5">
            Tudo o que apostaste nos desafios, do mais recente para trás —
            incluindo os que já acabaram.
          </p>
        </motion.header>

        {empty ? (
          <motion.div variants={fadeUp} className="sl-card px-4 py-8 text-center">
            <History className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm font-bold text-foreground">
              Ainda não há nada para mostrar
            </p>
            <p className="sl-meta mx-auto mt-1 max-w-[34ch] text-xs leading-5">
              As apostas que registares nos desafios ficam aqui, e continuam
              cá depois de o desafio acabar.
            </p>
          </motion.div>
        ) : (
          <>
            <motion.section
              variants={fadeUp}
              className="sl-card flex items-end gap-3 px-4 py-3"
            >
              <Figure label="Apostas" value={String(totals.bets)} />
              <Figure
                label="Acerto"
                value={totals.winPct === null ? "—" : pct(totals.winPct)}
              />
              <Figure
                label="Lucro"
                value={`${totals.profit >= 0 ? "+" : ""}${eur.format(
                  totals.profit,
                )}`}
                tone={totals.profit >= 0 ? "good" : "bad"}
              />
              {/* "Retorno" e não "por euro": ao lado de uma percentagem,
                  "por euro" faz parecer que são 15% de cada euro e não o
                  que a aposta toda devolveu. */}
              <Figure
                label="Retorno"
                // A casa decimal só enquanto couber e disser alguma coisa:
                // entre 0,7% e 1% vai uma decisão, entre 100% e 100,0% não
                // vai nada — e "-100,0%" não cabe na coluna.
                value={
                  totals.roi === null
                    ? "—"
                    : pct(totals.roi, Math.abs(totals.roi) < 10 ? 1 : 0)
                }
                tone={
                  totals.roi === null
                    ? undefined
                    : totals.roi >= 0
                      ? "good"
                      : "bad"
                }
              />
            </motion.section>

            <motion.div variants={fadeUp} className="space-y-2">
              <label className="sl-field flex items-center gap-2 px-3">
                <Search className="h-4 w-4 flex-none text-muted-foreground" />
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Equipa, mercado, competição…"
                  aria-label="Procurar no histórico"
                  className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </label>

              <div className="sl-scroll-x flex gap-1.5">
                {OUTCOMES.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => setOutcome(entry.key)}
                    aria-pressed={outcome === entry.key}
                    className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      outcome === entry.key
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              {mine.length > 1 && (
                <div className="sl-scroll-x flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPlanId(null)}
                    aria-pressed={planId === null}
                    className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      planId === null
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todos os desafios
                  </button>
                  {mine.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setPlanId(plan.id)}
                      aria-pressed={planId === plan.id}
                      className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        planId === plan.id
                          ? "bg-foreground text-background"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {plan.name}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>

            {shown.length === 0 ? (
              <motion.p
                variants={fadeUp}
                className="sl-card px-4 py-6 text-center text-xs text-muted-foreground"
              >
                Nenhuma aposta corresponde a isto.
              </motion.p>
            ) : (
              months.map((month) => (
                <motion.section
                  key={month.label}
                  variants={fadeUp}
                  className="space-y-2"
                >
                  <h2 className="sl-meta px-0.5 text-[10px] uppercase tracking-[0.16em]">
                    {month.label} · {month.entries.length}
                  </h2>
                  {month.entries.map((entry) => (
                    <BetSlip
                      key={`${entry.bet.planId}-${entry.bet.id}`}
                      bet={entry.bet}
                      // O desafio e o nível, porque fora da página do
                      // desafio uma aposta sozinha não diz de onde vem.
                      above={`${entry.plan} · Nível ${entry.bet.day}${
                        entry.ended ? " · terminado" : ""
                      }`}
                    />
                  ))}
                </motion.section>
              ))
            )}
          </>
        )}

        {user && loading && (
          <motion.p variants={fadeUp} className="sl-meta text-xs">
            A carregar…
          </motion.p>
        )}
      </motion.div>
    </AppLayout>
  );
}
