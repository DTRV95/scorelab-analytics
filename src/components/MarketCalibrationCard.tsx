import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { SectionHeader } from "@/components/Section";
import {
  fetchMarketCalibration,
  noticed,
  speaks,
  MIN_SAMPLE,
  type MarketCalibrationRow,
} from "@/lib/marketCalibration";

/**
 * Onde é que o modelo exagera, mercado a mercado.
 *
 * Três estados, e a diferença entre eles é o que separa isto de uma
 * procura. "Nada a dizer": o desvio cabe na margem. "Por confirmar":
 * reparámos, e agora esperamos — a partir da data em que se reparou, a
 * conta é refeita só com jogos que a descoberta não viu. "A contar": a
 * segunda metade disse o mesmo que a primeira, e só então o número mexe
 * nas contas.
 *
 * O estado do meio é o que falta a toda a gente que publica padrões de
 * futebol. Encontrar é fácil; o difícil é esperar para ver.
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
  const vistos = rows.filter(noticed);

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={Scale}
        title="Onde o modelo exagera"
        note={
          usados.length === 0
            ? `${vistos.length} de ${rows.length} mercados com desvio fora da margem, nenhum ainda confirmado por jogos posteriores. Até lá vale a correcção geral.`
            : `${usados.length} de ${rows.length} mercados confirmados fora da amostra. Só esses mexem nas contas.`
        }
        className="border-b border-border px-4 py-3"
      />

      <div className="divide-y divide-border">
        {rows
          .filter((row) => row.n >= 10)
          .map((row) => {
            const conta = speaks(row);
            const reparado = noticed(row);
            const estado = conta
              ? "a contar"
              : reparado
                ? row.nDesde > 0
                  ? `por confirmar · ${row.nDesde} jogos desde`
                  : "por confirmar"
                : "nada a dizer";
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
                <p
                  className={`sl-meta w-[104px] flex-none text-right text-[10px] uppercase tracking-[0.08em] ${
                    conta ? "text-[hsl(var(--sl-green))]" : ""
                  }`}
                >
                  {estado}
                </p>
              </div>
            );
          })}
      </div>

      <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-4">
        Repara-se num mercado com {MIN_SAMPLE} jogos e desvio acima da
        margem — mas isso ainda não conta. A partir desse dia a conta é
        refeita só com jogos que a descoberta não viu, e só se eles
        disserem o mesmo é que o número passa a mexer no cálculo.
        Encontrar um padrão é fácil; o difícil é esperar para ver.
      </p>
    </section>
  );
}
