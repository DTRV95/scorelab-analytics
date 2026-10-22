import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { SectionHeader } from "@/components/Section";
import {
  fetchSettledLegs,
  implied,
  losing,
  proven,
  readPatterns,
  MIN_LEGS,
  type Patterns,
} from "@/lib/betPatterns";

/**
 * O que as nossas apostas têm em comum, cruzadas.
 *
 * Isto não é o registo do modelo, que mede previsões. É o registo do
 * dinheiro, e são duas perguntas diferentes: o modelo pode estar certo
 * num mercado onde se perde dinheiro, basta pagarem mal por ele.
 *
 * A coluna que manda é a última. Comparar acertos entre famílias não
 * diz nada — uma dupla hipótese a 1,27 tem de entrar 79% das vezes e
 * um "ambas marcam" a 1,56 só precisa de 64% — por isso cada uma é
 * medida contra o preço que ela própria recebeu.
 */

const num = (value: number, casas = 1) =>
  value.toFixed(casas).replace(".", ",");

/** O cruzamento já feito, desenhado. Separado para se poder ver sem rede. */
export function BetPatterns({ found }: { found: Patterns }) {
  const perdem = found.families.filter(losing);
  const provados = found.families.filter(proven);

  return (
    <section className="sl-card overflow-hidden">
      <SectionHeader
        icon={Coins}
        title="O que as nossas apostas têm em comum"
        note={
          perdem.length === 0
            ? `${found.base.n} pernas fechadas, ${num(found.base.rate, 0)}% de acerto. Todas as famílias devolvem mais do que levam.`
            : `${found.base.n} pernas fechadas. ${perdem.length === 1 ? "Uma família devolve" : `${perdem.length} famílias devolvem`} menos do que ${perdem.length === 1 ? "leva" : "levam"}.`
        }
        className="border-b border-border px-4 py-3"
      />

      <div className="divide-y divide-border">
        {found.families.map((row) => {
          const perde = losing(row);
          return (
            <div key={row.key} className="flex items-baseline gap-3 px-4 py-2.5">
              <p
                className={`min-w-0 flex-1 truncate text-[12px] ${
                  perde ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {row.key}
              </p>
              <p className="sl-meta font-mono-data flex-none text-[11px]">
                {row.n}
              </p>
              <p
                className="font-mono-data w-[86px] flex-none text-right text-[11px] text-muted-foreground"
                title="Quantas entraram, contra as que o preço pago obrigava"
              >
                {num(row.rate, 0)}% / {num(implied(row), 0)}%
              </p>
              <p
                className={`font-mono-data w-[58px] flex-none text-right text-[12px] font-bold ${
                  perde ? "text-destructive" : "text-[hsl(var(--sl-green))]"
                }`}
                title="O que cada euro apostado nesta família devolveu, menos o próprio euro"
              >
                {row.perEuro >= 0 ? "+" : "−"}
                {num(Math.abs(row.perEuro) * 100, 0)}c
              </p>
            </div>
          );
        })}
      </div>

      <p className="sl-meta border-t border-border px-4 py-2.5 text-[11px] leading-4">
        {provados.length === 0 ? (
          <>
            Nada disto manda em nada. A família que mais perde fica dentro
            da própria margem, e dentro da margem não é um padrão — é uma
            semana. Serve para pedir mais onde já se perdeu, não para
            descontar seja o que for.
          </>
        ) : (
          <>
            {provados.map((row) => row.key).join(", ")}: o acerto ficou fora
            da margem do que o preço pedia. Isto já não é uma semana.
          </>
        )}{" "}
        Grupos com menos de {MIN_LEGS} pernas não aparecem, porque aí
        qualquer coisa que se veja é ruído com nome.
      </p>
    </section>
  );
}

export function BetPatternsCard() {
  const [found, setFound] = useState<Patterns | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSettledLegs()
      .then((legs) => {
        if (!cancelled) setFound(readPatterns(legs));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Sem pernas que cheguem não há secção nenhuma: um cartão vazio a
  // dizer que ainda não há dados ocupa o lugar de uma coisa que diga.
  return found ? <BetPatterns found={found} /> : null;
}
