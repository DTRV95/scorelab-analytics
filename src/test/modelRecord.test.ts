import { describe, expect, it } from "vitest";
import {
  byWhatItTells,
  margin,
  tellsSomething,
  type MarketRecord,
} from "@/lib/modelRecord";

const linha = (parte: Partial<MarketRecord>): MarketRecord => ({
  mercado: "Empate",
  n: 79,
  said_pct: 26.6,
  hit_pct: 13.9,
  bias_pp: -12.7,
  ...parte,
});

describe("a margem de um desvio medido", () => {
  it("é grande com poucos jogos e pequena com muitos", () => {
    // A mesma taxa, medida em dez vezes mais jogos, vale muito mais.
    const poucos = margin({ n: 79, hit_pct: 50 });
    const muitos = margin({ n: 790, hit_pct: 50 });

    expect(poucos).toBeCloseTo(11.3, 1);
    expect(muitos).toBeCloseTo(3.6, 1);
  });

  it("encolhe junto aos extremos, onde há menos por onde variar", () => {
    expect(margin({ n: 79, hit_pct: 5 })).toBeLessThan(
      margin({ n: 79, hit_pct: 50 }),
    );
  });

  it("não promete nada quando não há jogos nenhuns", () => {
    expect(margin({ n: 0, hit_pct: 0 })).toBe(100);
  });
});

describe("o que o registo diz, e o que ainda não diz", () => {
  it("não chama desvio ao que o acaso explica", () => {
    // Esta é a leitura que eu próprio fiz mal: 13,9% de empates contra
    // 26,6% prometidos parece um modelo torto, e com setenta e nove jogos
    // a margem é de 7,8 pontos — o desvio de 12,7 passa, mas por pouco, e
    // a mesma medição com metade dos jogos não passava de todo.
    expect(tellsSomething(linha({ n: 20, bias_pp: -12.7 }))).toBe(false);
    expect(tellsSomething(linha({ n: 79, bias_pp: -12.7 }))).toBe(true);
  });

  it("um desvio pequeno não conta por muitos jogos que tenha", () => {
    expect(tellsSomething(linha({ n: 79, bias_pp: -2 }))).toBe(false);
  });

  it("põe à frente o que já diz alguma coisa, não o que tem o número maior", () => {
    // Ordenar só pelo tamanho do desvio põe no topo quem tem a amostra
    // mais pequena, porque é aí que o acaso é maior.
    const ordem = byWhatItTells([
      linha({ mercado: "pouca amostra", n: 8, hit_pct: 50, bias_pp: -30 }),
      linha({ mercado: "medido", n: 900, hit_pct: 40, bias_pp: -9 }),
      linha({ mercado: "certo", n: 900, hit_pct: 50, bias_pp: 0.3 }),
    ]).map((row) => row.mercado);

    expect(ordem).toEqual(["medido", "pouca amostra", "certo"]);
  });
});
