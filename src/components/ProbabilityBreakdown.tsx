import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";

export interface ProbabilityMarket {
  mercado: string;
  grupo: string;
  probabilidade_pct: number;
  min_pct: number;
  max_pct: number;
}

export interface ProbabilityResult {
  lambda_casa: number;
  lambda_fora: number;
  total_golos_esperados: number;
  amostra_pct: number;
  amostra_label: string;
  mercados: ProbabilityMarket[];
}

export const MARKET_LABELS: Record<string, string> = {
  Casa: "Vitória Casa",
  Empate: "Empate",
  Fora: "Vitória Fora",
  "1X": "Casa ou Empate (1X)",
  "2X": "Fora ou Empate (2X)",
  "Mais de 2.5 Golos": "Mais de 2.5 Golos",
  "Menos de 2.5 Golos": "Menos de 2.5 Golos",
  "Mais de 3.5 Golos": "Mais de 3.5 Golos",
  "Menos de 3.5 Golos": "Menos de 3.5 Golos",
  "Ambas Marcam": "Ambas Marcam",
  // Stored multiples normalise "Ambas Marcam" to the BTTS spelling, so both
  // names have to land on the same Portuguese label.
  "BTTS Yes": "Ambas Marcam",
  "BTTS No": "Ambas Não Marcam",
  "1X e Menos de 3.5 Golos": "1X e Menos de 3.5 Golos",
  "2X e Menos de 3.5 Golos": "2X e Menos de 3.5 Golos",
  "1X e Mais de 1.5 Golos": "1X e Mais de 1.5 Golos",
  "2X e Mais de 1.5 Golos": "2X e Mais de 1.5 Golos",
};

const GROUP_ORDER = ["Resultado", "Golos", "Ambas Marcam", "Combinados"];

/**
 * Verde acima de 60, azul no meio, cinzento em baixo.
 *
 * O meio era laranja — a cor da marca, que nesta aplicação quer dizer "aqui
 * decide-se alguma coisa". Numa lista de quinze mercados isso punha metade
 * da coluna a gritar sem nada para decidir. O emerald-600 e o slate-300
 * eram cores do Tailwind em cru, de fora do sistema.
 */
function barTone(pct: number) {
  if (pct >= 60) return "bg-[hsl(var(--sl-green))]";
  if (pct >= 40) return "bg-[hsl(var(--sl-cool))]";
  return "bg-muted-foreground/30";
}

/**
 * Quanto histórico está por trás do número — e não se o número está certo.
 *
 * Isto esteve pintado de verde, amarelo e vermelho, como se fosse um
 * veredicto. Nos 82 jogos já marcados saiu ao contrário: os de amostra
 * "Alta" entraram 52,6% das vezes e os de amostra "Baixa" 65,1%. Com duas
 * semanas não se tira daí uma regra nova, mas tira-se esta: enquanto o sinal
 * não se explicar, não é para ser lido como qualidade. Fica cinzento, a
 * dizer o que mede e mais nada.
 */
export function sampleTone(_label: string) {
  return "text-muted-foreground bg-muted ring-border";
}

/**
 * Pure model probability, grouped and ranked — deliberately with no odds, no
 * edge and no stake anywhere on it. Comparing this against a bookmaker's
 * price is a separate, later step.
 */
export function ProbabilityBreakdown({
  data,
  onPick,
  verdicts,
  heading,
}: {
  data: ProbabilityResult;
  /**
   * Dado, cada mercado passa a ser um botão que o leva para o boletim.
   *
   * Opcional porque esta tabela também se lê sem nada para fazer com ela:
   * na página do jogo e no resultado de uma análise à mão, ninguém está a
   * meio de uma aposta.
   */
  onPick?: (market: string, pct: number) => void;
  /**
   * O que o resultado fez a cada mercado, para um jogo já jogado.
   *
   * Sem isto, a tabela de um jogo de ontem continuava a ser quinze
   * previsões por verificar — e o resultado estava escrito duas linhas
   * acima. Era a única parte do ecrã onde o que aconteceu não contava.
   */
  verdicts?: Map<string, boolean>;
  /**
   * O que fica no lugar do autocolante da amostra.
   *
   * No quadro, essa linha passou a ser a opinião sobre o jogo — e a
   * amostra vai lá dentro, onde finalmente serve para alguma coisa: é
   * ela que põe a fasquia. Sem isto, quem quisesse a opinião tinha de
   * abrir a análise avançada.
   */
  heading?: ReactNode;
}) {
  const groups = GROUP_ORDER.map((grupo) => ({
    grupo,
    mercados: data.mercados
      .filter((m) => m.grupo === grupo)
      .sort((a, b) => b.probabilidade_pct - a.probabilidade_pct),
  })).filter((group) => group.mercados.length > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            xG Casa
          </p>
          <p className="mt-1.5 font-mono-data text-xl font-bold text-foreground">
            {data.lambda_casa.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            xG Fora
          </p>
          <p className="mt-1.5 font-mono-data text-xl font-bold text-foreground">
            {data.lambda_fora.toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-[hsl(var(--sl-surface))] p-3 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Total Esperado
          </p>
          <p className="mt-1.5 font-mono-data text-xl font-bold text-foreground">
            {data.total_golos_esperados.toFixed(2)}
          </p>
        </div>
      </div>

      {heading ?? (
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ${sampleTone(
            data.amostra_label
          )}`}
        >
          Histórico por trás: {data.amostra_label} (
          {data.amostra_pct.toFixed(0)}%)
          <span className="font-normal opacity-70">
            — quantidade, não acerto
          </span>
        </div>
      )}

      {groups.map((group) => (
        <div key={group.grupo} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {group.grupo}
          </p>
          <div className="space-y-2">
            {group.mercados.map((market) => {
              const nome = MARKET_LABELS[market.mercado] ?? market.mercado;
              const entrou = verdicts?.get(market.mercado);
              const Linha = onPick ? "button" : "div";
              return (
              <Linha
                key={market.mercado}
                {...(onPick
                  ? {
                      type: "button" as const,
                      onClick: () =>
                        onPick(market.mercado, market.probabilidade_pct),
                      "aria-label": `Juntar ${nome} ao boletim`,
                    }
                  : {})}
                data-entrou={
                  entrou === undefined ? undefined : entrou ? "sim" : "nao"
                }
                className={`block w-full rounded-xl border bg-[hsl(var(--sl-surface))] px-3.5 py-3 text-left ${
                  entrou === undefined
                    ? "border-border"
                    : entrou
                      ? "border-[hsl(var(--sl-green))]/45 bg-[hsl(var(--sl-green))]/[0.05]"
                      : "border-border opacity-60"
                } ${
                  onPick
                    ? "sl-tap transition-colors hover:border-primary/45 hover:bg-primary/[0.04]"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span className="truncate">{nome}</span>
                    {onPick && (
                      <Plus className="h-3.5 w-3.5 flex-none text-primary" />
                    )}
                  </span>
                  {/* Entrou ou não entrou, dito em palavra e não só em cor:
                      é a resposta à pergunta que a linha fazia, e uma
                      moldura verde não é uma resposta para quem não
                      distingue as duas cores. */}
                  {entrou !== undefined && (
                    <span
                      className={`flex-none rounded-full px-1.5 py-px text-[10px] font-bold ${
                        entrou
                          ? "bg-[hsl(var(--sl-green))]/12 text-[hsl(var(--sl-green))]"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {entrou ? "Entrou" : "Falhou"}
                    </span>
                  )}
                  <span
                    className={`font-mono-data flex-none text-sm font-bold ${
                      entrou === undefined
                        ? "text-[hsl(var(--sl-green))]"
                        : entrou
                          ? "text-foreground"
                          : "text-muted-foreground"
                    }`}
                  >
                    {market.probabilidade_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${market.probabilidade_pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    // Num jogo já jogado a barra deixa de poder ser
                    // verde: o verde passou a querer dizer "entrou", e
                    // tê-lo também a querer dizer "mais de 60%" punha a
                    // mesma cor a responder a duas perguntas na mesma
                    // linha. Mede-se em azul, decide-se em verde.
                    className={`absolute inset-y-0 left-0 rounded-full ${
                      entrou === undefined
                        ? barTone(market.probabilidade_pct)
                        : entrou
                          ? "bg-[hsl(var(--sl-cool))]"
                          : "bg-muted-foreground/30"
                    }`}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Intervalo plausível: {market.min_pct.toFixed(0)}% – {market.max_pct.toFixed(0)}%
                </p>
              </Linha>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
