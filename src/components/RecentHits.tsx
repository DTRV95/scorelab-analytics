import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Target, X } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import {
  fetchResultsSnapshot,
  hitRate,
  loadBoardResults,
  playedYesterday,
  type BoardResults,
  type ScoredMatch,
} from "@/lib/boardResults";

type Span = "ontem" | "semana";

const SHOWN = 4;

function when(kickoff: string | null): string {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Row({ match }: { match: ScoredMatch }) {
  const Icon = match.landed ? Check : X;
  const tone = match.landed
    ? "text-[hsl(var(--sl-green))]"
    : "text-destructive";

  return (
    <div className="flex items-start gap-2.5 px-4 py-2.5">
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${tone}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-foreground">
          {match.home_name}{" "}
          <span className="sl-figure">
            {match.home_goals}-{match.away_goals}
          </span>{" "}
          {match.away_name}
        </p>
        <p className="sl-meta truncate text-[11px]">
          {match.league} · {when(match.kickoff)}
        </p>
      </div>

      <div className="flex-none text-right">
        <p className={`text-[11.5px] font-semibold ${tone}`}>
          {MARKET_LABELS[match.headline_market] ?? match.headline_market}
        </p>
        <p className="sl-meta text-[11px]">
          dava {match.headline_pct.toFixed(0)}%
        </p>
      </div>
    </div>
  );
}

/**
 * Whether the model was right, on the games that have already been played.
 *
 * The board is all forecast and no record: it says what is about to happen,
 * and by the time anybody could check, it has moved on to the next week. This
 * is the part that was missing — yesterday and the last seven days, one tick
 * or one cross per game, on the very market the board led with.
 *
 * It reads what the nightly job already scored. The engine is only asked when
 * there is nothing stored, and only because somebody pressed the button:
 * scoring a week means simulating every game in it again, and nobody should
 * open this page into a spinner.
 */
export function RecentHits() {
  const [results, setResults] = useState<BoardResults | null>(null);
  const [span, setSpan] = useState<Span>("ontem");
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  // What is already in hand, without ever waking the engine for it.
  useEffect(() => {
    let cancelled = false;

    fetchResultsSnapshot(7)
      .then((stored) => {
        if (!cancelled) setResults(stored);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const ask = useCallback(() => {
    setAsking(true);
    setError(null);

    loadBoardResults(7, { force: true })
      .then(setResults)
      .catch((reason: Error) =>
        setError(reason.message || "Não foi possível ver como correram."),
      )
      .finally(() => setAsking(false));
  }, []);

  if (loading) {
    return (
      <section className="sl-card space-y-2 px-4 py-3.5">
        <div className="sl-skeleton h-3.5 w-[45%]" />
        <div className="sl-skeleton h-2.5 w-[70%]" />
      </section>
    );
  }

  const matches = results
    ? span === "ontem"
      ? playedYesterday(results.matches)
      : results.matches
    : [];
  const rate = hitRate(matches);
  const shown = all ? matches : matches.slice(0, SHOWN);

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pb-2.5 pt-3.5">
        <Target className="h-4 w-4 flex-none text-primary" />
        <h2 className="flex-1 text-[13px] font-bold text-foreground">
          Como correram
        </h2>
        {/* Two windows, not a date picker: yesterday is the one anybody
            checks, and a week is enough games for the number to mean
            something. */}
        {/* Not the page's own chips: those are thumb-sized, and three of
            them beside a title push it onto two lines. */}
        {(["ontem", "semana"] as Span[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setSpan(option);
              setAll(false);
            }}
            className={`sl-tap flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              span === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground ring-1 ring-border"
            }`}
          >
            {option === "ontem" ? "Ontem" : "Semana"}
          </button>
        ))}
      </div>

      {!results && (
        <div className="px-4 pb-3.5">
          <p className="sl-meta text-[11.5px] leading-5">
            Quantas vezes o mercado que o modelo destacou em cada jogo acabou
            por entrar. Ainda não há nada marcado hoje — pedir ao motor demora
            um bocado, porque é cada jogo simulado outra vez.
          </p>
          <button
            type="button"
            disabled={asking}
            onClick={ask}
            className="sl-tap mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-semibold text-primary ring-1 ring-border disabled:opacity-50"
          >
            {asking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {asking ? "A marcar os jogos..." : "Ver como correram"}
          </button>
          {error && (
            <p className="mt-2 text-[11px] font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      )}

      {results && rate.pct === null && (
        <p className="sl-meta px-4 pb-3.5 text-[11.5px] leading-5">
          {span === "ontem"
            ? "Ontem não se jogou nada nas competições com dados automáticos."
            : "Nenhum jogo marcado nos últimos sete dias."}
        </p>
      )}

      {results && rate.pct !== null && (
        <>
          <div className="flex items-baseline gap-2 px-4 pb-1">
            <p className="sl-figure text-[22px] text-foreground">
              {rate.hits} de {rate.played}
            </p>
            <p
              className={`sl-figure text-[15px] ${
                rate.pct >= 50
                  ? "text-[hsl(var(--sl-green))]"
                  : "text-destructive"
              }`}
            >
              {rate.pct}%
            </p>
          </div>

          {/* The hit rate alone cannot tell a sharp model from a timid one:
              fifteen of twenty is a different thing when it said 75% than
              when it said 95%. */}
          <p className="sl-meta px-4 pb-3 text-[11px] leading-5">
            certos {span === "ontem" ? "ontem" : "nos últimos sete dias"}, no
            mercado que o modelo destacou em cada jogo. Dizia, em média,{" "}
            {rate.said}%.
          </p>

          <div className="divide-y divide-border border-t border-border">
            {shown.map((match) => (
              <Row key={match.fixture_id} match={match} />
            ))}
          </div>

          {/* What is on screen was scored during the night, so a game played
              this afternoon is not in it yet. Saying so, and offering the
              way to fix it, beats quietly showing yesterday's week. */}
          <div className="flex items-center gap-3 border-t border-border px-4">
            {matches.length > SHOWN && (
              <button
                type="button"
                onClick={() => setAll((open) => !open)}
                className="flex-1 py-2.5 text-left text-[11px] font-semibold text-primary"
              >
                {all
                  ? "Mostrar só os últimos"
                  : `Ver os ${matches.length} jogos`}
              </button>
            )}
            <button
              type="button"
              disabled={asking}
              onClick={ask}
              className={`flex items-center gap-1.5 py-2.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-50 ${
                matches.length > SHOWN ? "" : "flex-1 justify-start"
              }`}
            >
              {asking && <Loader2 className="h-3 w-3 animate-spin" />}
              {asking ? "A marcar os jogos..." : "Incluir os jogos de hoje"}
            </button>
          </div>

          {error && (
            <p className="border-t border-border px-4 py-2 text-[11px] font-medium text-destructive">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
