import { useCallback, useEffect, useState } from "react";
import { Loader2, Plug } from "lucide-react";
import {
  fetchLeaguesHealth,
  type LeagueHealth,
} from "@/lib/leagueReport";

const STATE_LABEL: Record<LeagueHealth["state"], string> = {
  lida: "a responder",
  "por-ler": "ainda não pedida",
  vazia: "sem jogos",
  falhou: "não respondeu",
};

const STATE_TONE: Record<LeagueHealth["state"], string> = {
  lida: "bg-[hsl(var(--sl-green))]",
  "por-ler": "bg-muted-foreground/40",
  vazia: "bg-muted-foreground/40",
  falhou: "bg-destructive",
};

function Row({ row }: { row: LeagueHealth }) {
  return (
    // The state on the first line with the name, and the detail on its own
    // line: side by side on a phone, the sentence that matters is the one that
    // gets cut.
    <div className="px-4 py-2">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`h-2 w-2 flex-none rounded-full ${STATE_TONE[row.state]}`}
        />
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">
          {row.league}
        </p>
        <span className="sl-meta flex-none text-[10px] uppercase tracking-[0.08em]">
          {STATE_LABEL[row.state]}
        </span>
      </div>
      <p className="sl-meta mt-0.5 pl-4 text-[11px] leading-5">
        {row.state === "lida"
          ? `${row.played} jogos disputados · ${row.upcoming} por jogar`
          : row.state === "falhou"
            ? (row.detail ?? "sem resposta")
            : row.state === "vazia"
              ? "respondeu, mas sem jogos nenhuns"
              : "o motor só a vai buscar quando precisar dela"}
      </p>
    </div>
  );
}

/**
 * Whether the data behind all of this is actually arriving, competition by
 * competition.
 *
 * The provider allows ten calls a minute and the board wants one per
 * competition, so a cold start always leaves one out — and from the outside
 * that is indistinguishable from a competition that is broken, or not included
 * in the plan. This says which it is.
 *
 * It costs nothing to open: the server answers from what it already holds.
 * "Verificar as que faltam" is the one that spends requests, one per
 * competition never read, which is why it is a button and not the default.
 */
export function LeaguesHealth() {
  const [rows, setRows] = useState<LeagueHealth[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback((probe: boolean) => {
    if (probe) setProbing(true);
    else setLoading(true);
    setError(false);

    fetchLeaguesHealth(probe)
      .then(setRows)
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false);
        setProbing(false);
      });
  }, []);

  useEffect(() => load(false), [load]);

  const missing = (rows ?? []).filter((row) => row.state === "por-ler").length;

  return (
    <section className="sl-card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Plug className="h-3.5 w-3.5 flex-none text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-semibold text-foreground">
            Estado da ligação
          </h2>
          <p className="sl-meta text-[11px]">
            O que a fonte de dados está mesmo a dar, competição a competição.
          </p>
        </div>
      </div>

      {loading && (
        <p className="sl-meta flex items-center gap-2 px-4 py-3 text-[12px]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />A perguntar ao motor...
        </p>
      )}

      {error && !loading && (
        <p className="px-4 py-3 text-[12px] text-foreground">
          O motor não respondeu. É o mesmo motor que serve os jogos, por isso
          sem ele nada disto funciona.
        </p>
      )}

      {rows && !loading && (
        <>
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <Row key={row.league} row={row} />
            ))}
          </div>

          <div className="border-t border-border px-4 py-3">
            {missing > 0 ? (
              <>
                <button
                  type="button"
                  disabled={probing}
                  onClick={() => load(true)}
                  className="sl-tap rounded-lg px-3 py-1.5 text-[11px] font-semibold text-primary ring-1 ring-border disabled:opacity-50"
                >
                  {probing
                    ? "A verificar..."
                    : `Verificar as ${missing} que faltam`}
                </button>
                <p className="sl-meta mt-2 text-[11px] leading-5">
                  Ainda não pedida não quer dizer avariada: o motor só vai
                  buscar uma competição quando precisa dela. Verificar gasta um
                  pedido por competição, e a fonte só permite dez por minuto.
                </p>
              </>
            ) : (
              <p className="sl-meta text-[11px] leading-5">
                Todas as competições já foram lidas nesta sessão do motor.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
