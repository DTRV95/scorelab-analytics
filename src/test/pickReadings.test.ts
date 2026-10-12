import { describe, expect, it } from "vitest";
import { mismatch, readPick } from "@/lib/pickReadings";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

const jogo = (
  market: string,
  pct: number,
  casa = 2.1,
  fora = 0.9,
): BoardMatch =>
  ({
    headline_market: market,
    headline_pct: pct,
    lambda_casa: casa,
    lambda_fora: fora,
  }) as BoardMatch;

describe("o que o registo diz de uma escolha", () => {
  it("responde a três perguntas separadas", () => {
    const { readings } = readPick(jogo("1X", 78));

    expect(readings.map((r) => r.about)).toEqual(["mercado", "força", "jogo"]);
  });

  it("chama boa à escolha que o registo mediu a 88%", () => {
    // Dupla hipótese, acima de 70%, equipas desniveladas.
    expect(readPick(jogo("1X", 78)).verdict).toBe("forte");
  });

  it("não deixa um número alto salvar um mercado que entrou 47%", () => {
    const { verdict, readings } = readPick(jogo("Mais de 2.5 Golos", 84));

    expect(verdict).toBe("fraco");
    expect(readings[0].tone).toBe("fraco");
    // A força do número continua a ser lida como forte: são leituras
    // diferentes, e escondê-lo seria fingir que o modelo não disse 84%.
    expect(readings[1].tone).toBe("forte");
  });

  it("apanha a banda onde o quadro acertou menos do que abaixo dela", () => {
    const { verdict, readings } = readPick(jogo("1X", 67));

    expect(readings[1].tone).toBe("fraco");
    expect(verdict).toBe("fraco");
  });

  it("avisa quando as equipas estão equilibradas, que é onde o modelo falha", () => {
    const { readings, verdict } = readPick(jogo("1X", 72, 1.4, 1.3));

    expect(readings[2].tone).toBe("fraco");
    expect(verdict).toBe("fraco");
  });

  it("cada leitura é um número e a amostra de onde saiu", () => {
    for (const reading of readPick(jogo("1X", 78)).readings) {
      expect(reading.games).toBeGreaterThan(0);
      expect(reading.pct).toBeGreaterThan(0);
      // Duas ou três palavras: isto é lido de relance, não estudado.
      expect(reading.text.split(" ").length).toBeLessThanOrEqual(4);
    }
  });

  it("diz um traço em vez de um número que não tem", () => {
    // Dois jogos marcados num resultado seco não dão percentagem nenhuma.
    const [mercado] = readPick(jogo("Casa", 78)).readings;

    expect(mercado.pct).toBeNull();
  });

  it("mede o desnível pelos golos esperados de cada lado", () => {
    expect(mismatch({ lambda_casa: 2.1, lambda_fora: 0.9 })).toBeCloseTo(1.2, 5);
    expect(
      Number.isNaN(mismatch({ lambda_casa: undefined, lambda_fora: 1 } as never)),
    ).toBe(true);
  });

  it("não inventa a leitura do jogo quando não há golos esperados", () => {
    const { readings } = readPick({
      headline_market: "1X",
      headline_pct: 78,
    } as BoardMatch);

    expect(readings).toHaveLength(2);
  });
});
