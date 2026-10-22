import { Ban, Crosshair } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { CALL_LABEL, suggest, type Call, type SuggestionInput } from "@/lib/suggestion";

/**
 * O que eu faria neste jogo, à cabeça da página.
 *
 * Tudo o que vem por baixo é material: quinze mercados, o preço de cada
 * um, o que falta saber. Isso serve para confirmar uma decisão, não para
 * a tomar — e com oito jogos num sábado de manhã ninguém faz oito
 * sínteses. Esta é a síntese, com o número que a sustenta ao lado para
 * não ter de se acreditar nela.
 *
 * Há sempre uma opinião, e ela não é sim ou não. Um mercado nomeado e
 * quanto é que eu lhe punha: aposto, aposto pouco, não punha. Oito
 * cartões a dizer "não aposto neste jogo" não são oito opiniões.
 *
 * E diz-se também o que evitar, que é a pergunta que ninguém faz: o
 * mercado em que mais discordamos das casas parece sempre o melhor do
 * cartaz, e é aquele onde o nosso registo mostra que nos enganamos.
 */

const label = (market: string) => MARKET_LABELS[market] ?? market;

const odd = (value: number) => value.toFixed(2).replace(".", ",");

/** Verde onde se decide, azul onde se mede, cinzento onde não se mexe. */
const TOM: Record<Call, { texto: string; fundo: string; chapa: string }> = {
  apostar: {
    texto: "text-[hsl(var(--sl-green))]",
    fundo: "bg-[hsl(var(--sl-green))]/[0.07]",
    chapa: "bg-[hsl(var(--sl-green))]/15 text-[hsl(var(--sl-green))]",
  },
  pequena: {
    texto: "text-foreground",
    fundo: "bg-[hsl(var(--sl-cool))]/[0.07]",
    chapa: "bg-[hsl(var(--sl-cool))]/15 text-[hsl(var(--sl-cool))]",
  },
  passar: {
    texto: "text-foreground",
    fundo: "bg-muted/40",
    chapa: "bg-muted text-muted-foreground",
  },
  esperar: {
    texto: "text-foreground",
    fundo: "bg-muted/40",
    chapa: "bg-muted text-muted-foreground",
  },
};

export function SuggestionCard(props: Omit<SuggestionInput, "label">) {
  // Quinze mercados e duas ordenações: não vale a memória de os guardar
  // entre desenhos nem o cuidado de manter as dependências certas.
  const { call, pick, because, avoid, avoidBecause } = suggest({
    ...props,
    label,
  });
  const tom = TOM[call];

  return (
    <section className="sl-card overflow-hidden">
      <div className={`px-4 py-3.5 ${tom.fundo}`}>
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            <Crosshair className="h-3.5 w-3.5" />O que eu faria
          </p>
          <span
            className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${tom.chapa}`}
          >
            {CALL_LABEL[call]}
          </span>
        </div>

        <div className="mt-1.5 flex items-baseline gap-3">
          <h2
            className={`min-w-0 flex-1 text-[17px] font-bold leading-6 ${tom.texto}`}
          >
            {pick ? label(pick.market) : "Não há nada aqui"}
          </h2>
          {pick && (
            <span
              className={`font-mono-data flex-none text-[20px] font-bold leading-6 ${
                pick.price ? tom.texto : "text-muted-foreground"
              }`}
              title={
                !pick.price
                  ? "O preço a que ficaria justo"
                  : pick.derived
                    ? "Ninguém cota a dupla hipótese: este preço sai exacto das três simples desta casa"
                    : "O preço mediano das casas"
              }
            >
              {pick.price
                ? `${pick.derived ? "≈" : ""}${odd(pick.price)}`
                : `justo ${odd(pick.fairPrice)}`}
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
                  · {odd(avoid.price)}
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
