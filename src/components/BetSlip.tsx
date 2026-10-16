import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Clock, PenLine, X } from "lucide-react";
import { marketFamily, pickLabel, slipKind } from "@/lib/betSlip";
import { isManualLeg, type PlanBet } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const TONE = {
  green: "text-[hsl(var(--sl-green))]",
  red: "text-destructive",
  pending: "text-amber-700",
} as const;

const ICON = { green: Check, red: X, pending: Clock } as const;

const PILL = {
  green: "sl-pill-win",
  red: "sl-pill-loss",
  pending: "sl-pill-open",
} as const;

const SAID = { green: "Ganhou", red: "Perdeu", pending: "Por decidir" } as const;

/**
 * The strip down the left edge, in the colour of where the bet stands.
 *
 * A page of these was a stack of identical white cards: a bet waiting for a
 * result, one waiting for somebody to say what happened, and one already
 * won read exactly the same from arm's length. The colour is the first
 * thing seen and the last thing read, so it carries the state.
 */
const RAIL = {
  green: "border-l-[hsl(var(--sl-green))]",
  red: "border-l-destructive",
  pending: "border-l-amber-500",
} as const;

function when(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * One bet, as a slip.
 *
 * The registered bets were three lines of small print each, stacked inside a
 * single card with a hairline between them — which is exactly how a page of
 * separate bets comes to look like the legs of one big multiple. A slip has
 * edges of its own: what kind of bet it is and what it cost at the top, one
 * block per game in the middle, and what it pays at the bottom.
 */
export function BetSlip({
  bet,
  /**
   * Fechado, salvo ordem em contrário.
   *
   * Abertos, três boletins são três ecrãs: a lista de apostas deixa de se
   * poder correr com o polegar para ver o que há. Fechado, cada um diz o
   * que é numa linha — que tipo de aposta, quanto, em que pé está e em que
   * jogos — e abre-se o que interessar.
   */
  defaultOpen = false,
  /** A line above the kind — the level inside a challenge, whose bet it is. */
  above,
  /** Whatever this bet can be done to, under the money. */
  action,
  /** What the pill says, when "por decidir" is not the useful half of it. */
  state,
}: {
  bet: PlanBet;
  defaultOpen?: boolean;
  above?: ReactNode;
  action?: ReactNode;
  state?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const returned = bet.stake * bet.odds;
  const kind = slipKind(bet.legs.length);
  // Fechado, o boletim tem uma linha para dizer que apostas são. Os nomes
  // todos separados por pontos davam "FC Porto vs Casa Pia · Arsenal vs
  // Bren..." — o primeiro jogo e quantos mais cabem, e dizem mais.
  const names = bet.legs.length
    ? `${bet.legs[0].match}${
        bet.legs.length > 1 ? ` +${bet.legs.length - 1}` : ""
      }`
    : "";

  return (
    <article className={`sl-card overflow-hidden border-l-[3px] ${RAIL[bet.status]}`}>
      <button
        type="button"
        onClick={() => setOpen((shown) => !shown)}
        aria-expanded={open}
        className="sl-tap block w-full px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            {(above || open) && (
              <p className="sl-meta text-[10.5px]">
                {[above, open ? when(bet.placedAt) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <p className="flex items-baseline gap-2 text-[13.5px] font-bold text-foreground">
              {kind}
              <span className="sl-figure text-[13.5px] font-bold text-foreground">
                {eur.format(bet.stake)}
              </span>
            </p>
          </div>

          <span className={`sl-pill flex-none text-[11px] ${PILL[bet.status]}`}>
            {state ?? SAID[bet.status]}
          </span>
          <ChevronDown
            className={`h-4 w-4 flex-none text-muted-foreground transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>

        {/* Fechado, o cartão tem de dizer que aposta é: o dia e os jogos.
            Esta linha tem a largura toda — espremida ao lado da pastilha
            dava "FC Porto..." e mais nada. */}
        {!open && (
          <p className="sl-meta mt-0.5 truncate text-[11px]">
            {when(bet.placedAt)}
            {names ? ` · ${names}` : ""}
          </p>
        )}
      </button>

      {open && (
        <>
          <div className="divide-y divide-border border-t border-border">
            {bet.legs.map((leg, index) => {
              const Icon = ICON[leg.status];
              const pick = pickLabel(leg);
              // A família do mercado só serve quando a escolha é o nome de
              // uma equipa e mais nada: "Ajax" precisa do "Resultado final"
              // para não ser só um nome, "Frosinone ou Empate" e "Mais de
              // 2.5 Golos" dizem-se a si próprios.
              const family = marketFamily(leg.market);
              const onlyTeam =
                pick === (leg.homeTeam || "") || pick === (leg.awayTeam || "");
              const kind =
                onlyTeam && family.toLowerCase() !== pick.toLowerCase()
                  ? family
                  : "";

              return (
                <div
                  key={`${bet.id}-${leg.fixtureId ?? "m"}-${index}`}
                  className="flex items-start gap-2.5 px-4 py-2.5"
                >
                  <Icon
                    className={`mt-0.5 h-3.5 w-3.5 flex-none ${TONE[leg.status]}`}
                  />

                  {/* Duas linhas, não cinco. Eram o mercado, a família do
                      mercado, a equipa de casa e a de fora, cada uma na sua
                      linha — e um boletim de dois jogos enchia o ecrã. O
                      nome do mercado já diz quem é ("Frosinone ou Empate"),
                      por isso o que falta cabe todo na linha de baixo. */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-5 text-foreground">
                      {pick}
                    </p>
                    <p className="sl-meta truncate text-[11px] leading-4">
                      {[
                        kind,
                        [leg.homeTeam || leg.match, leg.awayTeam]
                          .filter(Boolean)
                          .join(" – "),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      {isManualLeg(leg) && (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          <PenLine className="h-2.5 w-2.5" />à mão
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-none items-center gap-2">
                    {leg.score && (
                      <span className="sl-pill sl-pill-muted text-[10px]">
                        {leg.score.homeGoals}-{leg.score.awayGoals}
                      </span>
                    )}
                    <span className="sl-figure text-[13.5px] text-foreground">
                      {leg.odds.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* As contas numa linha, não em três. Montante, odd e retorno são
              a mesma frase: cinco euros a 1.93 dão 9,65 €. Em três linhas
              com rótulo cada uma ocupavam mais espaço do que os jogos. */}
          <dl className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
            <div className="min-w-0">
              <dt className="sr-only">Montante apostado</dt>
              <dd className="sl-meta text-[11.5px]">
                <span className="sl-figure text-[12.5px] text-foreground">
                  {eur.format(bet.stake)}
                </span>
                {bet.legs.length > 1 && (
                  <>
                    {" a "}
                    <span className="sl-figure text-[12.5px] text-foreground">
                      {bet.odds.toFixed(2)}
                    </span>
                  </>
                )}
                {bet.settledAt ? ` · fechada a ${when(bet.settledAt)}` : ""}
              </dd>
            </div>

            <div className="flex flex-none items-baseline gap-1.5">
              <dt className="sl-meta text-[11.5px]">
                {bet.status === "pending" ? "Se entrar" : "Ganhos"}
              </dt>
              <dd className={`sl-figure text-[16px] ${TONE[bet.status]}`}>
                {bet.status === "red" ? eur.format(0) : eur.format(returned)}
              </dd>
            </div>
          </dl>

        </>
      )}

      {/* O que se pode fazer à aposta fica à vista mesmo com o boletim
          fechado: numa lista chamada "por fechar", fechá-la não devia
          custar um toque a mais para abrir o que já se sabe o que é. */}
      {action}
    </article>
  );
}
