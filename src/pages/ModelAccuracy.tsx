import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Target } from "lucide-react";
import {
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  bandVerdict,
  fetchAccuracyReport,
  type AccuracyBand,
  type AccuracyReport,
} from "@/lib/modelAccuracy";

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const BAND_TONE: Record<ReturnType<typeof bandVerdict>, string> = {
  sharp: "sl-pill-win",
  over: "sl-pill-loss",
  under: "sl-pill-open",
  thin: "sl-pill-muted",
};

const BAND_LABEL: Record<ReturnType<typeof bandVerdict>, string> = {
  sharp: "Certeiro",
  over: "Confiante a mais",
  under: "Confiante a menos",
  thin: "Poucos jogos",
};

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="sl-card px-4 py-3.5">
      <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">{label}</p>
      <p className="mt-2 font-mono-data text-[1.4rem] font-bold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{detail}</p>
    </div>
  );
}

/**
 * What the model said would happen, against what happened.
 *
 * The chart is a calibration curve, which is the only honest way to read a
 * probability engine: a forecast of 70% is not "right" or "wrong" on one
 * match, it is right when seven of every ten such matches land. The diagonal
 * is a model that means exactly what it says; below it, it is overconfident.
 */
function CalibrationChart({ bands }: { bands: AccuracyBand[] }) {
  const rows = bands
    .filter((band) => band.samples >= 10)
    .map((band) => ({
      bucket: band.bucket.replace("%", ""),
      disse: band.predicted_pct,
      aconteceu: band.actual_pct,
    }));

  if (rows.length < 2) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ainda não há bandas com jogos suficientes para desenhar a curva.
      </p>
    );
  }

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            wrapperClassName="scorelab-chart-tooltip"
            formatter={(value: number, name: string) => [`${value}%`, name]}
          />
          <Line
            type="monotone"
            dataKey="disse"
            name="O modelo disse"
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="aconteceu"
            name="Aconteceu"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ModelAccuracy() {
  const [leagues, setLeagues] = useState<string[]>([]);
  const [report, setReport] = useState<AccuracyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(buildApiUrl("/data/status"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setLeagues(data?.leagues ?? []);
      })
      .catch(() => {
        if (!cancelled) setLeagues([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (leagues.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAccuracyReport(leagues)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Não foi possível medir o acerto agora. A fonte de dados não respondeu."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leagues, token]);

  const worst = useMemo(
    () =>
      report
        ? [...report.markets]
            .filter((row) => row.samples >= 30)
            .sort((a, b) => Math.abs(b.gap_pp) - Math.abs(a.gap_pp))
            .slice(0, 5)
        : [],
    [report]
  );

  const headlineGap = report
    ? report.headline.actual_pct - report.headline.predicted_pct
    : 0;

  return (
    <AppLayout>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="space-y-4"
      >
        <motion.div variants={fadeUp} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="sl-section-title text-[15px]">Acerto do modelo</h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Cada jogo já disputado é previsto outra vez com o que se sabia
              antes do apito inicial, e comparado com o resultado real.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-none rounded-lg text-muted-foreground"
            title="Medir outra vez"
            disabled={loading}
            onClick={() => setToken((value) => value + 1)}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </motion.div>

        {loading && (
          <motion.p
            variants={fadeUp}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />A percorrer as
            épocas, jogo a jogo. Demora uns segundos por competição.
          </motion.p>
        )}

        {error && !loading && (
          <motion.p variants={fadeUp} className="text-xs text-destructive">
            {error}
          </motion.p>
        )}

        {report && !loading && (
          <>
            <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Stat
                label="Jogos medidos"
                value={String(report.fixtures_scored)}
                detail={`${report.predictions} previsões em ${report.leagues.length} competições`}
              />
              <Stat
                label="Destaque acertado"
                value={`${report.headline.actual_pct.toFixed(1)}%`}
                detail={`Disse ${report.headline.predicted_pct.toFixed(1)}% (${
                  headlineGap >= 0 ? "+" : ""
                }${headlineGap.toFixed(1)}pp)`}
              />
              <Stat
                label="Brier"
                value={report.brier.toFixed(3)}
                detail="Mais baixo é melhor. 0.25 é atirar à sorte."
              />
              <Stat
                label="Sem histórico"
                value={String(report.fixtures_skipped)}
                detail="Jogos cedo demais na época para prever"
              />
            </motion.div>

            <motion.section variants={fadeUp} className="sl-card overflow-hidden">
              <div className="border-b border-border px-4 py-3.5">
                <h2 className="text-sm font-bold text-foreground">
                  O que disse vs o que aconteceu
                </h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  Quando as duas linhas andam juntas, uma probabilidade de 70%
                  quer mesmo dizer 70%. A linha cheia por baixo da tracejada é
                  o modelo a prometer mais do que entrega.
                </p>
              </div>
              <div className="p-4">
                <CalibrationChart bands={report.calibration} />

                <div className="mt-3 space-y-1.5">
                  {report.calibration
                    .filter((band) => band.samples >= 10)
                    .map((band) => {
                      const verdict = bandVerdict(band);
                      return (
                        <div
                          key={band.bucket}
                          className="flex items-center gap-2.5 rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2"
                        >
                          <span className="font-mono-data w-[68px] flex-none text-xs font-semibold text-foreground">
                            {band.bucket}
                          </span>
                          {/* The number goes on its own line rather than in a
                              run of text: at phone width a single line truncated
                              away the one figure the row exists to show. */}
                          <div className="min-w-0 flex-1">
                            <p className="font-mono-data text-[13px] font-semibold text-foreground">
                              {band.actual_pct.toFixed(1)}%
                            </p>
                            <p className="sl-meta truncate text-[11px]">
                              {band.samples} previsões
                            </p>
                          </div>
                          <span className={`sl-pill ${BAND_TONE[verdict]} flex-none`}>
                            {BAND_LABEL[verdict]}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.section>

            <motion.section variants={fadeUp} className="sl-card overflow-hidden">
              <div className="border-b border-border px-4 py-3.5">
                <h2 className="text-sm font-bold text-foreground">
                  Onde o modelo se engana mais
                </h2>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  Os mercados cuja previsão mais se afastou da realidade. É
                  aqui que há valor a corrigir — ou a evitar.
                </p>
              </div>
              <div className="divide-y divide-border">
                {worst.map((row) => (
                  <div key={row.market} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {MARKET_LABELS[row.market] ?? row.market}
                      </p>
                      <p className="sl-meta truncate text-[11px]">
                        Disse {row.predicted_pct.toFixed(1)}% · aconteceu{" "}
                        {row.actual_pct.toFixed(1)}% · {row.samples} jogos
                      </p>
                    </div>
                    <span
                      className={`font-mono-data flex-none text-sm font-bold ${
                        row.gap_pp >= 0
                          ? "text-[hsl(var(--sl-green))]"
                          : "text-destructive"
                      }`}
                    >
                      {row.gap_pp >= 0 ? "+" : ""}
                      {row.gap_pp.toFixed(1)}pp
                    </span>
                  </div>
                ))}
                {worst.length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">
                    Ainda não há mercados com jogos suficientes para julgar.
                  </p>
                )}
              </div>
            </motion.section>

            <motion.section variants={fadeUp} className="sl-card overflow-hidden">
              <div className="border-b border-border px-4 py-3.5">
                <h2 className="text-sm font-bold text-foreground">Por mercado</h2>
              </div>
              <div className="divide-y divide-border">
                {report.markets.map((row) => (
                  <div key={row.market} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-foreground">
                        {MARKET_LABELS[row.market] ?? row.market}
                      </p>
                      <p className="sl-meta truncate text-[11px]">
                        {row.samples} jogos · Brier {row.brier.toFixed(3)}
                      </p>
                    </div>
                    <span className="font-mono-data flex-none text-xs text-muted-foreground">
                      {row.predicted_pct.toFixed(1)}%
                    </span>
                    <Target className="h-3 w-3 flex-none text-muted-foreground" />
                    <span className="font-mono-data w-[52px] flex-none text-right text-xs font-bold text-foreground">
                      {row.actual_pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>

            {report.unavailable.length > 0 && (
              <motion.p variants={fadeUp} className="sl-meta text-[11px]">
                Sem resposta de: {report.unavailable.join(", ")}. Os números
                acima são só das competições que responderam.
              </motion.p>
            )}
          </>
        )}
      </motion.div>
    </AppLayout>
  );
}
