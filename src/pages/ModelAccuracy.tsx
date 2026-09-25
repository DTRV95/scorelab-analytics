import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Target } from "lucide-react";
import {
  CartesianGrid,
  Legend,
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
import {
  measuredAgo,
  readCachedAccuracy,
  writeCachedAccuracy,
} from "@/lib/accuracyCache";
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
      jogos: band.samples,
    }));

  if (rows.length < 2) {
    return (
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ainda não há bandas com jogos suficientes para desenhar a curva.
      </p>
    );
  }

  // The hover needs to say how many predictions are behind the point: a band
  // two points off with 40 predictions and one two points off with 4,000 are
  // not the same finding, and the chart alone cannot tell them apart.
  const samplesByBand = new Map(rows.map((row) => [row.bucket, row.jogos]));
  const axisTick = { fontSize: 10, fill: "hsl(var(--muted-foreground))" };
  const axisLabel = {
    fontSize: 10,
    fill: "hsl(var(--muted-foreground))",
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 4, right: 10, bottom: 22, left: -4 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            tick={axisTick}
            tickLine={false}
            label={{
              value: "Banda de probabilidade (%)",
              position: "insideBottom",
              offset: -14,
              style: axisLabel,
            }}
          />
          <YAxis
            domain={[0, 100]}
            width={44}
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            label={{
              value: "Acontece (%)",
              angle: -90,
              position: "insideLeft",
              offset: 14,
              style: axisLabel,
            }}
          />
          <Tooltip
            wrapperClassName="scorelab-chart-tooltip"
            formatter={(value: number, name: string) => [`${value}%`, name]}
            labelFormatter={(label) =>
              `Banda ${label}% · ${samplesByBand.get(String(label)) ?? 0} previsões`
            }
          />
          <Legend
            verticalAlign="top"
            height={26}
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
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
            name="Aconteceu mesmo"
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
  const [measuredAt, setMeasuredAt] = useState<number | null>(null);

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

  /**
   * Shows the last measurement, and only measures again when asked.
   *
   * Scoring a season is a replay of every match played, so opening this tab
   * used to mean a wait of tens of seconds per competition — every time, for an
   * answer that only moves when new matches are played. The saved report is
   * served straight away; the refresh button is what pays for a new one.
   */
  const load = useCallback(
    (force: boolean) => {
      if (leagues.length === 0) return;

      if (!force) {
        const cached = readCachedAccuracy(leagues);
        if (cached) {
          setReport(cached.report);
          setMeasuredAt(cached.fetchedAt);
          setError(null);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      setError(null);

      fetchAccuracyReport(leagues)
        .then((result) => {
          setReport(result);
          setMeasuredAt(Date.now());
          writeCachedAccuracy(leagues, result);
        })
        .catch(() => {
          setError(
            "Não foi possível medir o acerto agora. A fonte de dados não respondeu."
          );
        })
        .finally(() => setLoading(false));
    },
    [leagues]
  );

  useEffect(() => load(false), [load]);

  // Mirrors are left out of this list on purpose: "Mais de 2.5 falhou por
  // 2.4pp" and "Menos de 2.5 sobrou por 2.4pp" are the same miss written
  // twice, and a top five made of pairs is really a top two.
  const worst = useMemo(
    () =>
      report
        ? [...report.markets]
            .filter((row) => row.samples >= 30 && row.counted !== false)
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
              {measuredAt !== null && !loading
                ? ` Medido ${measuredAgo(measuredAt)}.`
                : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-none rounded-lg text-muted-foreground"
            title="Medir outra vez"
            disabled={loading}
            onClick={() => load(true)}
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

        {report && (
          <>
            <motion.div variants={fadeUp} className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Stat
                label="Jogos medidos"
                value={String(report.fixtures_scored)}
                detail={`${report.predictions.toLocaleString("pt-PT")} previsões, ${
                  report.markets_counted
                } mercados por jogo, ${report.leagues.length} competições`}
              />
              <Stat
                label="Erro por previsão"
                value={report.brier.toFixed(3)}
                detail={`Brier: 0 é perfeito. Quem só soubesse a frequência de cada mercado faria ${report.baseline_brier.toFixed(
                  3
                )}.`}
              />
              <Stat
                label="Ganho sobre a base"
                value={`${report.skill_pct >= 0 ? "+" : ""}${report.skill_pct.toFixed(1)}%`}
                detail={
                  report.skill_pct > 0
                    ? "Erro que o modelo poupa por olhar para o jogo em vez da frequência."
                    : "O modelo não está a acrescentar nada à frequência de cada mercado."
                }
              />
              <Stat
                label="Aposta destacada"
                value={`${report.headline.actual_pct.toFixed(1)}%`}
                detail={`O mercado mais forte de cada jogo. Disse ${report.headline.predicted_pct.toFixed(
                  1
                )}% (${headlineGap >= 0 ? "+" : ""}${headlineGap.toFixed(1)}pp) em ${
                  report.headline.predictions
                } jogos.`}
              />
              <Stat
                label="Jogos de fora"
                value={String(report.fixtures_skipped)}
                detail="Sem jogos anteriores suficientes na época, ou sem resultado na fonte."
              />
            </motion.div>

            <motion.p
              variants={fadeUp}
              className="sl-card px-4 py-3 text-xs leading-6 text-muted-foreground"
            >
              Em{" "}
              <strong className="font-semibold text-foreground">
                {report.predictions.toLocaleString("pt-PT")} previsões
              </strong>{" "}
              de {report.fixtures_scored} jogos, o modelo errou{" "}
              <strong className="font-semibold text-foreground">
                {report.brier.toFixed(3)}
              </strong>{" "}
              por previsão contra {report.baseline_brier.toFixed(3)} de quem só
              soubesse com que frequência cada mercado sai —{" "}
              <strong
                className={
                  report.skill_pct > 0
                    ? "font-semibold text-[hsl(var(--sl-green))]"
                    : "font-semibold text-destructive"
                }
              >
                {report.skill_pct > 0
                  ? `${report.skill_pct.toFixed(1)}% menos erro`
                  : `${Math.abs(report.skill_pct).toFixed(1)}% mais erro`}
              </strong>
              . A aposta destacada saiu {report.headline.actual_pct.toFixed(1)}% das
              vezes quando o modelo lhe dava {report.headline.predicted_pct.toFixed(1)}%.
            </motion.p>

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
                          {/* Each number goes on its own line rather than in a
                              run of text: at phone width a single line truncated
                              away the figures the row exists to show. */}
                          <div className="w-[80px] flex-none">
                            <p className="font-mono-data text-xs font-semibold text-foreground">
                              {band.bucket}
                            </p>
                            <p className="sl-meta whitespace-nowrap text-[10px]">
                              disse {band.predicted_pct.toFixed(1)}%
                            </p>
                          </div>
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
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  Os {report.markets_forecast} mercados do quadro: o que o
                  modelo disse, à esquerda, e o que aconteceu, à direita. Os
                  totais em cima contam {report.markets_counted}, porque
                  &ldquo;Menos de 2.5&rdquo; é o contrário de &ldquo;Mais de
                  2.5&rdquo; e acertar num é acertar no outro.
                </p>
              </div>
              <div className="flex items-center gap-3 border-b border-border px-4 py-2">
                <span className="sl-meta min-w-0 flex-1 text-[10px] uppercase tracking-[0.13em]">
                  Mercado
                </span>
                <span className="sl-meta w-[52px] flex-none text-right text-[10px] uppercase tracking-[0.13em]">
                  Disse
                </span>
                <span className="w-3 flex-none" />
                <span className="sl-meta w-[52px] flex-none text-right text-[10px] uppercase tracking-[0.13em]">
                  Saiu
                </span>
              </div>
              <div className="divide-y divide-border">
                {report.markets.map((row) => (
                  <div key={row.market} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-foreground">
                        {MARKET_LABELS[row.market] ?? row.market}
                      </p>
                      {/* The mirror marker leads the line: it is the part a
                          narrow screen must not truncate away, because without
                          it the row looks like a fifteenth independent result. */}
                      <p className="sl-meta truncate text-[11px]">
                        {row.counted === false ? "Espelho · " : ""}
                        {row.samples} jogos · Brier {row.brier.toFixed(3)}
                      </p>
                    </div>
                    <span className="font-mono-data w-[52px] flex-none text-right text-xs text-muted-foreground">
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
