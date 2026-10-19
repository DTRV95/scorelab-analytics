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
    // Sobre o que a previsão faz, não sobre o que ela diz: acima dos 55%
    // promete cerca de onze pontos a mais, e esses onze pontos são a
    // diferença entre um preço justo e uma perda.
    expect(minimumOdd(88)).toBeCloseTo(1.3, 2); // 77% a sério
    expect(minimumOdd(70)).toBeCloseTo(1.7, 2); // 59% a sério
    expect(minimumOdd(50)).toBeCloseTo(2.0, 2); // abaixo de 55 não se mexe
  });

  it("arredonda o preço para cima, nunca para baixo", () => {
    // 100/88 é 1,1363…: dizer 1,13 seria chamar justa a uma aposta perdida.
    expect(minimumOdd(88)).toBeGreaterThanOrEqual(100 / 88);
    expect(minimumOdd(77)).toBeGreaterThanOrEqual(100 / 77);
  });

  it("nunca pede menos do que a probabilidade em cru pediria", () => {
    // O ajuste só pode apertar o preço. Se alguma vez o afrouxasse, o
    // ecrã estaria a mandar aceitar odds piores por causa de uma medição.
    for (const pct of [20, 35, 45, 55, 58, 60, 70, 80, 88, 95]) {
      expect(minimumOdd(pct)).toBeGreaterThanOrEqual(100 / pct - 0.01);
    }
  });

  it("não dá um salto nos 60%", () => {
    // Sem a rampa entre 55 e 60, 59,9% e 60,1% pediriam preços a treze
    // cêntimos de distância, e a lista ficava com um degrau sem sentido.
    expect(minimumOdd(60.1) - minimumOdd(59.9)).toBeLessThan(0.02);
  });

  it("multiplica as hipóteses quando as apostas vão juntas", () => {
    // Duas de 88% são, medidas, duas de 77% — e isso são 59,3% juntas.
    expect(minimumOddOfSlip([88, 88])).toBeCloseTo(1.69, 2);
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

describe("o preço no sítio onde se decide", () => {
  it("mede um boletim pelas probabilidades das suas pernas", () => {
    // Duas pernas de 80% — 69% medidas — são 47,6% juntas: o boletim fica
    // a zero a 2,11, e não a 1,45 que é o preço de cada uma delas.
    expect(minimumOddOfSlip([80, 80])).toBeCloseTo(2.11, 2);
    expect(minimumOddOfSlip([80])).toBeCloseTo(1.45, 2);
  });

  it("corrige cada perna antes de as multiplicar, e não o produto", () => {
    // Ao contrário dava outra coisa: a correcção foi medida em previsões
    // de mercados, e duas pernas de 80% dão um boletim de 64% — um número
    // que nunca foi previsto por ninguém.
    const porPerna = minimumOddOfSlip([80, 80]);
    const aoProduto = minimumOdd(80 * 0.8);

    expect(porPerna).toBeGreaterThan(aoProduto);
  });

  it("não deixa uma perna por avaliar baixar o preço do boletim", () => {
    // Três pernas pedem sempre mais do que duas das mesmas.
    expect(minimumOddOfSlip([75, 75, 75])).toBeGreaterThan(
      minimumOddOfSlip([75, 75]),
    );
  });
});
