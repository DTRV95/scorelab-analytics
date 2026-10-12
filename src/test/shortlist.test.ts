import { describe, expect, it } from "vitest";
import {
  minimumOdd,
  minimumOddOfSlip,
  onShortlist,
  shortlistOf,
} from "@/lib/shortlist";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

const pick = (market: string, pct: number) =>
  ({ headline_market: market, headline_pct: pct }) as BoardMatch;

describe("a lista curta", () => {
  it("fica com a dupla hipótese acima de 70%", () => {
    // Em 91 jogos já marcados: estes entraram 88% das vezes.
    expect(onShortlist(pick("1X", 72))).toBe(true);
    expect(onShortlist(pick("2X", 88))).toBe(true);
  });

  it("deixa de fora os golos e o ambas marcam, a qualquer confiança", () => {
    // 47% em 32 jogos: é uma moeda ao ar, por mais alto que seja o número.
    expect(onShortlist(pick("Mais de 2.5 Golos", 85))).toBe(false);
    expect(onShortlist(pick("Ambas Marcam", 80))).toBe(false);
    expect(onShortlist(pick("Menos de 3.5 Golos", 92))).toBe(false);
  });

  it("deixa de fora o que está abaixo do degrau dos 70", () => {
    // Entre 65% e 69% o quadro entrou 47% das vezes — pior do que abaixo
    // de 65%. O número só começa a querer dizer alguma coisa nos 70.
    expect(onShortlist(pick("1X", 69.9))).toBe(false);
    expect(onShortlist(pick("1X", 70))).toBe(true);
  });

  it("diz a que preço a aposta fica a zero", () => {
    expect(minimumOdd(88)).toBeCloseTo(1.14, 2);
    expect(minimumOdd(70)).toBeCloseTo(1.43, 2);
    expect(minimumOdd(50)).toBeCloseTo(2.0, 2);
  });

  it("arredonda o preço para cima, nunca para baixo", () => {
    // 100/88 é 1,1363…: dizer 1,13 seria chamar justa a uma aposta perdida.
    expect(minimumOdd(88)).toBeGreaterThanOrEqual(100 / 88);
    expect(minimumOdd(77)).toBeGreaterThanOrEqual(100 / 77);
  });

  it("multiplica as hipóteses quando as apostas vão juntas", () => {
    // Duas de 88% são 77,4% — e 77,4% precisa de 1,30, não de 1,14.
    expect(minimumOddOfSlip([88, 88])).toBeCloseTo(1.3, 2);
    expect(minimumOddOfSlip([88])).toBe(minimumOdd(88));
  });

  it("não inventa preço nenhum sem nada para avaliar", () => {
    expect(minimumOdd(0)).toBe(0);
    expect(minimumOddOfSlip([])).toBe(0);
  });

  it("separa o quadro de um dia", () => {
    const curtos = shortlistOf([
      pick("1X", 81),
      pick("Mais de 2.5 Golos", 84),
      pick("2X", 64),
      pick("2X", 75),
    ]);

    expect(curtos).toHaveLength(2);
    expect(curtos.map((m) => m.headline_pct)).toEqual([81, 75]);
  });
});
