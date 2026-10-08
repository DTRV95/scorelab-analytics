import { useState } from "react";
import { Flag, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPlanEnded, type PlanRecord } from "@/lib/planStore";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export interface EndSummary {
  /** Where the money finished. */
  bankroll: number;
  /** What the bets did, deposits and withdrawals left out. */
  profit: number;
  /** The level reached, and the one the ladder was meant to end on. */
  day: number;
  days: number;
  /** Bets still waiting on a result, which have to be closed first. */
  openBets: number;
}

/**
 * Giving a challenge as over.
 *
 * A challenge can end before its ladder does: the target came in early, the
 * money ran out, or it simply stopped making sense. Until now the only way
 * out was deleting it, which takes both players' record with it — so a
 * challenge nobody was playing any more stayed on the home page forever,
 * asking for the next level.
 *
 * Nothing is deleted here. The bets, the ladder and the standings stay
 * exactly where they are; what changes is that the challenge stops asking for
 * anything and stops taking bets. Whoever created it can put it back on.
 */
export function EndChallenge({
  plan,
  isOwner,
  summary,
  onDone,
}: {
  plan: PlanRecord;
  isOwner: boolean;
  summary: EndSummary;
  onDone: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ended = plan.ended_at !== null;

  const run = async (finish: boolean) => {
    setWorking(true);
    setError(null);
    try {
      await setPlanEnded(plan.id, finish);
      onDone();
    } catch (cause) {
      // The server decides, and it has two reasons to refuse: a bet still
      // open, and not being the person who created the challenge. Its own
      // words are better than a guess.
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "Não foi possível mudar o estado deste desafio.",
      );
    } finally {
      setWorking(false);
    }
  };

  if (!isOwner) {
    return (
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Só quem criou o desafio o pode {ended ? "reabrir" : "terminar"}. Podes
        sair dele, e aí deixa de aparecer para ti — mas continua a contar para
        quem lá ficar.
      </p>
    );
  }

  if (ended) {
    return (
      <div className="space-y-3">
        <p className="text-[12px] leading-relaxed text-foreground">
          Este desafio está terminado desde{" "}
          <strong>{when(plan.ended_at)}</strong>. Reabrir põe-no exactamente
          como estava: volta a aceitar apostas no nível {summary.day} e volta a
          aparecer no Início.
        </p>

        {error && (
          <p className="text-[12px] text-destructive">{error}</p>
        )}

        <Button
          className="sl-btn-primary h-10 w-full gap-1.5 text-xs"
          disabled={working}
          onClick={() => run(false)}
        >
          {working ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          Reabrir o desafio
        </Button>
      </div>
    );
  }

  if (summary.openBets > 0) {
    return (
      <p className="text-[12px] leading-relaxed text-foreground">
        {summary.openBets === 1
          ? "Há 1 aposta por decidir."
          : `Há ${summary.openBets} apostas por decidir.`}{" "}
        Fecha-as primeiro: um desafio terminado com uma aposta em aberto
        congelava numa banca que não é a verdadeira.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border">
        {[
          { label: "Banca", value: eur.format(summary.bankroll) },
          {
            label: "Das apostas",
            value: `${summary.profit >= 0 ? "+" : ""}${eur.format(summary.profit)}`,
          },
          { label: "Nível", value: `${summary.day} de ${summary.days}` },
        ].map((cell) => (
          // A column, so a label that takes two lines on a narrow phone does
          // not push its own figure below the other two.
          <div
            key={cell.label}
            className="flex flex-col bg-card px-2 py-2.5 text-center"
          >
            <p className="sl-meta text-[10px] uppercase leading-tight tracking-[0.1em]">
              {cell.label}
            </p>
            <p className="sl-figure mt-auto pt-1 text-[13px] text-foreground">
              {cell.value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[12px] leading-relaxed text-foreground">
        Terminar fecha o desafio para os dois: deixa de aceitar apostas e
        deixa de pedir o próximo nível. <strong>Não apaga nada</strong> — as
        apostas, o quadro e as contas ficam onde estão, e tu podes reabri-lo
        quando quiseres.
      </p>

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      <Button
        className="sl-btn-primary h-10 w-full gap-1.5 text-xs"
        disabled={working}
        onClick={() => run(true)}
      >
        {working ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Flag className="h-3.5 w-3.5" />
        )}
        Terminar o desafio
      </Button>
    </div>
  );
}

/** The day something happened, as somebody would say it out loud. */
function when(at: string | null): string {
  if (!at) return "";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
