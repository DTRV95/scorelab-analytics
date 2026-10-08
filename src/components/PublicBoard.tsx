import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { loadBoard } from "@/lib/boardSource";
import {
  readCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";

/**
 * The day's games, with their probabilities, before anybody signs in.
 *
 * The whole point of the app is on this list, and asking for an account to
 * see a number that is the same for everybody was asking for trust before
 * giving any. It is the same board the app itself shows — same request, same
 * cache, same figures — cut to the day being played and rolled over at
 * midnight, so somebody who leaves the page open overnight does not wake up
 * to yesterday.
 */

const DAYS = 7;

function startOfDay(value: Date): number {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

/** Which day a kickoff falls on, counted from today. */
function dayOffset(kickoff: string | null, now: number): number | null {
  if (!kickoff) return null;
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return null;
  return Math.round((startOfDay(date) - now) / 86400000);
}

function hour(kickoff: string | null): string {
  if (!kickoff) return "—";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dayName(offset: number, kickoff: string | null): string {
  if (offset === 0) return "Hoje";
  if (offset === 1) return "Amanhã";
  if (!kickoff) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(kickoff));
}

export function PublicBoard({ limit = 10 }: { limit?: number }) {
  const [matches, setMatches] = useState<BoardMatch[] | null>(
    () => readCachedBoard(DAYS)?.matches ?? null,
  );
  const [failed, setFailed] = useState(false);
  /** Midnight of the day being shown. Moves on its own when the day turns. */
  const [today, setToday] = useState(() => startOfDay(new Date()));

  const load = useCallback(() => {
    setFailed(false);

    // Last night's board, from the database, before the engine — which
    // sleeps, and which somebody who has not even signed up should never be
    // left waiting for. The same cache the app itself uses, so signing up
    // after reading this does not pay for the request twice.
    return loadBoard(DAYS)
      .then((data) => setMatches(data.matches))
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (matches) return;
    void load();
  }, [matches, load]);

  // At midnight the day changes under the page: the list is asked again and
  // the heading moves on by itself.
  useEffect(() => {
    const wait = today + 86400000 + 1000 - Date.now();
    const timer = window.setTimeout(() => {
      setToday(startOfDay(new Date()));
      void load();
    }, Math.max(wait, 1000));

    return () => window.clearTimeout(timer);
  }, [today, load]);

  // Today's games, or — once today is over — the next day that has any. An
  // empty list at eleven at night would be true and useless.
  const withDay = (matches ?? [])
    .map((match) => ({ match, offset: dayOffset(match.kickoff, today) }))
    .filter(
      (entry): entry is { match: BoardMatch; offset: number } =>
        entry.offset !== null && entry.offset >= 0,
    )
    .sort(
      (a, b) =>
        a.offset - b.offset ||
        (a.match.kickoff ?? "").localeCompare(b.match.kickoff ?? ""),
    );

  const offset = withDay[0]?.offset ?? 0;
  const shown = withDay
    .filter((entry) => entry.offset === offset)
    .slice(0, limit)
    .map((entry) => entry.match);

  return (
    <div className="sl-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="relative flex h-2 w-2 flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--sl-green))] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--sl-green))]" />
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-foreground">
          {shown.length > 0
            ? dayName(offset, shown[0].kickoff)
            : "Jogos de hoje"}
        </p>
        <p className="sl-meta flex-none text-[11px]">
          {shown.length > 0 ? "o mercado mais provável" : ""}
        </p>
      </div>

      {!matches && !failed && (
        <p className="sl-meta flex items-center gap-2 px-4 py-6 text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />A ler os jogos...
        </p>
      )}

      {(failed || (matches && shown.length === 0)) && (
        <p className="px-4 py-6 text-[12px] leading-6 text-muted-foreground">
          Não há jogos a chegar neste momento — acontece quando as competições
          estão paradas ou a fonte de dados está a descansar. Volta amanhã: a
          lista troca sozinha à meia-noite.
        </p>
      )}

      {shown.length > 0 && (
        <table className="w-full table-fixed border-collapse text-left">
          <tbody className="divide-y divide-border">
            {shown.map((match) => (
              <tr key={match.fixture_id} className="align-middle">
                <td className="sl-figure w-[4.2rem] px-3 py-2.5 text-[12px] text-muted-foreground sm:w-20 sm:px-4">
                  {hour(match.kickoff)}
                </td>
                <td className="px-1 py-2.5">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {match.home_name}
                  </p>
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    {match.away_name}
                  </p>
                  <p className="sl-meta truncate text-[10.5px]">
                    {match.league}
                  </p>
                </td>
                <td className="w-[7.5rem] px-3 py-2.5 text-right sm:w-44 sm:px-4">
                  {/* Wraps rather than truncates: "Casa ou Empate (…" is the
                      half of the row that says what the number is about. */}
                  <p className="sl-meta text-[10.5px] leading-tight">
                    {MARKET_LABELS[match.headline_market] ??
                      match.headline_market}
                  </p>
                  <p className="font-mono-data text-[16px] font-bold leading-tight text-[hsl(var(--sl-green))]">
                    {match.headline_pct.toFixed(0)}%
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {shown.length > 0 && (
        <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-5">
          Dentro da aplicação são os próximos sete dias, com os quinze mercados
          de cada jogo e o que a liga costuma dar ao lado.
        </p>
      )}
    </div>
  );
}
