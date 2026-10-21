import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import { BetSlip } from "@/components/BetSlip";
import { SectionHeader } from "@/components/Section";
import {
  buildHistory,
  byMonth,
  filterHistory,
  historyTotals,
  type Outcome,
} from "@/lib/betHistory";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** Uma percentagem como se escreve em português, com vírgula. */
const pct = (value: number, casas = 0) =>
  `${value.toFixed(casas).replace(".", ",")}%`;

const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "ganhas", label: "Ganhas" },
  { key: "perdidas", label: "Perdidas" },
  { key: "abertas", label: "Em aberto" },
];

function Pill({
  on,
  dark,
  onClick,
  children,
}: {
  on: boolean;
  dark?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        on
          ? dark
            ? "bg-foreground text-background"
            : "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="sl-meta text-[10px] uppercase tracking-[0.13em]">{label}</p>
      <p
        className={`sl-figure truncate text-[17px] leading-6 ${
          tone === "good"
            ? "text-[hsl(var(--sl-green))]"
            : tone === "bad"
              ? "text-destructive"
              : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * O histórico deste desafio, dentro do desafio.
 *
 * A página já mostrava os dois últimos níveis de cada jogador, lado a lado,
 * e um botão que abria mais quarenta em linhas de uma linha. Isso responde a
 * "quem vai à frente", que é outra pergunta: não se procura, não se filtra,
 * e um boletim de três jogos fica reduzido a um nome e um "+2".
 *
 * Aqui os boletins são boletins — abrem-se e mostram cada jogo, o preço a
 * que entrou e o que fez. Procura-se por equipa, mercado ou competição, e as
 * contas no topo são as do que está filtrado, porque é essa a pergunta por
 * que se filtra: "e nisto, como é que me tenho saído?".
 */
export function ChallengeHistory({
  plan,
  members,
  bets,
  me,
  onOpen,
}: {
  plan: PlanRecord;
  members: PlanMember[];
  /** As apostas deste desafio, de toda a gente. */
  bets: PlanBet[];
  /** Quem está a ver, para a lista abrir nas apostas dela. */
  me: string | null;
  /**
   * Abrir uma aposta por inteiro, que é onde ela se corrige.
   *
   * O cartão lado a lado mostrava dois níveis por pessoa e tinha um botão
   * que abria o resto; era de lá que se chegava a uma aposta antiga para a
   * reabrir ou corrigir. Esse botão passou a ser este histórico, e sem isto
   * uma aposta de há três semanas deixava de se poder tocar.
   */
  onOpen: (bet: PlanBet, player: string) => void;
}) {
  const [outcome, setOutcome] = useState<Outcome>("todas");
  const [userId, setUserId] = useState<string | null>(me);
  const [text, setText] = useState("");

  const history = useMemo(
    () =>
      buildHistory(
        bets.map((bet) => ({ ...bet, planId: plan.id })),
        [plan],
      ),
    [bets, plan],
  );

  const shown = useMemo(
    () => filterHistory(history, { userId, outcome, text }),
    [history, userId, outcome, text],
  );
  const totals = useMemo(() => historyTotals(shown), [shown]);
  const months = useMemo(() => byMonth(shown), [shown]);

  const naming = useMemo(
    () => new Map(members.map((member) => [member.user_id, member.display_name])),
    [members],
  );

  if (history.length === 0) return null;

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={History}
        title="Histórico"
        className="border-b border-border px-4 py-3"
      />

      <div className="space-y-2 border-b border-border px-4 py-3">
        <div className="flex items-end gap-3">
          <Figure label="Apostas" value={String(totals.bets)} />
          <Figure
            label="Acerto"
            value={totals.winPct === null ? "—" : pct(totals.winPct)}
          />
          <Figure
            label="Lucro"
            value={`${totals.profit >= 0 ? "+" : ""}${eur.format(totals.profit)}`}
            tone={totals.profit >= 0 ? "good" : "bad"}
          />
          <Figure
            // A casa decimal só enquanto couber e disser alguma coisa: entre
            // 0,7% e 1% vai uma decisão, entre 100% e 100,0% não vai nada.
            label="Retorno"
            value={
              totals.roi === null
                ? "—"
                : pct(totals.roi, Math.abs(totals.roi) < 10 ? 1 : 0)
            }
            tone={
              totals.roi === null ? undefined : totals.roi >= 0 ? "good" : "bad"
            }
          />
        </div>

        <label className="sl-field flex items-center gap-2 px-3">
          <Search className="h-4 w-4 flex-none text-muted-foreground" />
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Equipa, mercado, competição…"
            aria-label="Procurar no histórico do desafio"
            className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </label>

        <div className="sl-scroll-x flex gap-1.5">
          {OUTCOMES.map((entry) => (
            <Pill
              key={entry.key}
              on={outcome === entry.key}
              onClick={() => setOutcome(entry.key)}
            >
              {entry.label}
            </Pill>
          ))}
        </div>

        {/* Só quando o desafio tem mais do que uma pessoa: um filtro com uma
            escolha é uma pastilha a ocupar a linha. */}
        {members.length > 1 && (
          <div className="sl-scroll-x flex gap-1.5">
            <Pill dark on={userId === null} onClick={() => setUserId(null)}>
              Os dois
            </Pill>
            {members.map((member) => (
              <Pill
                key={member.user_id}
                dark
                on={userId === member.user_id}
                onClick={() => setUserId(member.user_id)}
              >
                {member.display_name}
              </Pill>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          Nenhuma aposta corresponde a isto.
        </p>
      ) : (
        <div className="space-y-2 p-3">
          {months.map((month) => (
            <div key={month.label} className="space-y-2">
              <h3 className="sl-meta px-1 pt-1 text-[10px] uppercase tracking-[0.16em]">
                {month.label} · {month.entries.length}
              </h3>
              {month.entries.map((entry) => (
                <BetSlip
                  key={entry.bet.id}
                  bet={entry.bet}
                  action={
                    <button
                      type="button"
                      onClick={() =>
                        onOpen(
                          entry.bet,
                          naming.get(entry.bet.userId) ?? "—",
                        )
                      }
                      aria-label={`Ver e corrigir a aposta do nível ${
                        entry.bet.day
                      } de ${naming.get(entry.bet.userId) ?? "—"}`}
                      className="sl-tap w-full border-t border-border py-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      Ver e corrigir
                    </button>
                  }
                  // Quem apostou só quando há mais do que um: dentro de um
                  // desafio de uma pessoa, o nome dela em todas as linhas é
                  // uma palavra que não decide nada.
                  above={[
                    `Nível ${entry.bet.day}`,
                    members.length > 1
                      ? (naming.get(entry.bet.userId) ?? "—")
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
