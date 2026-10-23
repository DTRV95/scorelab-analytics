import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { SectionHeader } from "@/components/Section";
import {
  fetchScoredSuggestions,
  tally,
  type SuggestionRow,
} from "@/lib/suggestionRecord";
import type { Call } from "@/lib/suggestion";

/**
 * O currículo da sugestão de IA.
 *
 * Toda a gente dá palpites sobre futebol e ninguém os conta. Esta
 * tabela é a razão por que esta casa pode dizer "aposto" sem ser mais
 * um site de prognósticos: o que se disse fica escrito com o preço do
 * dia, e aqui vê-se o que deu — incluindo quando deu mal.
 *
 * O número que manda é o lucro em unidades, não o acerto. Acertar 70%
 * a preços de 1,30 é perder dinheiro devagar, e uma tabela que só
 * mostrasse os 70% estaria a mentir com números verdadeiros.
 *
 * As quatro respostas contam-se todas, e a dos "não punha" conta ao
 * contrário: ali acertar é o mercado não entrar. Metade do trabalho
 * desta casa é dizer que não, e uma tabela que só contasse os sins
 * estaria a esconder essa metade.
 */

const ORDEM: Call[] = ["apostar", "pequena", "passar", "esperar"];

const NOME: Record<Call, string> = {
  apostar: "Aposto",
  pequena: "Aposto pouco",
  passar: "Não punha",
  esperar: "Sem preço ainda",
};

const SENTIDO: Record<Call, string> = {
  apostar: "o que teria dado segui-las, a uma unidade cada",
  pequena: "as que passaram o justo mas não a fasquia do jogo",
  passar: "as que recusei — aqui acertar é elas não entrarem",
  esperar: "nomeadas antes de haver preço, e conferidas na mesma",
};

const un = (value: number) =>
  `${value > 0 ? "+" : ""}${value.toFixed(2).replace(".", ",")}`;

/** O registo já carregado, desenhado. Separado para se poder ver sem rede. */
export function SuggestionRecord({ rows }: { rows: SuggestionRow[] }) {
  const contas = ORDEM.map((call) => ({ call, conta: tally(rows, call) }));
  const total = contas.reduce((sum, row) => sum + row.conta.settled, 0);
  const apostadas = contas.find((row) => row.call === "apostar")!.conta;

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={Sparkles}
        title="O que a sugestão de IA tem valido"
        note={
          total === 0
            ? "Ainda sem jogos conferidos. Cada sugestão fica escrita com o preço do dia e é contada quando o jogo acaba."
            : `${total} sugestões conferidas, ao preço a que foram dadas.`
        }
        className="border-b border-border px-4 py-3"
      />

      {total === 0 ? (
        <p className="px-4 py-4 text-[12px] leading-5 text-muted-foreground">
          Isto enche-se sozinho, à medida que se abrem jogos e eles vão
          sendo jogados. Não há aqui nada que se possa corrigir depois do
          resultado — a tabela nem sequer aceita correcções.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {contas
            .filter(({ conta }) => conta.settled > 0)
            .map(({ call, conta }) => (
              <div key={call} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[13px] font-bold text-foreground">
                    {NOME[call]}
                  </p>
                  <p className="sl-meta font-mono-data text-[11px]">
                    {conta.settled} jogos
                  </p>
                </div>
                <p className="sl-meta mt-0.5 text-[11px] leading-4">
                  {SENTIDO[call]}
                </p>

                <div className="mt-2 flex items-baseline gap-4">
                  <span className="font-mono-data text-[13px] text-foreground">
                    {conta.winPct?.toFixed(0)}% certas
                  </span>
                  {call !== "passar" && conta.unitsProfit !== null && (
                    <span
                      className={`font-mono-data text-[13px] font-bold ${
                        conta.unitsProfit >= 0
                          ? "text-[hsl(var(--sl-green))]"
                          : "text-destructive"
                      }`}
                    >
                      {un(conta.unitsProfit)} unidades · {conta.roi}%
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {apostadas.settled > 0 && apostadas.settled < 30 && (
        <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-4">
          São {apostadas.settled} jogos. Uma taxa de acerto com tão poucos
          não distingue uma boa casa de uma semana de sorte — isto começa
          a dizer alguma coisa para lá dos trinta.
        </p>
      )}
    </section>
  );
}

export function SuggestionRecordCard() {
  const [rows, setRows] = useState<SuggestionRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchScoredSuggestions()
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

  // Enquanto não chega não se desenha nada. Um cartão a dizer "zero
  // sugestões" que passados dois segundos diz "quarenta" é pior do que
  // um cartão que aparece quando sabe o que dizer.
  return rows === null ? null : <SuggestionRecord rows={rows} />;
}
