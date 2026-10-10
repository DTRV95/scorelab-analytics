import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarClock } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { timeLabel } from "@/components/TodayMatches";
import type { BoardMatch } from "@/lib/probabilityBoardCache";
import { topByDay } from "@/lib/topGames";

/**
 * The three games the model is surest about, one day at a time.
 *
 * It was the three strongest of the whole week, which on a Monday meant
 * three games on Saturday: everything worth knowing about today was behind
 * them. A day at a time is how anybody decides what to back, and it is the
 * same question the challenge asks every evening.
 */
export function TopGames({ board }: { board: BoardMatch[] }) {
  const days = useMemo(() => topByDay(board), [board]);
  const [active, setActive] = useState(0);

  if (days.length === 0) return null;

  const day = days[Math.min(active, days.length - 1)];

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
          Os mais prováveis
        </h2>
        <Link
          to="/probability"
          className="sl-meta flex items-center gap-1 text-[11px]"
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

      <div className="divide-y divide-border border-t border-border">
        {day.items.map((match, index) => (
          // Into the game itself, with its fifteen markets: the row carries
          // the one number the model is most sure of and no way to ask it
          // anything else.
          <Link
            key={match.fixture_id}
            to={`/match/${match.fixture_id}`}
            className="sl-tap flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[hsl(var(--sl-surface))]"
          >
            <span className="sl-figure w-3 flex-none text-[11px] text-muted-foreground">
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
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
