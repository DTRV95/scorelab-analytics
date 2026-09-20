import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyFixtureResults } from "@/lib/analysisStorage";
import { getSavedMultiples, settleMultiples } from "@/lib/multipleStorage";
import {
  analysesAwaitingResults,
  buildResultsPlan,
  fetchFixtureResults,
  fixtureRefs,
  multiplesAwaitingResults,
  type ResultsPlan,
  type SettlementPreview,
} from "@/lib/resultsSync";
import type { SavedAnalysis } from "@/types/analysis";

const EMPTY_PLAN: ResultsPlan = {
  scores: [],
  settlements: [],
  multiples: [],
  manual: [],
  finished: 0,
  pending: 0,
};

function money(value: number) {
  return `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(2)} €`;
}

/**
 * Brings the real result of every analysed fixture back into the app.
 *
 * Final scores are filled in automatically — they are facts and change no
 * money. Settling a bet moves the bankroll, so that stays one click away and
 * every line can be dropped from the batch first.
 */
export function MatchResultsPanel({
  analyses,
  onUpdated,
}: {
  analyses: SavedAnalysis[];
  /** Optional: pages holding their own copy of the history keep it in step.
   *  Pages reading from ScoreLabDataContext need nothing — the write itself
   *  refreshes them. */
  onUpdated?: (analyses: SavedAnalysis[]) => void;
}) {
  const [plan, setPlan] = useState<ResultsPlan>(EMPTY_PLAN);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [scoresApplied, setScoresApplied] = useState(0);
  const [settledCount, setSettledCount] = useState(0);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [token, setToken] = useState(0);

  // The panel writes to the same list it reads, so the refresh works off a ref
  // instead of re-running every time the history updates.
  const analysesRef = useRef(analyses);
  analysesRef.current = analyses;

  // ...but it does have to re-run when the set of fixtures being waited on
  // changes. Pages that load their history after mounting hand this panel an
  // empty list on the first render, and keying only off the ref left those
  // bets sitting unsettled until the page was reloaded by hand.
  const awaitingKey = analysesAwaitingResults(analyses)
    .map((analysis) => analysis.fixture?.id)
    .sort()
    .join(",");

  const onUpdatedRef = useRef(onUpdated);
  onUpdatedRef.current = onUpdated;

  const publish = (updated: SavedAnalysis[]) => onUpdatedRef.current?.(updated);

  useEffect(() => {
    const awaiting = analysesAwaitingResults(analysesRef.current);
    const multiples = multiplesAwaitingResults(getSavedMultiples());
    if (awaiting.length === 0 && multiples.length === 0) {
      setPlan(EMPTY_PLAN);
      setChecked(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSkipped(new Set());

    fetchFixtureResults(fixtureRefs(awaiting, multiples))
      .then(({ results, unavailable: failed }) => {
        if (cancelled) return;
        setUnavailable(failed);

        const found = buildResultsPlan(analysesRef.current, results, multiples);
        if (found.scores.length === 0) {
          setPlan(found);
          setScoresApplied(0);
          return;
        }

        const updated = applyFixtureResults({ scores: found.scores });
        publish(updated);
        setScoresApplied(found.scores.length);
        setPlan(buildResultsPlan(updated, results, multiples));
      })
      .catch(() => {
        if (!cancelled) setPlan(EMPTY_PLAN);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, [token, awaitingKey]);

  const settlementKey = (item: SettlementPreview) =>
    `${item.analysisId}:${item.betId}`;

  const pendingSettlements = plan.settlements.filter(
    (item) => !skipped.has(settlementKey(item))
  );
  const pendingMultiples = plan.multiples.filter(
    (item) => !skipped.has(`multiple:${item.multipleId}`)
  );
  const totalPending = pendingSettlements.length + pendingMultiples.length;

  const settleAll = useCallback(() => {
    if (totalPending === 0) return;

    if (pendingSettlements.length > 0) {
      publish(
        applyFixtureResults({
          settlements: pendingSettlements.map((item) => ({
            analysisId: item.analysisId,
            betId: item.betId,
            resultStatus: item.resultStatus,
          })),
        })
      );
    }

    if (pendingMultiples.length > 0) {
      settleMultiples(
        pendingMultiples.map((item) => ({
          multipleId: item.multipleId,
          legs: item.legs,
        }))
      );
    }

    setSettledCount(totalPending);
    setPlan((previous) => ({ ...previous, settlements: [], multiples: [] }));
  }, [pendingSettlements, pendingMultiples, totalPending]);

  const nothingToShow =
    checked &&
    !loading &&
    plan.settlements.length === 0 &&
    plan.multiples.length === 0 &&
    scoresApplied === 0 &&
    settledCount === 0 &&
    unavailable.length === 0 &&
    plan.pending === 0;

  if (nothingToShow) return null;

  const net =
    pendingSettlements.reduce((sum, item) => sum + item.profitLoss, 0) +
    pendingMultiples.reduce((sum, item) => sum + item.profitLoss, 0);

  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-primary" strokeWidth={1.7} />
            Resultados dos jogos
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Os resultados finais dos jogos escolhidos em "Jogos do Dia" são
            buscados automaticamente. As apostas só são liquidadas quando
            confirmas.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-none rounded-lg text-muted-foreground hover:text-foreground"
          title="Verificar resultados agora"
          disabled={loading}
          onClick={() => {
            setScoresApplied(0);
            setSettledCount(0);
            setToken((value) => value + 1);
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> A verificar
          resultados...
        </p>
      )}

      {!loading && scoresApplied > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary ring-1 ring-primary/20">
          <CheckCircle2 className="h-3.5 w-3.5 flex-none" strokeWidth={1.8} />
          {scoresApplied === 1
            ? "1 resultado final atualizado."
            : `${scoresApplied} resultados finais atualizados.`}{" "}
          O acerto do modelo já conta com eles.
        </p>
      )}

      {!loading && settledCount > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-400/20">
          <CheckCircle2 className="h-3.5 w-3.5 flex-none" strokeWidth={1.8} />
          {settledCount === 1
            ? "1 aposta liquidada."
            : `${settledCount} apostas liquidadas.`}{" "}
          A banca e o histórico foram atualizados.
        </p>
      )}

      {!loading && totalPending > 0 && (
        <div className="mt-3 space-y-1.5">
          {pendingMultiples.map((item) => (
            <div
              key={`multiple:${item.multipleId}`}
              className="flex items-center gap-2 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                {/* The marker leads the line: at phone width the match names
                    truncate, and a trailing "(múltipla)" was the first thing
                    to disappear — exactly the word that says what this is. */}
                <p className="flex items-center gap-1.5 text-sm text-foreground">
                  <span className="sl-pill sl-pill-muted flex-none text-[10px]">
                    Múltipla
                  </span>
                  <span className="truncate">{item.label}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.legCount} jogos · {item.stake.toFixed(2)} € @{" "}
                  {item.odd.toFixed(2)}
                  {item.resultStatus === "red" && (
                    <>
                      {" · falhou "}
                      {item.legs.filter((leg) => leg.resultStatus === "red").length}
                    </>
                  )}
                </p>
              </div>
              <span
                className={`flex-none rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  item.resultStatus === "green"
                    ? "bg-emerald-400/10 text-emerald-700"
                    : "bg-rose-400/10 text-rose-700"
                }`}
              >
                {money(item.profitLoss)}
              </span>
              <button
                type="button"
                title="Não liquidar esta"
                className="flex-none rounded-lg p-1 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setSkipped((previous) =>
                    new Set(previous).add(`multiple:${item.multipleId}`)
                  )
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {pendingSettlements.map((item) => (
            <div
              key={settlementKey(item)}
              className="flex items-center gap-2 rounded-xl border border-border bg-[hsl(var(--sl-surface))] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {item.match}{" "}
                  <span className="text-muted-foreground">{item.score}</span>
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.market} · {item.stake.toFixed(2)} € @ {item.odd.toFixed(2)}
                </p>
              </div>
              <span
                className={`flex-none rounded-lg px-2 py-1 text-[11px] font-semibold ${
                  item.resultStatus === "green"
                    ? "bg-emerald-400/10 text-emerald-700"
                    : "bg-rose-400/10 text-rose-700"
                }`}
              >
                {money(item.profitLoss)}
              </span>
              <button
                type="button"
                title="Não liquidar esta"
                className="flex-none rounded-lg p-1 text-muted-foreground hover:text-foreground"
                onClick={() =>
                  setSkipped((previous) =>
                    new Set(previous).add(settlementKey(item))
                  )
                }
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-muted-foreground">
              Saldo destas apostas:{" "}
              <span className={net >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {money(net)}
              </span>
            </p>
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={settleAll}>
              Liquidar {totalPending}
            </Button>
          </div>
        </div>
      )}

      {!loading && plan.manual.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {plan.manual.length === 1
            ? "1 aposta continua por liquidar à mão"
            : `${plan.manual.length} apostas continuam por liquidar à mão`}
          : o resultado final não decide esse mercado.
        </p>
      )}

      {!loading && totalPending === 0 && plan.pending > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {plan.pending === 1
            ? "1 jogo analisado ainda não foi disputado."
            : `${plan.pending} jogos analisados ainda não foram disputados.`}
        </p>
      )}

      {!loading && unavailable.length > 0 && (
        <p className="mt-3 text-[11px] text-amber-700/80">
          Sem resposta da fonte de dados para: {unavailable.join(", ")}. Tenta
          novamente daqui a pouco.
        </p>
      )}
    </div>
  );
}
