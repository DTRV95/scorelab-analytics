import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  ProbabilityBreakdown,
  MARKET_LABELS,
  sampleTone,
} from "@/components/ProbabilityBreakdown";
import {
  fetchPrefill,
  MatchForm,
  type PrefillForm,
} from "@/components/MatchForm";
import { MatchDossier } from "@/components/MatchDossier";
import { SuggestionCard } from "@/components/SuggestionCard";
import { fetchMatchContext, type MatchContext } from "@/lib/marketPrice";
import { decide } from "@/lib/verdict";
import {
  adjustments,
  fetchMarketCalibration,
} from "@/lib/marketCalibration";
import { keepVerdict } from "@/lib/verdictRecord";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";
import { calculateNextBankrollBefore } from "@/lib/analysisStorage";
import { fetchLeagueAccuracy, type AccuracyMarket } from "@/lib/modelAccuracy";
import {
  buildValueRows,
  recordVerdict,
  valuePicks,
  type ValueRow,
} from "@/lib/matchValue";
import {
  readCachedBoard,
  writeCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";
import { fadeUp, stagger } from "@/lib/motion";

const BOARD_DAYS = 7;

/** When the game is played, written out under its name. */
function kickoffLabel(kickoff: string | null) {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Only the deviations get a line. "The model has been right here" repeated
// down fifteen markets is noise that hides the two that matter.
const RECORD_NOTE: Record<ReturnType<typeof recordVerdict>, string | null> = {
  sharp: null,
  over: "Atenção: neste mercado o modelo tem prometido mais do que entrega.",
  under: "Neste mercado o modelo tem entregue mais do que promete.",
  unknown: null,
};

/**
 * Where the value is, if there is any.
 *
 * Odds are typed per market and nothing is assumed about the ones left blank:
 * a market with no price has no edge, only a forecast.
 */
function ValueTable({
  rows,
  odds,
  onOddsChange,
}: {
  rows: ValueRow[];
  odds: Record<string, string>;
  onOddsChange: (market: string, value: string) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {rows.map((row) => {
        const verdict = recordVerdict(row.record);
        return (
          <div key={row.market} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {MARKET_LABELS[row.market] ?? row.market}
                </p>
                {/* Not truncated: the two prices are the point of the row,
                    and at phone width a single line cut the second one off. */}
                <p className="sl-meta text-[11px] leading-5">
                  {row.modelProb.toFixed(1)}% · justo {row.fairOdds.toFixed(2)} ·
                  seguro {row.cautiousFairOdds.toFixed(2)}
                </p>
              </div>

              <input
                inputMode="decimal"
                value={odds[row.market] ?? ""}
                onChange={(event) => onOddsChange(row.market, event.target.value)}
                placeholder={row.fairOdds.toFixed(2)}
                aria-label={`Odd para ${row.market}`}
                className="h-9 w-[76px] flex-none rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-2 text-center font-mono-data text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />

              <span
                className={`font-mono-data w-[62px] flex-none text-right text-sm font-bold ${
                  row.edge === null
                    ? "text-muted-foreground"
                    : row.edge > 0
                    ? "text-[hsl(var(--sl-green))]"
                    : "text-destructive"
                }`}
              >
                {row.edge === null
                  ? "—"
                  : `${row.edge > 0 ? "+" : ""}${row.edge.toFixed(1)}%`}
              </span>
            </div>

            {row.odds !== null && (
              <p className="sl-meta mt-1.5 text-[11px]">
                Com a margem de erro do modelo:{" "}
                <span
                  className={
                    (row.edgeFloor ?? 0) > 0
                      ? "text-[hsl(var(--sl-green))]"
                      : "text-destructive"
                  }
                >
                  {(row.edgeFloor ?? 0) > 0 ? "+" : ""}
                  {(row.edgeFloor ?? 0).toFixed(1)}%
                </span>
                {row.stake ? ` · stake sugerida ${row.stake.toFixed(2)} €` : ""}
              </p>
            )}

            {RECORD_NOTE[verdict] && (
              <p
                className={`mt-1.5 text-[11px] leading-relaxed ${
                  verdict === "over" ? "text-destructive" : "sl-meta"
                }`}
              >
                {RECORD_NOTE[verdict]} Disse{" "}
                {row.record?.predicted_pct.toFixed(1)}%, aconteceu{" "}
                {row.record?.actual_pct.toFixed(1)}% em {row.record?.samples} jogos.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MatchDeepDive() {
  const { fixtureId = "" } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState<BoardMatch | null>(null);
  const [prefill, setPrefill] = useState<PrefillForm | null>(null);
  const [record, setRecord] = useState<Map<string, AccuracyMarket>>(new Map());
  const [context, setContext] = useState<MatchContext | null>(null);
  /** O exagero medido de cada mercado. Vazio enquanto não chega. */
  const [tuning, setTuning] = useState<Record<string, number>>({});
  const [odds, setOdds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numericId = Number(fixtureId);
  const bankroll = useMemo(() => calculateNextBankrollBefore(), []);

  useEffect(() => {
    let cancelled = false;

    const findMatch = async (): Promise<BoardMatch | null> => {
      // The board this came from is already in hand; only a direct link or an
      // expired cache has to pay for the whole thing again.
      const cached = readCachedBoard(BOARD_DAYS);
      const hit = cached?.matches.find((item) => item.fixture_id === numericId);
      if (hit) return hit;

      const response = await fetch(
        buildApiUrl(`/data/probability-board?days=${BOARD_DAYS}`)
      );
      if (!response.ok) throw new Error(String(response.status));
      const data = await response.json();
      writeCachedBoard({
        days: BOARD_DAYS,
        matches: data.matches ?? [],
        unavailable: data.unavailable ?? [],
        skipped: data.skipped ?? 0,
      });
      return (
        (data.matches ?? []).find(
          (item: BoardMatch) => item.fixture_id === numericId
        ) ?? null
      );
    };

    setLoading(true);
    setError(null);

    findMatch()
      .then((found) => {
        if (cancelled) return;
        if (!found) {
          setError("Este jogo já não está no quadro de probabilidades.");
          return;
        }
        setMatch(found);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível carregar este jogo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [numericId]);

  useEffect(() => {
    if (!match) return;
    let cancelled = false;

    // Held for the session, and usually already in hand: the games list
    // fetches the same thing the moment somebody opens the row this page
    // was reached from.
    fetchPrefill(match.league, match.fixture_id)
      .then((data) => {
        if (!cancelled && data) setPrefill(data);
      })
      .catch(() => undefined);

    // O preço do mercado, quando o há. Também best effort: o jogo
    // continua a ler-se sem ele, e um jogo que as casas ainda não
    // abriram é o caso normal a três dias de distância.
    fetchMatchContext(match.league, match.home_name, match.away_name, match.kickoff)
      .then((found) => {
        if (!cancelled) setContext(found);
      })
      .catch(() => undefined);

    // Best effort: the forecast stands without it, this only adds the
    // model's history on these markets next to it.
    fetchLeagueAccuracy(match.league)
      .then((report) => {
        if (cancelled) return;
        setRecord(new Map(report.markets.map((row) => [row.market, row])));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [match]);

  const rows = useMemo(
    () => (match ? buildValueRows(match.mercados, odds, bankroll, record) : []),
    [match, odds, bankroll, record]
  );
  const picks = useMemo(() => valuePicks(rows), [rows]);

  // Quantas odds já foram escritas: é o que separa uma previsão de uma
  // decisão, e por isso é uma das linhas do que sabemos deste jogo.
  useEffect(() => {
    let cancelled = false;
    fetchMarketCalibration()
      .then((rows) => {
        if (!cancelled) setTuning(adjustments(rows));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const oddsTyped = useMemo(
    () =>
      Object.values(odds).filter((value) => {
        const parsed = Number(value.replace(",", "."));
        return Number.isFinite(parsed) && parsed > 1;
      }).length,
    [odds]
  );

  // O veredicto fica escrito assim que há preço, com o preço desse
  // momento. Não é para o ecrã — o ecrã já o mostra — é para daqui a um
  // mês se poder contar quantos acertaram.
  useEffect(() => {
    if (!match || !context?.market) return;

    const veredicto = decide({
      headline: match.headline_market
        ? { market: match.headline_market, pct: match.headline_pct }
        : null,
      amostraPct: match.amostra_pct,
      record: record.get(match.headline_market) ?? null,
      adjustmentPp: tuning[match.headline_market],
      prices: context.market.odds,
      implied: context.market.implied,
    });

    keepVerdict(
      match.fixture_id,
      match.league,
      match.kickoff,
      match.headline_market,
      veredicto,
    ).catch(() => undefined);
  }, [match, context, record, tuning]);

  const setOddsFor = (market: string, value: string) =>
    setOdds((previous) => ({ ...previous, [market]: value }));

  if (loading) {
    return (
      <AppLayout>
        <p className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A carregar o jogo...
        </p>
      </AppLayout>
    );
  }

  if (error || !match) {
    return (
      <AppLayout>
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button className="sl-btn-primary mt-4" onClick={() => navigate("/probability")}>
            Voltar às probabilidades
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <motion.div initial="hidden" animate="visible" variants={stagger} className="space-y-3">
        <motion.div variants={fadeUp}>
          <Link
            to="/probability"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Probabilidades
          </Link>
        </motion.div>

        <motion.header variants={fadeUp} className="sl-card px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="sl-meta text-[11px] uppercase tracking-[0.14em]">
                {match.league}
              </p>
              <h1 className="mt-1 text-lg font-bold leading-tight text-foreground">
                {match.home_name} vs {match.away_name}
              </h1>
              <p className="sl-meta mt-0.5 text-[11px]">{kickoffLabel(match.kickoff)}</p>
            </div>
            <span
              className={`flex-none rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${sampleTone(
                match.amostra_label
              )}`}
              title="Quanto histórico sustenta esta previsão"
            >
              {match.amostra_label} · {match.amostra_pct.toFixed(0)}%
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: match.home_name, value: match.lambda_casa },
              { label: match.away_name, value: match.lambda_fora },
              { label: "Total", value: match.total_golos_esperados },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-[hsl(var(--sl-surface))] px-3 py-2"
              >
                <p className="sl-meta truncate text-[10px] uppercase tracking-[0.1em]">
                  {item.label}
                </p>
                <p className="mt-0.5 font-mono-data text-base font-bold text-foreground">
                  {item.value.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <p className="sl-meta mt-2 text-[11px]">Golos esperados</p>
        </motion.header>

        {/* À cabeça de tudo, logo a seguir ao nome do jogo: o resto da
            página é material para confirmar uma decisão, e alguém tem de
            a tomar primeiro. */}
        <motion.div variants={fadeUp}>
          <SuggestionCard
            markets={match.mercados}
            amostraPct={match.amostra_pct}
            prices={context?.market?.odds ?? null}
            implied={context?.market?.implied ?? null}
            record={record}
            adjustments={tuning}
          />
        </motion.div>

        {/* Antes do valor, de propósito: o que falta saber muda o que vale
            a pena fazer com o que se sabe. */}
        <motion.div variants={fadeUp}>
          <MatchDossier
            amostraLabel={match.amostra_label}
            amostraPct={match.amostra_pct}
            form={prefill}
            headline={
              match.headline_market
                ? { market: match.headline_market, pct: match.headline_pct }
                : null
            }
            record={record.get(match.headline_market) ?? null}
            oddsTyped={oddsTyped}
            adjustmentPp={
              match.headline_market ? tuning[match.headline_market] : undefined
            }
            market={context?.market ?? null}
            absences={context?.absences ?? null}
            news={context?.news ?? null}
            teams={{ home: match.home_name, away: match.away_name }}
          />
        </motion.div>

        {picks.length > 0 && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <TrendingUp className="h-4 w-4 text-[hsl(var(--sl-green))]" />
                Onde está o valor
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                Mercados cuja odd continua a compensar mesmo assumindo que o
                modelo está a exagerar. Ordenados por essa margem, não pela
                mais favorável.
              </p>
            </div>
            <div className="divide-y divide-border">
              {picks.map((row) => (
                <div key={row.market} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {MARKET_LABELS[row.market] ?? row.market}
                    </p>
                    <p className="sl-meta truncate text-[11px]">
                      {row.modelProb.toFixed(1)}% a {row.odds?.toFixed(2)}
                      {row.stake ? ` · ${row.stake.toFixed(2)} €` : ""}
                    </p>
                  </div>
                  <span className="font-mono-data flex-none text-sm font-bold text-[hsl(var(--sl-green))]">
                    +{(row.edgeFloor ?? 0).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        <motion.section variants={fadeUp} className="sl-card overflow-hidden">
          <div className="border-b border-border px-4 py-3.5">
            <h2 className="text-sm font-bold text-foreground">Valor por mercado</h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              Mete as odds da tua casa nos mercados que te interessam. "Justo"
              é o preço que a probabilidade vale; "seguro" é o que ela vale no
              pior cenário do intervalo.
            </p>
          </div>
          <ValueTable rows={rows} odds={odds} onOddsChange={setOddsFor} />
        </motion.section>

        {prefill && (
          <motion.section variants={fadeUp} className="sl-card overflow-hidden">
            <div className="border-b border-border px-4 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                A forma por trás do número
              </h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                Foi isto que o modelo leu. Golos por jogo, por lado, na época e
                nos últimos jogos.
              </p>
            </div>
            <div className="p-4">
              <MatchForm prefill={prefill} match={match} />
            </div>
          </motion.section>
        )}

        <motion.section variants={fadeUp} className="sl-card overflow-hidden">
          <div className="border-b border-border px-4 py-3.5">
            <h2 className="text-sm font-bold text-foreground">
              Todos os mercados
            </h2>
          </div>
          <div className="p-4">
            <ProbabilityBreakdown data={match} />
          </div>
        </motion.section>

        <motion.div variants={fadeUp}>
        </motion.div>
      </motion.div>
    </AppLayout>
  );
}
