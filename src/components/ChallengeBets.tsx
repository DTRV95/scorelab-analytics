import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search, Swords } from "lucide-react";
import { SectionHeader } from "@/components/Section";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { canonicalMarket } from "@/lib/marketNames";
import {
  buildHistory,
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

/** Sem "em aberto": essas têm aba própria. */
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
 * Uma aposta numa linha, que é como esta secção sempre se leu melhor.
 *
 * Esteve aqui, durante uns dias, um boletim inteiro por aposta: o nome
 * do jogador outra vez por dentro, três filas de botões, e duas apostas
 * a ocuparem um ecrã. Para responder a "quem escolheu o quê" isso é pior
 * do que uma linha — e fechar um nível continua a fazer-se onde sempre
 * se fez, ao abrir a aposta.
 */
function BetRow({
  bet,
  player,
  onOpen,
}: {
  bet: PlanBet;
  player: string;
  onOpen: () => void;
}) {
  const first = bet.legs[0];
  const titulo =
    bet.legs.length === 1
      ? (first?.match ?? "—")
      : `${first?.match ?? "—"} + ${bet.legs.length - 1}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      // "Ver e corrigir", porque é isso que a linha abre: o diálogo lê a
      // aposta inteira e deixa mudar-lhe a odd, os jogos e o desfecho.
      aria-label={`Ver e corrigir a aposta do nível ${bet.day} de ${player}`}
      className="sl-tap flex w-full items-center gap-2.5 rounded-2xl bg-[hsl(var(--sl-surface))] px-3 py-2.5 text-left hover:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">
          {titulo}
        </p>
        <p className="sl-meta truncate text-[11px]">
          Nível {bet.day} ·{" "}
          {bet.legs.length === 1 && first
            ? (MARKET_LABELS[first.market] ?? canonicalMarket(first.market))
            : `${bet.legs.length} jogos`}{" "}
          @ {bet.odds.toFixed(2)}
        </p>
      </div>
      <span
        className={`sl-pill flex-none ${
          bet.status === "green"
            ? "sl-pill-win"
            : bet.status === "red"
              ? "sl-pill-loss"
              : "sl-pill-open"
        }`}
      >
        {bet.status === "green"
          ? `+${bet.profitLoss.toFixed(2)}`
          : bet.status === "red"
            ? bet.profitLoss.toFixed(2)
            : "aberta"}
      </span>
      <ChevronRight className="h-3.5 w-3.5 flex-none text-muted-foreground" />
    </button>
  );
}

/**
 * Quantas se mostram antes de ser preciso pedir mais.
 *
 * Um desafio de trinta níveis punha trinta linhas por jogador em cima
 * de quem só queria ver as últimas, e o jogador seguinte ficava a um
 * ecrã e meio de distância — numa secção que existe para comparar os
 * dois lado a lado. Quatro são as últimas quatro, que é o que se olha;
 * o resto fica a um toque.
 */
const PRIMEIRAS = 4;

/** A coluna de um jogador: o nome em cima, as apostas dele por baixo. */
function PlayerColumn({
  name,
  bets,
  onOpen,
  renderActions,
}: {
  name: string;
  bets: PlanBet[];
  onOpen: (bet: PlanBet, player: string) => void;
  /** O que se pode fazer a esta aposta sem a abrir. Só às minhas. */
  renderActions?: (bet: PlanBet) => ReactNode;
}) {
  const [todas, setTodas] = useState(false);
  const escondidas = Math.max(0, bets.length - PRIMEIRAS);
  const lista = todas ? bets : bets.slice(0, PRIMEIRAS);

  return (
    <div className="bg-card p-4">
      <p className="text-[13px] font-semibold text-foreground">{name}</p>
      <div className="mt-2 space-y-1.5">
        {lista.map((bet) => (
          <div key={bet.id} className="space-y-1">
            <BetRow bet={bet} player={name} onOpen={() => onOpen(bet, name)} />
            {renderActions?.(bet)}
          </div>
        ))}
        {bets.length === 0 && (
          <p className="sl-meta text-[11px]">Nada aqui.</p>
        )}

        {escondidas > 0 && (
          <button
            type="button"
            onClick={() => setTodas((aberto) => !aberto)}
            aria-expanded={todas}
            className="sl-tap flex w-full items-center justify-center gap-1.5 rounded-2xl px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {todas
              ? "Mostrar menos"
              : `Mostrar mais ${escondidas} ${
                  escondidas === 1 ? "aposta" : "apostas"
                }`}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${
                todas ? "rotate-180" : ""
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * As apostas deste desafio, em aberto e fechadas, uma coluna por jogador.
 *
 * Duas abas, que é o que separa "o que está por decidir" de "o que já
 * aconteceu", e dentro de cada uma o arranjo de sempre: cada jogador na
 * sua coluna, cada aposta na sua linha.
 */
export function ChallengeBets({
  plan,
  members,
  bets,
  me,
  onOpen,
  renderActions,
}: {
  plan: PlanRecord;
  members: PlanMember[];
  /** As apostas deste desafio, de toda a gente. */
  bets: PlanBet[];
  /** Quem está a ver, para ficar com a primeira coluna. */
  me: string | null;
  /** Abrir uma aposta: é lá que ela se lê inteira. */
  onOpen: (bet: PlanBet, player: string) => void;
  /**
   * Fechar um nível sem abrir a aposta.
   *
   * Uma linha compacta e, por baixo das minhas que estão em aberto, dois
   * botões. Fechar é a coisa que mais vezes se faz aqui: obrigar a abrir
   * a aposta para isso era trocar um toque por três, todos os dias.
   */
  renderActions?: (bet: PlanBet) => ReactNode;
}) {
  const [tab, setTab] = useState<"abertas" | "fechadas">(() =>
    bets.some((bet) => bet.status === "pending") ? "abertas" : "fechadas",
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

  const open = useMemo(
    () => history.filter((entry) => entry.bet.status === "pending"),
    [history],
  );
  const closed = useMemo(
    () => history.filter((entry) => entry.bet.status !== "pending"),
    [history],
  );
  const shown = useMemo(
    () => filterHistory(closed, { outcome, text }),
    [closed, outcome, text],
  );
  const totals = useMemo(() => historyTotals(shown), [shown]);

  if (history.length === 0) return null;

  const mine = (entries: HistoryEntry[], id: string) =>
    entries.filter((entry) => entry.bet.userId === id).map((entry) => entry.bet);

  const abas: { key: "abertas" | "fechadas"; label: string; n: number }[] = [
    { key: "abertas", label: "Em aberto", n: open.length },
    { key: "fechadas", label: "Fechadas", n: closed.length },
  ];

  const lista = tab === "abertas" ? open : shown;

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

      {tab === "fechadas" && (
        <div className="space-y-2 border-b border-border px-4 py-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4 sm:items-end">
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
              // A casa decimal só enquanto couber e disser alguma coisa.
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
        </div>
      )}

      {lista.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-muted-foreground">
          {tab === "abertas"
            ? "Nada por fechar. A banca já conta tudo o que aqui está."
            : "Nenhuma aposta corresponde a isto."}
        </p>
      ) : (
        <div className="grid gap-px bg-border md:grid-cols-2">
          {players.map((player) => (
            <PlayerColumn
              key={player.id}
              name={player.name}
              bets={mine(lista, player.id)}
              onOpen={onOpen}
              renderActions={
                tab === "abertas" && player.id === me ? renderActions : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
