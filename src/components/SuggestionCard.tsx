import { Ban, Crosshair } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { suggest, type SuggestionInput } from "@/lib/suggestion";

/**
 * A aposta que eu faria neste jogo, à cabeça da página.
 *
 * Tudo o que vem por baixo é material: quinze mercados, o preço de cada
 * um, o que falta saber. Isso serve para confirmar uma decisão, não para
 * a tomar — e com oito jogos num sábado de manhã ninguém faz oito
 * sínteses. Esta é a síntese, com o número que a sustenta ao lado para
 * não ter de se acreditar nela.
 *
 * E diz-se também o que evitar, que é a pergunta que ninguém faz: o
 * mercado em que mais discordamos das casas parece sempre o melhor do
 * cartaz, e é aquele onde o nosso registo mostra que nos enganamos.
 */

const label = (market: string) => MARKET_LABELS[market] ?? market;

export function SuggestionCard(props: Omit<SuggestionInput, "label">) {
  // Quinze mercados e uma ordenação: não vale a memória de os guardar
  // entre desenhos nem o cuidado de manter as dependências certas.
  const { call, pick, because, avoid, avoidBecause } = suggest({
    ...props,
    label,
  });

  return (
    <section className="sl-card overflow-hidden">
      <div
        className={`px-4 py-3.5 ${
          pick ? "bg-[hsl(var(--sl-green))]/[0.07]" : "bg-muted/40"
        }`}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <Crosshair className="h-3.5 w-3.5" />
          A aposta que eu faria
        </p>

        <div className="mt-1.5 flex items-baseline gap-3">
          <h2
            className={`min-w-0 flex-1 text-[17px] font-bold leading-6 ${
              pick ? "text-[hsl(var(--sl-green))]" : "text-foreground"
            }`}
          >
            {pick
              ? label(pick.market)
              : call === "esperar"
                ? "Ainda é cedo"
                : "Não aposto neste jogo"}
          </h2>
          {pick && (
            <span className="font-mono-data flex-none text-[20px] font-bold leading-6 text-[hsl(var(--sl-green))]">
              {pick.price?.toFixed(2).replace(".", ",")}
            </span>
          )}
        </div>

        <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
          {because}
        </p>
      </div>

      {avoid && (
        <div className="flex items-start gap-2.5 border-t border-border px-4 py-3">
          <Ban className="mt-0.5 h-3.5 w-3.5 flex-none text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground">
              Evita {label(avoid.market)}
              {avoid.price ? (
                <span className="sl-meta font-mono-data font-normal">
                  {" "}
                  · {avoid.price.toFixed(2).replace(".", ",")}
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
              {avoidBecause}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
