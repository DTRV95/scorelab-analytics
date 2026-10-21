import { useMemo, useState, type ReactNode } from "react";
import { Search, Swords } from "lucide-react";
import { BetSlip } from "@/components/BetSlip";
import { SectionHeader } from "@/components/Section";
import {
  buildHistory,
  byPlayer,
  filterHistory,
  historyTotals,
  type HistoryEntry,
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

/** Sem "em aberto": essas têm aba própria, com o que se lhes pode fazer. */
const OUTCOMES: { key: Outcome; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "ganhas", label: "Ganhas" },
  { key: "perdidas", label: "Perdidas" },
];

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`sl-tap flex-none rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
        on
          ? "bg-primary text-primary-foreground"
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
 * O nome de quem apostou, como cabeçalho do que ele apostou.
 *
 * Em letra pequena por cima de cada boletim, numa lista única, os dois
 * jogadores liam-se como um só — e a pergunta desta secção é exactamente
 * quem escolheu o quê. É o cabeçalho que a lista lado a lado tinha, e a
 * razão por que ela funcionava.
 */
function PlayerGroup({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-baseline gap-2 px-1 text-[13px] font-bold text-foreground">
        {name}
        <span className="sl-meta font-mono-data text-[11px] font-semibold">
          {count}
        </span>
      </p>
      {children}
    </div>
  );
}

/**
 * As apostas deste desafio, em aberto e fechadas, agrupadas por quem as fez.
 *
 * Era isto em dois sítios: as por fechar no topo numa secção âmbar, e as
 * outras aqui, duas por pessoa em linhas de uma linha. Agora são duas abas
 * dentro da secção que já existia, e dentro de cada aba cada jogador tem o
 * seu bloco com o nome por cima.
 */
export function ChallengeBets({
  plan,
  members,
  bets,
  me,
  openBets,
  renderOpen,
  onOpen,
}: {
  plan: PlanRecord;
  members: PlanMember[];
  /** As apostas deste desafio, de toda a gente. */
  bets: PlanBet[];
  /** Quem está a ver. As dela são as únicas que se podem fechar. */
  me: string | null;
  /** As minhas por fechar, já na ordem em que a página as quer mostrar. */
  openBets: PlanBet[];
  /**
   * Como desenhar uma das minhas por fechar.
   *
   * Vem da página em vez de se construir aqui: fechar um nível mexe no
   * marcador, em quem falhou e no que fica guardado, e trazer isso para
   * dentro deste componente era mudar de sítio cem linhas que não têm
   * nada que ver com abas nem com grupos.
   */
  renderOpen: (bet: PlanBet) => ReactNode;
  /** Abrir uma aposta por inteiro, que é onde ela se corrige. */
  onOpen: (bet: PlanBet, player: string) => void;
}) {
  const [tab, setTab] = useState<"abertas" | "fechadas">(() =>
    openBets.length > 0 ? "abertas" : "fechadas",
  );
  const [outcome, setOutcome] = useState<Outcome>("todas");
  const [text, setText] = useState("");

  const history = useMemo(
    () =>
      buildHistory(
        bets.map((bet) => ({ ...bet, planId: plan.id })),
        [plan],
      ),
    [bets, plan],
  );

  /** Os jogadores pela ordem do desafio, comigo à frente. */
  const players = useMemo(
    () =>
      members
        .map((member) => ({ id: member.user_id, name: member.display_name }))
        .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : 0)),
    [members, me],
  );
  const naming = useMemo(
    () => new Map(players.map((player) => [player.id, player.name])),
    [players],
  );

  // Nesta aba só entram as que já fecharam: as outras estão na do lado,
  // com o que se lhes pode fazer.
  const closed = useMemo(
    () => history.filter((entry) => entry.bet.status !== "pending"),
    [history],
  );
  // Sem filtro por pessoa: cada jogador tem o seu bloco com o nome por
  // cima, e uma fila de botões a dizer o mesmo era uma linha a mais num
  // ecrã onde já se escolhe duas vezes antes de chegar às apostas.
  const shown = useMemo(
    () => filterHistory(closed, { outcome, text }),
    [closed, outcome, text],
  );
  const totals = useMemo(() => historyTotals(shown), [shown]);
  const closedByPlayer = useMemo(
    () => byPlayer(shown, players),
    [shown, players],
  );

  /**
   * As que o outro tem por fechar, só para ver.
   *
   * Fechar uma aposta é de quem a fez, por isso estas não trazem botão
   * nenhum além do que as abre. Mas saber em que é que o outro está neste
   * momento é metade da graça de um desafio a dois.
   */
  const theirOpen = useMemo(
    () =>
      byPlayer(
        history.filter(
          (entry) => entry.bet.status === "pending" && entry.bet.userId !== me,
        ),
        players.filter((player) => player.id !== me),
      ),
    [history, me, players],
  );

  if (history.length === 0) return null;

  const openTotal =
    openBets.length +
    theirOpen.reduce((total, group) => total + group.entries.length, 0);

  const abas: { key: "abertas" | "fechadas"; label: string; n: number }[] = [
    { key: "abertas", label: "Em aberto", n: openTotal },
    { key: "fechadas", label: "Fechadas", n: closed.length },
  ];

  const verEcorrigir = (entry: HistoryEntry, label: string) => (
    <button
      type="button"
      onClick={() => onOpen(entry.bet, naming.get(entry.bet.userId) ?? "—")}
      aria-label={`${label} a aposta do nível ${entry.bet.day} de ${
        naming.get(entry.bet.userId) ?? "—"
      }`}
      className="sl-tap w-full border-t border-border py-2.5 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
    >
      {label}
    </button>
  );

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={Swords}
        title="O que cada um escolheu"
        className="border-b border-border px-4 py-3"
      />

      <div
        role="tablist"
        aria-label="Apostas deste desafio"
        className="flex border-b border-border"
      >
        {abas.map((aba) => (
          <button
            key={aba.key}
            type="button"
            role="tab"
            aria-selected={tab === aba.key}
            onClick={() => setTab(aba.key)}
            className={`sl-tap flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-[13px] font-bold transition-colors ${
              tab === aba.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {aba.label}
            <span
              className={`sl-pill flex-none ${
                aba.key === "abertas" && aba.n > 0
                  ? "sl-pill-open"
                  : "sl-pill-muted"
              }`}
            >
              {aba.n}
            </span>
          </button>
        ))}
      </div>

      {tab === "abertas" ? (
        openTotal === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Nada por fechar. A banca já conta tudo o que aqui está.
          </p>
        ) : (
          // Um bloco por jogador, lado a lado no ecrã grande e empilhados
          // no telemóvel. É o arranjo da lista que isto substituiu, com
          // boletins inteiros em vez de linhas de uma linha.
          <div className="grid gap-4 p-3 md:grid-cols-2">
            {openBets.length > 0 && (
              <PlayerGroup
                name={naming.get(me ?? "") ?? "As tuas"}
                count={openBets.length}
              >
                {openBets.map((bet) => (
                  <div key={bet.id}>{renderOpen(bet)}</div>
                ))}
              </PlayerGroup>
            )}
            {theirOpen.map((group) => (
              <PlayerGroup
                key={group.id}
                name={group.name}
                count={group.entries.length}
              >
                {group.entries.map((entry) => (
                  <BetSlip
                    key={entry.bet.id}
                    bet={entry.bet}
                    above={`Nível ${entry.bet.day}`}
                    action={verEcorrigir(entry, "Ver")}
                  />
                ))}
              </PlayerGroup>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="space-y-2 border-b border-border px-4 py-3">
            {/* Dois por linha no telemóvel, quatro no ecrã grande. A quatro
                num telefone, "+11,92 €" ficava "+11,9…" — um número
                cortado diz menos do que nenhum. */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 sm:items-end">
              <Figure label="Apostas" value={String(totals.bets)} />
              <Figure
                label="Acerto"
                value={totals.winPct === null ? "—" : pct(totals.winPct)}
              />
              <Figure
                label="Lucro"
                value={`${totals.profit >= 0 ? "+" : ""}${eur.format(
                  totals.profit,
                )}`}
                tone={totals.profit >= 0 ? "good" : "bad"}
              />
              <Figure
                // A casa decimal só enquanto couber e disser alguma coisa:
                // entre 0,7% e 1% vai uma decisão, entre 100% e 100,0% não
                // vai nada.
                label="Retorno"
                value={
                  totals.roi === null
                    ? "—"
                    : pct(totals.roi, Math.abs(totals.roi) < 10 ? 1 : 0)
                }
                tone={
                  totals.roi === null
                    ? undefined
                    : totals.roi >= 0
                      ? "good"
                      : "bad"
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
          </div>

          {shown.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhuma aposta corresponde a isto.
            </p>
          ) : (
            <div className="grid gap-4 p-3 md:grid-cols-2">
              {closedByPlayer.map((group) => (
                <PlayerGroup
                  key={group.id}
                  name={group.name}
                  count={group.entries.length}
                >
                  {group.entries.map((entry) => (
                    <BetSlip
                      key={entry.bet.id}
                      bet={entry.bet}
                      above={`Nível ${entry.bet.day}`}
                      action={verEcorrigir(entry, "Ver e corrigir")}
                    />
                  ))}
                </PlayerGroup>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
