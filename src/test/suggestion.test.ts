import { describe, expect, it } from "vitest";
import { suggest, quotes, type SuggestionInput } from "@/lib/suggestion";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

/** O cartão de amanhã, com os números que a fonte deu mesmo. */
function input(over: Partial<SuggestionInput> = {}): SuggestionInput {
  return {
    markets: [
      { mercado: "Casa", probabilidade_pct: 57.1 },
      { mercado: "1X", probabilidade_pct: 82.3 },
      { mercado: "Menos de 3.5 Golos", probabilidade_pct: 67.2 },
    ],
    amostraPct: 80,
    prices: { Casa: 1.9, "Menos de 3.5 Golos": 1.9 },
    implied: { Casa: 52.0, "1X": 82.1, "Menos de 3.5 Golos": 57.9 },
    record: new Map(),
    adjustments: {},
    ...over,
  };
}

function record(over: Partial<AccuracyMarket> = {}): AccuracyMarket {
  return {
    market: "Casa",
    grupo: "Resultado",
    samples: 120,
    predicted_pct: 57,
    actual_pct: 45,
    gap_pp: -12,
    brier: 0.2,
    ...over,
  };
}

describe("quotes", () => {
  it("põe lado a lado o nosso número, o do mercado e o preço", () => {
    const linha = quotes(input()).find((q) => q.market === "Casa")!;

    // 57,1% está abaixo dos 55 onde a curva começa a descontar... não
    // está: a curva arranca aos 55, por isso desce um pouco.
    expect(linha.marketPct).toBe(52);
    expect(linha.price).toBe(1.9);
    expect(linha.gap).toBeCloseTo(linha.ours - 52, 5);
  });

  it("dá preço justo mesmo onde as casas não cotam", () => {
    // O 1X não vem nas odds (só h2h e totais), mas o justo calcula-se.
    const linha = quotes(input()).find((q) => q.market === "1X")!;

    expect(linha.price).toBeNull();
    expect(linha.edge).toBeNull();
    expect(linha.fairPrice).toBeGreaterThan(1);
  });

  it("usa o ajuste medido do mercado quando ele existe", () => {
    const sem = quotes(input()).find((q) => q.market === "1X")!;
    const com = quotes(
      input({ adjustments: { "1X": -10.5 } }),
    ).find((q) => q.market === "1X")!;

    expect(com.ours).toBeCloseTo(82.3 - 10.5, 1);
    expect(com.ours).not.toBeCloseTo(sem.ours, 1);
  });
});

describe("suggest", () => {
  it("escolhe o mercado que mais paga acima do que vale", () => {
    const got = suggest(input());

    expect(got.pick?.market).toBe("Menos de 3.5 Golos");
    expect(got.because).toContain("1,90");
    expect(got.because).toContain("pontos a teu favor");
  });

  it("recusa o jogo inteiro quando o histórico é curto", () => {
    // É o caso de todos os oito jogos de amanhã: amostra entre 17% e 42%.
    const got = suggest(input({ amostraPct: 33 }));

    expect(got.pick).toBeNull();
    expect(got.because).toContain("33%");
    expect(got.because).toContain("histórico");
  });

  it("recusa o mercado em que estamos muito acima das casas", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "Casa", probabilidade_pct: 75 }],
        prices: { Casa: 2.0 },
        implied: { Casa: 50 },
      }),
    );

    expect(got.pick).toBeNull();
    expect(got.because).toContain("acima do mercado");
  });

  it("recusa o mercado onde o nosso registo é mau, por bom que o preço esteja", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "Casa", probabilidade_pct: 60 }],
        prices: { Casa: 2.5 },
        implied: { Casa: 55 },
        record: new Map([["Casa", record()]]),
      }),
    );

    expect(got.pick).toBeNull();
  });

  it("diz qual esteve mais perto, e de quê, quando não há aposta", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "Casa", probabilidade_pct: 53 }],
        prices: { Casa: 1.9 },
        implied: { Casa: 52 },
      }),
    );

    expect(got.because).toContain("Casa a 1,90");
    expect(got.because).toContain("pontos de vantagem");
  });

  it("espera quando as casas ainda não abriram o jogo", () => {
    const got = suggest(input({ prices: null, implied: null }));

    expect(got.pick).toBeNull();
    expect(got.because).toContain("ainda não abriram");
  });

  it("nomeia a armadilha: o mercado onde mais discordamos das casas", () => {
    const got = suggest(
      input({
        markets: [
          { mercado: "Casa", probabilidade_pct: 57.1 },
          { mercado: "Menos de 3.5 Golos", probabilidade_pct: 72 },
        ],
        prices: { Casa: 1.9, "Menos de 3.5 Golos": 1.75 },
        implied: { Casa: 52, "Menos de 3.5 Golos": 48 },
      }),
    );

    expect(got.avoid?.market).toBe("Menos de 3.5 Golos");
    expect(got.avoidBecause).toContain("onde o nosso registo mostra");
  });

  it("não aponta como armadilha a aposta que acabou de sugerir", () => {
    const got = suggest(
      input({
        markets: [{ mercado: "Menos de 3.5 Golos", probabilidade_pct: 67.2 }],
        prices: { "Menos de 3.5 Golos": 1.9 },
        implied: { "Menos de 3.5 Golos": 54 },
      }),
    );

    if (got.pick) expect(got.avoid).toBeNull();
  });

  it("avisa da armadilha mesmo quando trava o jogo por histórico", () => {
    // O Go Ahead de amanhã: amostra de 33% e um "Menos de 3.5" a pagar
    // 1,75 que parece bom. A discordância conta-se sobre os 53,5% que
    // defendemos depois do desconto, não sobre os 64,5% em bruto — são
    // onze pontos e meio acima dos 42% do mercado.
    const got = suggest(
      input({
        amostraPct: 33,
        markets: [{ mercado: "Menos de 3.5 Golos", probabilidade_pct: 64.5 }],
        prices: { "Menos de 3.5 Golos": 1.75 },
        implied: { "Menos de 3.5 Golos": 42 },
      }),
    );

    expect(got.pick).toBeNull();
    expect(got.avoid?.market).toBe("Menos de 3.5 Golos");
  });
});
