import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { timeLabel } from "@/components/TodayMatches";
import type { BoardMatch } from "@/lib/probabilityBoardCache";
import { topByDay } from "@/lib/topGames";
import { minimumOdd, onShortlist } from "@/lib/shortlist";

/**
 * The three games the model is surest about, one day at a time.
 *
 * It was the three strongest of the whole week, which on a Monday meant
 * three games on Saturday: everything worth knowing about today was behind
 * them. A day at a time is how anybody decides what to back, and it is the
 * same question the challenge asks every evening.
 *
 * It looks like a shelf on purpose. On the challenge page this sits next to
 * the bet waiting to be closed, and the two were the same white card with
 * the same type in it — one is a list of things to choose from, the other is
 * money already on the table, and nothing on screen said which was which.
 * So: a tinted panel with the games as cards inside it, each ending in the
 * arrow that means "there is more behind this one".
 */
export function TopGames({ board }: { board: BoardMatch[] }) {
  const days = useMemo(() => topByDay(board), [board]);
  const [active, setActive] = useState(0);

  if (days.length === 0) return null;

  const day = days[Math.min(active, days.length - 1)];

  return (
    <section className="overflow-hidden rounded-2xl bg-[hsl(var(--sl-surface))] ring-1 ring-border">
      <div className="flex items-start justify-between gap-2 px-4 pb-2.5 pt-3">
        <div className="min-w-0">
          <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">
            Para escolher
          </p>
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Os mais prováveis
          </h2>
        </div>
        <Link
          to="/probability"
          className="sl-meta flex flex-none items-center gap-1 pt-0.5 text-[11px]"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* The same days as the Jogos page, in the same order, so the two
          pages are never one tap out of step with each other. */}
      {days.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-5 pb-2.5">
          {days.map((option, index) => (
            <button
              key={option.long}
              type="button"
              onClick={() => setActive(index)}
              className={`sl-tap flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                index === Math.min(active, days.length - 1)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground ring-1 ring-border"
              }`}
            >
              {option.short}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5 px-2.5 pb-2.5">
        {day.items.map((match, index) => (
          // Into the game itself, with its fifteen markets: the row carries
          // the one number the model is most sure of and no way to ask it
          // anything else.
          <Link
            key={match.fixture_id}
            to={`/match/${match.fixture_id}`}
            className="sl-tap flex items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border transition-colors hover:ring-primary/40"
          >
            <span className="sl-figure flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[hsl(var(--sl-surface))] text-[10px] text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {match.home_name} vs {match.away_name}
              </p>
              <p className="sl-meta truncate text-[11px]">
                {match.league}
                {match.kickoff
                  ? ` · ${timeLabel(new Date(match.kickoff))}`
                  : ""}
              </p>
              {/* A distância para a taxa da liga esteve aqui e saiu: nos
                  jogos já marcados, quanto maior essa distância pior foi o
                  acerto — 64% nos de +10 pp contra 74% nos de menos de +5.
                  No lugar dela fica a única coisa que decide se um acerto
                  vale dinheiro, que é o preço. */}
              {/* Dos destaques do quadro, os da lista curta entraram 87%
                  das vezes e os outros 53%: é a coisa mais útil desta linha
                  e estava escrita a miudinho. */}
              {onShortlist(match) && (
                <span className="sl-pill sl-pill-win mt-0.5 text-[10px]">
                  na lista curta
                </span>
              )}
            </div>
            {/* Capped, because "Casa ou Empate (1X)" is wider than some
                team names and the game is what the row is about. */}
            <div className="max-w-[40%] flex-none text-right">
              <p className="sl-figure sl-hero-figure sl-hero-figure-green text-[13px] text-foreground">
                {match.headline_pct.toFixed(0)}%
              </p>
              <p className="sl-meta truncate text-[10px]">
                {MARKET_LABELS[match.headline_market] ?? match.headline_market}
              </p>
              <p className="sl-meta text-[10px]">
                paga acima de{" "}
                <span className="font-mono-data font-bold text-foreground">
                  {minimumOdd(match.headline_pct).toFixed(2)}
                </span>
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}
