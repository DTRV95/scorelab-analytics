import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildApiUrl } from "@/lib/apiConfig";

interface Fixture {
  fixture_id: number;
  kickoff: string | null;
  matchday: number | null;
  home_name: string;
  away_name: string;
}

export interface PrefillValues {
  equipa_casa: string;
  equipa_fora: string;
  jogos_casa: string;
  golos_marcados_casa: string;
  golos_sofridos_casa: string;
  jogos_casa_rec: string;
  golos_marcados_casa_rec: string;
  golos_sofridos_casa_rec: string;
  jogos_fora: string;
  golos_marcados_fora: string;
  golos_sofridos_fora: string;
  jogos_fora_rec: string;
  golos_marcados_fora_rec: string;
  golos_sofridos_fora_rec: string;
  league_home_goals_avg?: string;
  league_away_goals_avg?: string;
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

function formatKickoff(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function MatchPrefill({
  league,
  onPrefill,
}: {
  league: string;
  onPrefill: (values: PrefillValues) => void;
}) {
  const [supported, setSupported] = useState<string[] | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(buildApiUrl("/data/status"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled) setSupported(data?.configured ? data.leagues ?? [] : []);
      })
      .catch(() => {
        if (!cancelled) setSupported([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSupported = Boolean(supported?.includes(league));

  useEffect(() => {
    setFixtures([]);
    setError("");
    setApplied("");
    if (!isSupported) return;

    let cancelled = false;
    setLoadingFixtures(true);

    fetch(buildApiUrl(`/data/fixtures?league=${encodeURIComponent(league)}`))
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.detail || "Falha ao obter jogos.");
        return body;
      })
      .then((data) => {
        if (!cancelled) setFixtures(data.fixtures ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingFixtures(false);
      });

    return () => {
      cancelled = true;
    };
  }, [league, isSupported]);

  if (supported === null || !isSupported) return null;

  const applyFixture = async (fixture: Fixture) => {
    setApplyingId(fixture.fixture_id);
    setError("");
    try {
      const response = await fetch(
        buildApiUrl(
          `/data/prefill?league=${encodeURIComponent(league)}&fixture_id=${fixture.fixture_id}`
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

      onPrefill(values as unknown as PrefillValues);
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
          <p className="text-sm font-semibold text-foreground">
            Preencher automaticamente
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Escolhe um jogo e as estatísticas das equipas são preenchidas com os
            resultados reais da época. Só ficam a faltar as odds.
          </p>
        </div>
        <span className="flex-none rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary ring-1 ring-primary/20">
          Dados reais
        </span>
      </div>

      {loadingFixtures && (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> A carregar jogos...
        </p>
      )}

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}

      {applied && !error && (
        <p className="mt-3 text-xs text-primary">
          Preenchido com {applied}. Confirma os valores e adiciona as odds.
        </p>
      )}

      {!loadingFixtures && !error && fixtures.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Sem jogos agendados nesta competição neste momento.
        </p>
      )}

      {fixtures.length > 0 && (
        <div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto pr-1">
          {fixtures.map((fixture) => (
            <div
              key={fixture.fixture_id}
              className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">
                  {fixture.home_name} vs {fixture.away_name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatKickoff(fixture.kickoff)}
                  {fixture.matchday ? ` · Jornada ${fixture.matchday}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 flex-none gap-1.5 rounded-lg text-xs text-primary hover:bg-primary/10"
                disabled={applyingId !== null}
                onClick={() => applyFixture(fixture)}
              >
                {applyingId === fixture.fixture_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Usar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
