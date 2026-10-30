import { useState } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import {
  byDay,
  hitRate,
  namesInWords,
  RECENT_DAYS,
  type DayOfResults,
  type ScoredMatch,
} from "@/lib/boardResults";
import type { BoardResultsState } from "@/hooks/useBoardResults";

type Span = "recente" | "semana";

/** Verde acima de metade, vermelho abaixo. A régua é a mesma em todo o lado. */
const tone = (pct: number) =>
  pct >= 50 ? "text-[hsl(var(--sl-green))]" : "text-destructive";

/**
 * A hora, e já não o dia da semana.
 *
 * Cada jogo vive por baixo da linha do dia dele, que diz "quinta-feira"
 * em letra maior logo ali acima. Repeti-lo em cada jogo era escrever
 * "quinta" quatro vezes na mesma meia dúzia de centímetros.
 */
function when(kickoff: string | null): string {
  if (!kickoff) return "";
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function Row({ match }: { match: ScoredMatch }) {
  const Icon = match.landed ? Check : X;
  const colour = match.landed
    ? "text-[hsl(var(--sl-green))]"
    : "text-destructive";

  return (
    <div className="flex items-start gap-2.5 bg-muted/30 py-2.5 pl-9 pr-4">
      <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${colour}`} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-foreground">
          {match.home_name}{" "}
          <span className="sl-figure">
            {match.home_goals}-{match.away_goals}
          </span>{" "}
          {match.away_name}
        </p>
        <p className="sl-meta truncate text-[11px]">
          {match.league} · {when(match.kickoff)}
        </p>
      </div>

      <div className="flex-none text-right">
        <p className={`text-[11.5px] font-semibold ${colour}`}>
          {MARKET_LABELS[match.headline_market] ?? match.headline_market}
        </p>
        <p className="sl-meta text-[11px]">
          dava {match.headline_pct.toFixed(0)}%
        </p>
      </div>
    </div>
  );
}

/**
 * Um dia, com o que o modelo lhe acertou.
 *
 * A mesma forma das linhas dos jogos, porque é o mesmo gesto: nome à
 * esquerda, número à direita. O que muda é a unidade — em vez de um
 * jogo e o mercado dele, um dia e a conta dele.
 *
 * Abre-se para os jogos. Uma linha por dia responde "onde é que
 * correu mal" e não responde "em quê", e essa é sempre a pergunta a
 * seguir; tê-la a um toque de distância é melhor do que catorze jogos
 * à frente de quem só queria a primeira.
 */
function DayRow({
  day,
  open,
  onToggle,
}: {
  day: DayOfResults;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="sl-tap flex w-full items-center gap-2.5 px-4 py-3 text-left"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 flex-none text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />

        <div className="min-w-0 flex-1">
          {/* `capitalize` põe maiúscula em cada palavra e "quinta-feira"
              tem duas: dava "Quinta-Feira". Só a primeira letra. */}
          <p className="truncate text-[13px] font-semibold text-foreground first-letter:uppercase">
            {day.weekday}
          </p>
          <p className="sl-meta truncate text-[11px]">{day.date}</p>
        </div>

        <div className="flex flex-none items-baseline gap-2">
          <p className="sl-figure text-[13px] text-foreground">
            {day.rate.hits} de {day.rate.played}
          </p>
          <p
            className={`sl-figure w-11 text-right text-[15px] ${tone(
              day.rate.pct ?? 0,
            )}`}
          >
            {day.rate.pct}%
          </p>
        </div>
      </button>

      {open && (
        <div className="divide-y divide-border border-t border-border">
          {day.matches.map((match) => (
            <Row key={match.fixture_id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * O resto da semana, na mesma fila de dias que hoje e amanhã.
 *
 * O quadro é todo previsão e nenhum registo: diz o que está prestes a
 * acontecer e, quando alguém o podia conferir, já passou à semana
 * seguinte. Os dias de trás pertencem ao mesmo sítio que os da frente —
 * um certo ou um errado por jogo, no mercado que o quadro pôs à frente.
 *
 * Era um dia só, ontem, e um dia de futebol não chega para dizer nada.
 * Numa terça-feira jogou a Serie A e mais ninguém: três jogos, os três
 * certos, e a tab mostrava 100% — um número que não é sobre o modelo, é
 * sobre o calendário. Cinco dias apanham sempre um fim-de-semana, e a
 * média à cabeça passa a ser uma média de alguma coisa.
 *
 * O que está no ecrã foi marcado durante a noite. O motor só é chamado
 * quando alguém carrega, porque marcar uma semana é simular outra vez
 * todos os jogos dela.
 */
export function RecentHits({ state }: { state: BoardResultsState }) {
  const { results, recent, asking, error, ask } = state;
  const [span, setSpan] = useState<Span>("recente");
  /** Que dias estão abertos. Nenhum, à entrada: a conta vem primeiro. */
  const [open, setOpen] = useState<string[]>([]);

  const matches = span === "recente" ? recent : (results?.matches ?? []);
  const rate = hitRate(matches);
  const days = byDay(matches);

  /**
   * As competições que não responderam quando isto foi contado.
   *
   * Vêm na resposta desde sempre e este cartão deitava-as fora, o que lhe
   * permitia dizer uma coisa mais forte do que sabia. A 27 de Outubro a
   * Serie A não respondeu à marcação da noite e foi a única competição que
   * jogou nesse dia: três jogos, os três acertados. O cartão, sem nenhum
   * deles, escreveu "ontem não se jogou nada" — que não é uma versão
   * cautelosa da verdade, é o contrário dela.
   *
   * Não saber e não ter havido são respostas diferentes, e a diferença
   * pertence a quem lê.
   */
  const missing = results?.unavailable ?? [];
  const absent = missing.length > 0 ? namesInWords(missing) : null;

  if (!results) {
    return (
      <div className="sl-card px-4 py-4">
        <p className="text-[12.5px] leading-[1.5] text-foreground">
          Quantas vezes o mercado que o modelo destacou em cada jogo acabou
          por entrar.
        </p>
        <p className="sl-meta mt-1 text-[11.5px] leading-5">
          Ainda não há nada marcado. Pedir ao motor demora um bocado, porque é
          cada jogo simulado outra vez.
        </p>
        <button
          type="button"
          disabled={asking}
          onClick={ask}
          className="sl-tap mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[12px] font-semibold text-primary ring-1 ring-border disabled:opacity-50"
        >
          {asking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {asking ? "A marcar os jogos..." : "Ver como correram"}
        </button>
        {error && (
          <p className="mt-2 text-[11px] font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="sl-card overflow-hidden">
      {rate.pct === null ? (
        <p className="sl-meta px-4 py-4 text-[12.5px] leading-[1.5]">
          {absent
            ? `Não há nada marcado ${
                span === "recente"
                  ? `destes ${RECENT_DAYS} dias`
                  : "destes sete dias"
              }, e faltou contar ${absent}: não respondeu. Pode ter sido quem jogou — toca em "Incluir os de hoje" para contar outra vez.`
            : span === "recente"
              ? `Não se jogou nada nos últimos ${RECENT_DAYS} dias nas competições com dados automáticos.`
              : "Nenhum jogo marcado nos últimos sete dias."}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 px-4 pt-3.5">
            <p className="sl-figure text-[22px] text-foreground">
              {rate.hits} de {rate.played}
            </p>
            <p className={`sl-figure text-[15px] ${tone(rate.pct)}`}>
              {rate.pct}%
            </p>
          </div>

          {/* The hit rate alone cannot tell a sharp model from a timid one:
              fifteen of twenty is a different thing when it said 75% than
              when it said 95%. */}
          <p className="sl-meta px-4 pb-3 pt-0.5 text-[11px] leading-5">
            certos{" "}
            {span === "recente"
              ? `nos últimos ${RECENT_DAYS} dias`
              : "nos últimos sete dias"}
            , no mercado que o modelo destacou em cada jogo. Dizia, em média,{" "}
            {rate.said}%.
            {/* Uma conta a que falta uma competição ainda é uma conta, mas
                não é esta conta — e quem a lê tem de saber qual das duas
                está a ler. */}
            {absent && ` Sem ${absent}, que não respondeu.`}
          </p>

          {/* Por dia, e não os jogos todos de enfiada. Uma semana cheia
              são cento e quarenta linhas e sete dias são sete, e é por
              dia que a pergunta se faz: os 79% são a semana inteira ou
              um sábado bom a carregar quatro dias maus? */}
          <div className="divide-y divide-border border-t border-border">
            {days.map((day) => (
              <DayRow
                key={day.key}
                day={day}
                open={open.includes(day.key)}
                onToggle={() =>
                  setOpen((aberto) =>
                    aberto.includes(day.key)
                      ? aberto.filter((key) => key !== day.key)
                      : [...aberto, day.key],
                  )
                }
              />
            ))}
          </div>
        </>
      )}

      {/* Os sete dias vivem atrás destes cinco e não ao lado deles: uma
          fila de chips sobre o passado à frente dos jogos que ainda se
          vão jogar era pôr o retrovisor no pára-brisas. */}
      <div className="flex items-center gap-3 border-t border-border px-4">
        <button
          type="button"
          onClick={() => {
            setSpan(span === "recente" ? "semana" : "recente");
            setOpen([]);
          }}
          className="flex-1 py-2.5 text-left text-[11px] font-semibold text-primary"
        >
          {span === "recente"
            ? "Ver os últimos sete dias"
            : `Ver só os últimos ${RECENT_DAYS} dias`}
        </button>
        <button
          type="button"
          disabled={asking}
          onClick={ask}
          className="sl-tap flex items-center gap-1.5 py-2.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-50"
        >
          {asking && <Loader2 className="h-3 w-3 animate-spin" />}
          {asking ? "A marcar..." : "Incluir os de hoje"}
        </button>
      </div>

      {error && (
        <p className="border-t border-border px-4 py-2 text-[11px] font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
