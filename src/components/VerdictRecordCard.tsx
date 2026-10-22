import { useEffect, useState } from "react";
import { Gavel } from "lucide-react";
import { SectionHeader } from "@/components/Section";
import {
  fetchScoredVerdicts,
  tallyVerdicts,
  type VerdictRow,
} from "@/lib/verdictRecord";
import { CALL_LABEL, type Call } from "@/lib/verdict";

/**
 * O currículo do veredicto.
 *
 * Toda a gente dá palpites sobre futebol e ninguém os conta. Esta tabela
 * é a razão por que esta casa pode dizer "vale a pena" sem ser mais um
 * site de prognósticos: o que se disse fica escrito com o preço do dia,
 * e aqui vê-se o que deu — incluindo quando deu mal.
 *
 * O número que manda é o lucro em unidades, não o acerto. Acertar 70% a
 * preços de 1,30 é perder dinheiro devagar, e uma tabela que só
 * mostrasse os 70% estaria a mentir com números verdadeiros.
 */

const ORDEM: Call[] = ["apostar", "esperar", "passar"];

/** O que cada decisão significa quando se olha para trás. */
const SENTIDO: Record<Call, string> = {
  apostar: "o que teria dado seguir cada uma, a uma unidade",
  esperar: "as que ficaram de fora por margem fina",
  passar: "as que recusámos — aqui acertar é elas não entrarem",
};

const eur = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")}`;

export function VerdictRecordCard() {
  const [rows, setRows] = useState<VerdictRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchScoredVerdicts()
      .then((found) => {
        if (!cancelled) setRows(found);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows === null) return null;

  const tallies = ORDEM.map((call) => ({ call, tally: tallyVerdicts(rows, call) }));
  const total = tallies.reduce((sum, row) => sum + row.tally.settled, 0);

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={Gavel}
        title="O que o veredicto tem valido"
        note={
          total === 0
            ? "Ainda sem jogos conferidos. Cada veredicto fica escrito com o preço do dia e é contado quando o jogo acaba."
            : `${total} veredictos já conferidos, ao preço a que foram dados.`
        }
        className="border-b border-border px-4 py-3"
      />

      {total === 0 ? (
        <p className="px-4 py-4 text-[12px] leading-5 text-muted-foreground">
          Isto enche-se sozinho. Não há aqui nada que se possa corrigir
          depois do jogo — a tabela nem sequer aceita correcções.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {tallies.map(({ call, tally }) => (
            <div key={call} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-bold text-foreground">
                  {CALL_LABEL[call]}
                </p>
                <p className="sl-meta font-mono-data text-[11px]">
                  {tally.settled} jogos
                </p>
              </div>
              <p className="sl-meta mt-0.5 text-[11px] leading-4">
                {SENTIDO[call]}
              </p>

              {tally.settled > 0 && (
                <div className="mt-2 flex items-baseline gap-4">
                  <span className="font-mono-data text-[13px] text-foreground">
                    {tally.winPct?.toFixed(0)}% entraram
                  </span>
                  {call === "apostar" && tally.unitsProfit !== null && (
                    <span
                      className={`font-mono-data text-[13px] font-bold ${
                        tally.unitsProfit >= 0
                          ? "text-[hsl(var(--sl-green))]"
                          : "text-destructive"
                      }`}
                    >
                      {eur(tally.unitsProfit)} unidades · {tally.roi}%
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
