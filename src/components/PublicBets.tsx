import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { placedAgo, type PublicBet } from "@/lib/publicBets";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

function Result({ bet }: { bet: PublicBet["bet"] }) {
  if (bet.status === "pending") {
    return <span className="sl-pill sl-pill-open text-[10px]">Em aberto</span>;
  }

  const won = bet.status === "green";
  return (
    <span
      className={`sl-pill text-[10px] ${won ? "sl-pill-win" : "sl-pill-loss"}`}
    >
      {won ? "+" : ""}
      {eur.format(bet.profitLoss)}
    </span>
  );
}

/**
 * What everybody else is betting.
 *
 * Only from challenges somebody chose to open up — the server hands over
 * nothing else, and this asks for nothing else. Whoever is looking sees the
 * others: their own bets are on every other page already.
 */
export function PublicBets({
  entries,
  mineArePrivate,
}: {
  entries: PublicBet[];
  /** True when this person has no challenge open to anybody, to say so once. */
  mineArePrivate: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="sl-card px-4 py-4">
        <p className="text-[12.5px] leading-6 text-foreground">
          Ainda não há apostas de mais ninguém para ver.
        </p>
        <p className="sl-meta mt-1.5 text-[12px] leading-6">
          Só aparecem aqui as apostas de desafios que alguém abriu a toda a
          gente. {mineArePrivate ? "Os teus estão todos fechados — abres um em Regras deste desafio, no botão de visibilidade." : "Os teus já estão abertos; falta alguém do outro lado."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="sl-meta flex items-center gap-1.5 px-1 text-[11px] leading-5">
        <Eye className="h-3 w-3 flex-none" />
        Apostas de desafios abertos a toda a gente, as mais recentes primeiro.
      </p>

      {entries.map((entry) => (
        <article key={entry.bet.id} className="sl-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">
                {entry.name}
              </p>
              <p className="sl-meta truncate text-[11px]">
                <Link
                  to={`/desafios/${entry.planId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {entry.planName}
                </Link>
                {" · "}
                nível {entry.bet.day} · {placedAgo(entry.bet.placedAt)}
              </p>
            </div>
            <Result bet={entry.bet} />
          </div>

          <div className="divide-y divide-border">
            {entry.bet.legs.map((leg, index) => (
              <div
                key={`${entry.bet.id}-${index}`}
                className="flex items-center gap-3 px-4 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-foreground">
                    {leg.homeTeam} vs {leg.awayTeam}
                  </p>
                  <p className="sl-meta truncate text-[11px]">
                    {MARKET_LABELS[leg.market] ?? leg.market}
                    {leg.league && leg.league !== "Adicionado à mão"
                      ? ` · ${leg.league}`
                      : ""}
                  </p>
                </div>
                <span className="sl-figure flex-none text-[13px] text-foreground">
                  {leg.odds.toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
            <span className="sl-meta text-[11px]">
              {entry.bet.legs.length === 1
                ? "1 jogo"
                : `${entry.bet.legs.length} jogos`}{" "}
              · {eur.format(entry.bet.stake)}
            </span>
            <span className="sl-figure text-[14px] text-foreground">
              {entry.bet.odds.toFixed(2)}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
