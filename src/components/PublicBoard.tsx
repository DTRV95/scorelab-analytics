import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { buildApiUrl } from "@/lib/apiConfig";
import {
  readCachedBoard,
  writeCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";

/**
 * The games, with their probabilities, before anybody signs in.
 *
 * The whole point of the app is on this list, and asking for an account to
 * see a number that is the same for everybody was asking for trust before
 * giving any. It is the same board the app itself shows — same request, same
 * cache, same figures — only shorter.
 */

const DAYS = 7;

function kickoff(at: string | null): string {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";

  const midnight = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((midnight(date) - midnight(new Date())) / 86400000);
  const time = new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (days === 0) return `hoje ${time}`;
  if (days === 1) return `amanhã ${time}`;
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
    .format(date)
    .replace(".", "");
}

export function PublicBoard({ limit = 6 }: { limit?: number }) {
  const [matches, setMatches] = useState<BoardMatch[] | null>(
    () => readCachedBoard(DAYS)?.matches ?? null,
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (matches) return;

    let live = true;
    const controller = new AbortController();

    fetch(buildApiUrl(`/data/probability-board?days=${DAYS}`), {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("sem resposta");
        return response.json();
      })
      .then((data: { matches?: BoardMatch[]; unavailable?: string[]; skipped?: number }) => {
        if (!live) return;
        const found = data.matches ?? [];
        setMatches(found);
        // The same cache the app uses, so somebody who signs up after
        // reading this does not pay for the same request twice.
        writeCachedBoard({
          days: DAYS,
          matches: found,
          unavailable: data.unavailable ?? [],
          skipped: data.skipped ?? 0,
        });
      })
      .catch(() => {
        if (live) setFailed(true);
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [matches]);

  const shown = (matches ?? []).slice(0, limit);

  return (
    <div className="sl-card overflow-hidden">
      <div className="flex items-start gap-2 border-b border-border px-4 py-3">
        <span className="relative mt-1.5 flex h-2 w-2 flex-none">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[hsl(var(--sl-green))] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[hsl(var(--sl-green))]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-foreground">
            Probabilidades de agora
          </p>
          <p className="sl-meta text-[11px]">
            O mercado mais provável de cada jogo, sem conta nenhuma.
          </p>
        </div>
      </div>

      {!matches && !failed && (
        <p className="sl-meta flex items-center gap-2 px-4 py-6 text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />A ler os jogos...
        </p>
      )}

      {(failed || (matches && shown.length === 0)) && (
        <p className="px-4 py-6 text-[12px] leading-6 text-muted-foreground">
          Os jogos não estão a chegar neste momento — acontece quando as
          competições estão paradas ou a fonte de dados está a descansar.
          Dentro da aplicação é a mesma lista, com tudo o resto à volta.
        </p>
      )}

      {shown.length > 0 && (
        <ul className="divide-y divide-border">
          {shown.map((match) => (
            <li
              key={match.fixture_id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">
                  {match.home_name} vs {match.away_name}
                </p>
                <p className="sl-meta truncate text-[11px]">
                  {match.league}
                  {match.kickoff ? ` · ${kickoff(match.kickoff)}` : ""}
                </p>
              </div>
              <div className="flex-none text-right">
                <p className="sl-meta text-[10.5px] leading-tight">
                  {MARKET_LABELS[match.headline_market] ??
                    match.headline_market}
                </p>
                <p className="font-mono-data text-[15px] font-bold leading-tight text-[hsl(var(--sl-green))]">
                  {match.headline_pct.toFixed(0)}%
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {shown.length > 0 && (
        <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-5">
          Dentro da aplicação são todos os jogos dos próximos sete dias, com os
          quinze mercados de cada um e o que a liga costuma dar ao lado.
        </p>
      )}
    </div>
  );
}
