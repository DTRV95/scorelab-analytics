import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { SectionHeader } from "@/components/Section";
import {
  fetchMarketCalibration,
  speaks,
  MIN_SAMPLE,
  type MarketCalibrationRow,
} from "@/lib/marketCalibration";

/**
 * Onde é que o modelo exagera, mercado a mercado.
 *
 * É a relação mais útil que os dados já sustentam, e a tabela mostra-a
 * com a margem ao lado — porque um desvio sem margem é uma história, e
 * com margem é uma medição. Hoje, de doze mercados, um fala.
 *
 * A coluna que interessa é a última. "Ainda não" não quer dizer que o
 * mercado esteja bom: quer dizer que não sabemos, e que não vamos mexer
 * em contas por causa de uma diferença que cabe no acaso.
 */

const pp = (value: number) =>
  `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1).replace(".", ",")}`;

export function MarketCalibrationCard() {
  const [rows, setRows] = useState<MarketCalibrationRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMarketCalibration()
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

  if (!rows || rows.length === 0) return null;

  const usados = rows.filter(speaks);

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={Scale}
        title="Onde o modelo exagera"
        note={
          usados.length === 0
            ? `Nenhum mercado tem ainda desvio maior do que a sua própria margem. Até lá, aplica-se a correcção geral.`
            : `${usados.length} de ${rows.length} mercados já dizem alguma coisa. Só esses mexem nas contas.`
        }
        className="border-b border-border px-4 py-3"
      />

      <div className="divide-y divide-border">
        {rows
          .filter((row) => row.n >= 10)
          .map((row) => {
            const conta = speaks(row);
            return (
              <div
                key={row.mercado}
                className="flex items-baseline gap-3 px-4 py-2.5"
              >
                <p
                  className={`min-w-0 flex-1 truncate text-[12px] ${
                    conta ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {row.mercado}
                </p>
                <p className="sl-meta font-mono-data flex-none text-[11px]">
                  {row.n} jogos
                </p>
                <p
                  className={`font-mono-data w-[92px] flex-none text-right text-[12px] ${
                    conta ? "font-bold text-destructive" : "text-muted-foreground"
                  }`}
                  title="Desvio medido e margem de erro a dois sigmas"
                >
                  {pp(row.desvio)} ± {row.margem.toFixed(1).replace(".", ",")}
                </p>
              </div>
            );
          })}
      </div>

      <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-4">
        Um mercado entra nas contas quando tem {MIN_SAMPLE} jogos ou mais e o
        desvio ultrapassa a margem. Os outros ficam de fora de propósito: ler
        onze tabelas até uma parecer interessante não é medir, é procurar.
      </p>
    </section>
  );
}
