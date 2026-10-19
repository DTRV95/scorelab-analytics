import { useEffect, useState } from "react";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import {
  byWhatItTells,
  fetchModelRecord,
  margin,
  tellsSomething,
  type MarketRecord,
} from "@/lib/modelRecord";

/**
 * O registo do quadro, por mercado — com a margem sempre ao lado.
 *
 * A tabela que está acima desta é um backtest de época por competição. Esta
 * é o que o quadro disse mesmo, guardado à medida que os resultados chegam,
 * e cresce todas as semanas em vez de se apagar.
 *
 * Cada desvio vem com a sua margem porque sem ela convida a ser lido como
 * uma conclusão: na primeira semana o empate aparecia treze pontos abaixo
 * do prometido e a margem era de onze — o que não é um modelo torto, é uma
 * semana com poucos empates.
 */
export function ModelRecordTable() {
  const [rows, setRows] = useState<MarketRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchModelRecord()
      .then((data) => !cancelled && setRows(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed || (rows && rows.length === 0)) {
    return (
      <div className="sl-card px-4 py-3.5">
        <h2 className="text-sm font-bold text-foreground">O registo do quadro</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          Ainda não há nada guardado. Enche-se sozinho à medida que os jogos
          do quadro vão sendo marcados.
        </p>
      </div>
    );
  }

  if (!rows) return null;

  const jogos = Math.max(...rows.map((row) => row.n));
  const comSinal = rows.filter(tellsSomething).length;

  return (
    <div className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3.5">
        <h2 className="text-sm font-bold text-foreground">O registo do quadro</h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          O que o quadro disse, contra o que aconteceu — não um backtest, mas
          as previsões que estiveram mesmo no ecrã. {jogos}{" "}
          {jogos === 1 ? "jogo" : "jogos"} até agora, e cresce todas as
          semanas.{" "}
          {comSinal === 0
            ? "Nenhum mercado se afastou mais do que a sua margem: ainda não há nada aqui que seja um desvio a sério."
            : `${comSinal} ${
                comSinal === 1
                  ? "mercado afastou-se"
                  : "mercados afastaram-se"
              } mais do que a margem.`}
        </p>
      </div>

      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <span className="sl-meta min-w-0 flex-1 text-[10px] uppercase tracking-[0.13em]">
          Mercado
        </span>
        <span className="sl-meta w-[46px] flex-none text-right text-[10px] uppercase tracking-[0.13em]">
          Diz
        </span>
        <span className="sl-meta w-[46px] flex-none text-right text-[10px] uppercase tracking-[0.13em]">
          Faz
        </span>
        <span className="sl-meta w-[86px] flex-none text-right text-[10px] uppercase tracking-[0.13em]">
          Desvio
        </span>
      </div>

      <div className="divide-y divide-border">
        {byWhatItTells(rows).map((row) => {
          const erro = margin(row);
          const conta = tellsSomething(row);
          return (
            <div
              key={row.mercado}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-foreground">
                  {MARKET_LABELS[row.mercado] ?? row.mercado}
                </p>
                <p className="sl-meta truncate text-[11px]">
                  {row.n} {row.n === 1 ? "jogo" : "jogos"}
                  {!conta && " · dentro da margem"}
                </p>
              </div>
              <span className="font-mono-data w-[46px] flex-none text-right text-xs text-muted-foreground">
                {row.said_pct.toFixed(0)}%
              </span>
              <span className="font-mono-data w-[46px] flex-none text-right text-xs font-bold text-foreground">
                {row.hit_pct.toFixed(0)}%
              </span>
              {/* O desvio e a sua margem, sempre juntos. Cinzento enquanto a
                  margem o cobrir: um número que o acaso explica não é um
                  número sobre o modelo, e pintá-lo seria dizer que é. */}
              <span
                className={`font-mono-data w-[86px] flex-none text-right text-xs font-bold ${
                  !conta
                    ? "text-muted-foreground/70"
                    : row.bias_pp > 0
                      ? "text-[hsl(var(--sl-green))]"
                      : "text-destructive"
                }`}
              >
                {row.bias_pp > 0 ? "+" : ""}
                {row.bias_pp.toFixed(1)}
                <span className="font-normal opacity-60"> ±{erro.toFixed(0)}</span>
              </span>
            </div>
          );
        })}
      </div>

      <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-5">
        O desvio é o que aconteceu menos o que foi prometido. A margem é o que
        o acaso explica sozinho com esta quantidade de jogos, a dois desvios-
        padrão: enquanto for maior do que o desvio, não há ali nada para ler.
      </p>
    </div>
  );
}
