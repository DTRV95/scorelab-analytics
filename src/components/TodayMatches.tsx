import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";

interface BoardMatch {
  fixture_id: number;
  kickoff: string | null;
  matchday: number | null;
  home_name: string;
  away_name: string;
  league: string;
}

const STAT_FIELDS = [
  "jogos_casa",
  "golos_marcados_casa",
  "golos_sofridos_casa",
  "jogos_casa_rec",
  "golos_marcados_casa_rec",
  "golos_sofridos_casa_rec",
  "jogos_fora",
  "golos_marcados_fora",
  "golos_sofridos_fora",
  "jogos_fora_rec",
  "golos_marcados_fora_rec",
  "golos_sofridos_fora_rec",
] as const;

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  if (dayKey(date) === dayKey(today)) return "Hoje";
  if (dayKey(date) === dayKey(tomorrow)) return "Amanhã";

  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function TodayMatches({
  onSelect,
}: {
  onSelect: (league: string, values: Record<string, string>) => void;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [matches, setMatches] = useState<BoardMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(buildApiUrl("/data/status"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setEnabled(Boolean(data?.configured));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch(buildApiUrl("/data/today?days=7"))
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.detail || "Falha ao obter jogos.");
        return body;
      })
      .then((data) => {
        if (!cancelled) setMatches(data.matches ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadToken]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { label: string; items: BoardMatch[] }>();

    matches.forEach((match) => {
      if (!match.kickoff) return;
      const date = new Date(match.kickoff);
      if (Number.isNaN(date.getTime())) return;
      const key = dayKey(date);
      if (!groups.has(key)) groups.set(key, { label: dayLabel(date), items: [] });
      groups.get(key)!.items.push(match);
    });

    return [...groups.values()];
  }, [matches]);

  if (enabled === null || enabled === false) return null;

  const applyMatch = async (match: BoardMatch) => {
    setApplyingId(match.fixture_id);
    setError("");
    try {
      const response = await fetch(
        buildApiUrl(
          `/data/prefill?league=${encodeURIComponent(match.league)}&fixture_id=${match.fixture_id}`
        )
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.detail || "Falha ao preencher.");

      const values: Record<string, string> = {
        equipa_casa: String(data.equipa_casa ?? ""),
        equipa_fora: String(data.equipa_fora ?? ""),
      };
      STAT_FIELDS.forEach((field) => {
        values[field] = String(data[field] ?? "");
      });
      if (data.league_averages) {
        values.league_home_goals_avg = String(
          data.league_averages.league_home_goals_avg
        );
        values.league_away_goals_avg = String(
          data.league_averages.league_away_goals_avg
        );
      }

      onSelect(match.league, values);
      setApplied(`${data.equipa_casa} vs ${data.equipa_fora}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-[linear-gradient(180deg,rgba(34,211,238,0.06),rgba(255,255,255,0.02))] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" strokeWidth={1.7} />
            Jogos do Dia
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Escolhe um jogo e as estatísticas das equipas são preenchidas com os
            resultados reais da época. Só ficam a faltar as odds.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 flex-none rounded-lg text-muted-foreground hover:text-foreground"
          title="Atualizar lista"
          disabled={loading}
          onClick={() => setReloadToken((token) => token + 1)}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {applied && !error && (
        <p className="mt-3 text-xs text-primary">
          Preenchido com {applied}. Confirma os valores e adiciona as odds.
        </p>
      )}

      {loading && matches.length === 0 && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> A procurar jogos...
        </p>
      )}

      {!loading && !error && matches.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Sem jogos agendados nos próximos dias nas competições com dados
          automáticos. Escolhe a liga em baixo e preenche manualmente.
        </p>
      )}

      {grouped.length > 0 && (
        <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
          {grouped.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary/70">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.items.map((match) => {
                  const date = match.kickoff ? new Date(match.kickoff) : null;
                  return (
                    <div
                      key={match.fixture_id}
                      className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {match.home_name} vs {match.away_name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {date ? timeLabel(date) : ""} · {match.league}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 flex-none gap-1.5 rounded-lg text-xs text-primary hover:bg-primary/10"
                        disabled={applyingId !== null}
                        onClick={() => applyMatch(match)}
                      >
                        {applyingId === match.fixture_id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Analisar
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
