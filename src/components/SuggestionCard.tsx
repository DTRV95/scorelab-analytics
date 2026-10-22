import { Ban, Sparkles } from "lucide-react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { suggest, type Call, type SuggestionInput } from "@/lib/suggestion";

/**
 * A sugestão para este jogo, à cabeça.
 *
 * Tudo o que vem por baixo é material: quinze mercados, o preço de cada
 * um, o que falta saber. Isso serve para confirmar uma decisão, não para
 * a tomar — e com oito jogos num sábado de manhã ninguém faz oito
 * sínteses. Esta é a síntese, com o número que a sustenta ao lado para
 * não ter de se acreditar nela.
 *
 * Um mercado, um preço, e uma frase que acaba sempre em alguma coisa
 * para fazer: paga tanto a mais; entra com metade; não vale o preço.
 * Houve aqui uma etiqueta a dizer "aposto pouco", que é um adjectivo
 * onde devia estar uma instrução — a força da opinião lê-se na cor e no
 * fim da frase, e a frase ficou mais curta sem ela.
 *
 * E diz-se também o que evitar, que é a pergunta que ninguém faz: o
 * mercado em que mais discordamos das casas parece sempre o melhor do
 * cartaz, e é aquele onde o nosso registo mostra que nos enganamos.
 */

const label = (market: string) => MARKET_LABELS[market] ?? market;

const odd = (value: number) => value.toFixed(2).replace(".", ",");

/** Verde onde se decide, azul onde se mede, cinzento onde não se mexe. */
const TOM: Record<Call, { texto: string; fundo: string }> = {
  apostar: {
    texto: "text-[hsl(var(--sl-green))]",
    fundo: "bg-[hsl(var(--sl-green))]/[0.07]",
  },
  pequena: {
    texto: "text-[hsl(var(--sl-cool))]",
    fundo: "bg-[hsl(var(--sl-cool))]/[0.07]",
  },
  passar: { texto: "text-foreground", fundo: "bg-muted/40" },
  esperar: { texto: "text-foreground", fundo: "bg-muted/40" },
};

export function SuggestionCard({
  sample,
  ...props
}: Omit<SuggestionInput, "label"> & {
  /**
   * Quanto histórico sustenta isto.
   *
   * Vem para dentro do cartão porque é aqui que ele serve para alguma
   * coisa: é a amostra que põe a fasquia onde ela está. Sozinho num
   * autocolante, três linhas acima, era um número que ninguém sabia
   * para que era.
   */
  sample?: { label: string; pct: number };
}) {
  // Quinze mercados e duas ordenações: não vale a memória de os guardar
  // entre desenhos nem o cuidado de manter as dependências certas.
  const { call, pick, because, raised, required, avoid, avoidBecause } =
    suggest({ ...props, label });
  const tom = TOM[call];

  return (
    <section className="sl-card overflow-hidden">
      <div className={`px-4 py-3.5 ${tom.fundo}`}>
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Sugestão de IA
        </p>

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

        {/* O raciocínio, por baixo da decisão e não dentro dela.
            A frase diz o que fazer e tem de caber num telemóvel; isto
            é o que me fez pedir mais do que o costume neste jogo, e é
            o que separa um juízo de um número do modelo. */}
        {raised.length > 0 && (
          <p
            className="sl-meta mt-1.5 text-[11px] leading-4"
            title="O chão são três pontos. Estas são as razões que o levantaram, e nenhuma delas o modelo vê."
          >
            Peço {required.toFixed(1).replace(".", ",")} pontos aqui:{" "}
            {raised.map((item) => item.what).join(", ")}.
          </p>
        )}

        {sample && raised.length === 0 && (
          <p
            className="sl-meta mt-1.5 text-[11px] leading-4"
            title="Quantidade de histórico por trás da previsão, não a taxa de acerto dela"
          >
            Histórico: {sample.label} ({sample.pct.toFixed(0)}%)
          </p>
        )}
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
