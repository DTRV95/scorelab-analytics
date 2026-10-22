import { describe, expect, it } from "vitest";
import {
  adjustments,
  noticed,
  speaks,
  MIN_SAMPLE,
  type MarketCalibrationRow,
} from "@/lib/marketCalibration";
import { measuredPct, minimumOdd } from "@/lib/shortlist";

const row = (over: Partial<MarketCalibrationRow> = {}): MarketCalibrationRow => ({
  mercado: "1X",
  n: 109,
  prometido: 72.03,
  entregue: 61.47,
  desvio: -10.56,
  margem: 9.32,
  foundAt: "2026-10-22T00:00:00Z",
  // Por omissão, já confirmado pelos jogos de depois: os testes que
  // tratam da prova dizem-no explicitamente.
  nDesde: 60,
  desvioDesde: -9.8,
  margemDesde: 8.1,
  confirmado: true,
  ...over,
});

describe("speaks", () => {
  it("aceita o mercado medido e confirmado fora da amostra", () => {
    // O 1X: 109 jogos, −10,56 contra ±9,32, e os jogos de depois da
    // descoberta a dizerem o mesmo.
    expect(speaks(row())).toBe(true);
  });

  it("recusa o desvio que ainda não foi confirmado", () => {
    // É o estado do 1X no dia em que se reparou nele: o desvio está
    // fora da margem, mas não há um único jogo posterior. Encontrado
    // nos dados que o geraram, ainda não prova nada.
    expect(noticed(row({ nDesde: 0, confirmado: false }))).toBe(true);
    expect(speaks(row({ nDesde: 0, confirmado: false }))).toBe(false);
  });

  it("recusa o desvio que cabe dentro da margem", () => {
    // "Ambas Marcam": −6,78 contra ±9,93. Pode ser o acaso.
    expect(
      speaks(row({ mercado: "Ambas Marcam", desvio: -6.78, margem: 9.93 })),
    ).toBe(false);
  });

  it("recusa o mercado com poucos jogos, por maior que seja o desvio", () => {
    // "Fora": um jogo, desvio de +39,7. Não é uma descoberta.
    expect(speaks(row({ mercado: "Fora", n: 1, desvio: 39.7, margem: 0 }))).toBe(
      false,
    );
    expect(speaks(row({ n: MIN_SAMPLE - 1 }))).toBe(false);
  });
});

describe("adjustments", () => {
  it("só traz os mercados que já se provaram", () => {
    const got = adjustments([
      row(),
      row({ mercado: "Mais de 2.5 Golos", n: 83, desvio: -0.96, margem: 10.38 }),
      row({ mercado: "Por confirmar", nDesde: 0, confirmado: false }),
      row({ mercado: "Fora", n: 1, desvio: 39.7, margem: 0 }),
    ]);

    expect(got).toEqual({ "1X": -10.56 });
  });
});

describe("measuredPct com ajuste por mercado", () => {
  it("manda a medição à frente da curva", () => {
    // A curva descontaria onze pontos a qualquer coisa acima dos 60.
    expect(measuredPct(72)).toBe(61);
    // Com o desvio medido do 1X, desconta o que foi medido.
    expect(measuredPct(72, -10.56)).toBeCloseTo(61.44, 2);
  });

  it("deixa em paz o mercado que não exagera", () => {
    // "Mais de 2.5 Golos" a 70% entregou 71,4%. Descontar onze pontos
    // aqui é inventar um defeito e deixar passar uma aposta boa.
    expect(measuredPct(70)).toBe(59);
    expect(measuredPct(70, -0.96)).toBeCloseTo(69.04, 2);
  });

  it("aceita um ajuste positivo, quando o modelo promete a menos", () => {
    expect(measuredPct(62, 8.3)).toBeCloseTo(70.3, 1);
  });

  it("não deixa a probabilidade sair do mundo", () => {
    expect(measuredPct(95, 20)).toBe(99);
    expect(measuredPct(5, -20)).toBe(1);
  });

  it("sem medição, continua a curva de sempre", () => {
    expect(measuredPct(72, undefined)).toBe(61);
    expect(measuredPct(50)).toBe(50);
  });
});

describe("minimumOdd com ajuste", () => {
  it("baixa a exigência onde o modelo está certo", () => {
    // Com a curva única, 70% pediam 1,70. Medido, pedem 1,45 — e a
    // diferença entre as duas é uma aposta feita ou perdida.
    expect(minimumOdd(70)).toBe(1.7);
    expect(minimumOdd(70, -0.96)).toBe(1.45);
  });

  it("mantém a exigência onde ele exagera mesmo", () => {
    expect(minimumOdd(72, -10.56)).toBe(1.63);
  });
});
