import { useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { hitRate, type ScoredMatch } from "@/lib/boardResults";
import type { BoardResultsState } from "@/hooks/useBoardResults";

type Span = "ontem" | "semana";

/** The week unrolled is a hundred rows; the day is never more than a dozen. */
const SHOWN = 12;

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
 * Yesterday, in the same row of days as today and tomorrow.
 *
 * The board is all forecast and no record: it says what is about to happen,
 * and by the time anybody could check, it has moved on to the next week. The
 * day before belongs in the same place as the days after — one tick or one
 * cross per game, on the very market the board led with.
 *
 * What is on screen was scored during the night. The engine is only asked
 * when somebody presses for it, because scoring a week means simulating
 * every game in it again.
 */
export function RecentHits({ state }: { state: BoardResultsState }) {
  const { results, yesterday, asking, error, ask } = state;
  const [span, setSpan] = useState<Span>("ontem");
  const [all, setAll] = useState(false);

  const matches = span === "ontem" ? yesterday : (results?.matches ?? []);
  const rate = hitRate(matches);
  const shown = all ? matches : matches.slice(0, SHOWN);

  if (!results) {
    return (
      <div className="sl-card px-4 py-4">
        <p className="text-[12.5px] leading-6 text-foreground">
          Quantas vezes o mercado que o modelo destacou em cada jogo acabou
          por entrar.
        </p>
        <p className="sl-meta mt-1 text-[11.5px] leading-5">
          Ainda não há nada marcado. Pedir ao motor demora um bocado, porque é
          cada jogo simulado outra vez.
        </p>
        <button
          type="button"
          disabled={asking}
          onClick={ask}
          className="sl-tap mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-semibold text-primary ring-1 ring-border disabled:opacity-50"
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
    );
  }

  return (
    <div className="sl-card overflow-hidden">
      {rate.pct === null ? (
        <p className="sl-meta px-4 py-4 text-[12.5px] leading-6">
          {span === "ontem"
            ? "Ontem não se jogou nada nas competições com dados automáticos."
            : "Nenhum jogo marcado nos últimos sete dias."}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 px-4 pt-3.5">
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
          <p className="sl-meta px-4 pb-3 pt-0.5 text-[11px] leading-5">
            certos {span === "ontem" ? "ontem" : "nos últimos sete dias"}, no
            mercado que o modelo destacou em cada jogo. Dizia, em média,{" "}
            {rate.said}%.
          </p>

          <div className="divide-y divide-border border-t border-border">
            {shown.map((match) => (
              <Row key={match.fixture_id} match={match} />
            ))}
          </div>

          {/* A quiet week is a dozen games and a busy one is a hundred and
              forty. The day never needs this; the week always would. */}
          {matches.length > shown.length && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="w-full border-t border-border py-2.5 text-[11px] font-semibold text-primary"
            >
              Ver os outros {matches.length - shown.length} jogos
            </button>
          )}
        </>
      )}

      {/* The week lives behind yesterday rather than beside it: a day is what
          anybody checks, and a chip for every window would be a row of
          chips about the past in front of the games still to play. */}
      <div className="flex items-center gap-3 border-t border-border px-4">
        <button
          type="button"
          onClick={() => {
            setSpan(span === "ontem" ? "semana" : "ontem");
            setAll(false);
          }}
          className="flex-1 py-2.5 text-left text-[11px] font-semibold text-primary"
        >
          {span === "ontem"
            ? "Ver os últimos sete dias"
            : "Ver só os jogos de ontem"}
        </button>
        <button
          type="button"
          disabled={asking}
          onClick={ask}
          className="flex items-center gap-1.5 py-2.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
        >
          {asking && <Loader2 className="h-3 w-3 animate-spin" />}
          {asking ? "A marcar..." : "Incluir os de hoje"}
        </button>
      </div>

      {error && (
        <p className="border-t border-border px-4 py-2 text-[11px] font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
