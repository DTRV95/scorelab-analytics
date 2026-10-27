import { describe, expect, it } from "vitest";
import { tribunal, type Vote } from "@/lib/tribunal";
import { readPatterns } from "@/lib/betPatterns";
import type { MarketQuote } from "@/lib/suggestion";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

/**
 * O tribunal não decide: mostra a decisão por dentro.
 *
 * O que estes testes guardam é que cada testemunha fala do que sabe e
 * se cala do que não sabe — e sobretudo que calar-se nunca conta como
 * voto a favor. Um tribunal onde a ausência de prova absolve é um
 * tribunal que absolve sempre.
 */

const pick = (over: Partial<MarketQuote> = {}): MarketQuote => ({
  market: "1X",
  raw: 70,
  ours: 59,
  marketPct: 57,
  price: 1.8,
  fairPrice: 1.7,
  edge: 59 - 100 / 1.8,
  gap: 2,
  derived: false,
  ...over,
});

const registo = (over: Partial<AccuracyMarket> = {}): AccuracyMarket => ({
  market: "1X",
  grupo: "Resultado",
  samples: 120,
  predicted_pct: 70,
  actual_pct: 69,
  gap_pp: -1,
  brier: 0.2,
  ...over,
});

const out = (quantos: number) =>
  Array.from({ length: quantos }, (_, i) => ({ name: `J${i}`, status: "out" }));

const voto = (trial: ReturnType<typeof tribunal>, who: string): Vote =>
  trial.judges.find((judge) => judge.who === who)!.vote;

describe("tribunal", () => {
  it("ouve sempre as cinco, mesmo sem jogo nenhum", () => {
    const trial = tribunal({ record: new Map() }, null);

    expect(trial.judges.map((judge) => judge.who)).toEqual([
      "Modelo",
      "Mercado",
      "Registo",
      "Dinheiro",
      "Plantel",
    ]);
    // Sem provas, ninguém vota — e ninguém vota a favor por omissão.
    expect(trial.favour).toBe(0);
    expect(trial.against).toBe(0);
  });

  it("o modelo vota pelo preço que lhe põem à frente", () => {
    expect(voto(tribunal({ record: new Map() }, pick()), "Modelo")).toBe("bate");
    expect(
      voto(tribunal({ record: new Map() }, pick({ price: 1.5, edge: -7 })), "Modelo"),
    ).toBe("falha");
  });

  it("o mercado concordar connosco é prova, discordar muito é aviso", () => {
    const concorda = tribunal({ record: new Map() }, pick({ gap: 2 }));
    const discorda = tribunal({ record: new Map() }, pick({ gap: 11 }));
    const nemUm = tribunal({ record: new Map() }, pick({ gap: 5 }));

    expect(voto(concorda, "Mercado")).toBe("bate");
    expect(voto(discorda, "Mercado")).toBe("falha");
    expect(voto(nemUm, "Mercado")).toBe("cala-se");
  });

  it("o registo cala-se com poucos jogos e acusa quando promete de mais", () => {
    const magro = tribunal(
      { record: new Map([["1X", registo({ samples: 10 })]]) },
      pick(),
    );
    const mau = tribunal(
      {
        record: new Map([
          ["1X", registo({ gap_pp: -12, predicted_pct: 72, actual_pct: 60 })],
        ]),
      },
      pick(),
    );

    expect(voto(magro, "Registo")).toBe("cala-se");
    expect(voto(mau, "Registo")).toBe("falha");
    expect(
      trialBecause(mau, "Registo"),
    ).toContain("prometeu 72% e entregou 60%");
  });

  it("o dinheiro fala do que já perdemos em mercados assim", () => {
    const perdedor = readPatterns([
      ...Array.from({ length: 10 }, () => ({
        market: "Menos de 3.5 Golos",
        odds: 1.3,
        won: true,
      })),
      ...Array.from({ length: 6 }, () => ({
        market: "Menos de 3.5 Golos",
        odds: 1.3,
        won: false,
      })),
    ]);

    const trial = tribunal(
      { record: new Map(), patterns: perdedor },
      pick({ market: "Menos de 3.5 Golos" }),
    );

    expect(voto(trial, "Dinheiro")).toBe("falha");
    expect(trialBecause(trial, "Dinheiro")).toContain("cêntimos por euro");
  });

  it("o plantel distingue não haver baixas de ninguém ter olhado", () => {
    const completos = tribunal(
      {
        record: new Map(),
        teams: { home: "Alavés", away: "Málaga" },
        absences: { Alavés: [], Málaga: [] },
      },
      pick(),
    );
    const desfalcado = tribunal(
      {
        record: new Map(),
        teams: { home: "Chelsea", away: "Tottenham" },
        absences: { Chelsea: out(8), Tottenham: out(6) },
      },
      pick(),
    );
    const ninguemOlhou = tribunal(
      { record: new Map(), teams: { home: "A", away: "B" }, absences: null },
      pick(),
    );

    expect(voto(completos, "Plantel")).toBe("bate");
    expect(voto(desfalcado, "Plantel")).toBe("falha");
    expect(trialBecause(desfalcado, "Plantel")).toContain("Chelsea com 8 fora");
    expect(voto(ninguemOlhou, "Plantel")).toBe("cala-se");
  });

  it("conta os votos, e quem se cala não conta para nenhum lado", () => {
    const trial = tribunal(
      {
        record: new Map([["1X", registo()]]),
        teams: { home: "A", away: "B" },
        absences: { A: [], B: [] },
      },
      pick(),
    );

    // Modelo, Mercado, Registo e Plantel a favor; o Dinheiro cala-se.
    expect(trial.favour).toBe(4);
    expect(trial.against).toBe(0);
    expect(trial.favour + trial.against).toBeLessThan(trial.judges.length);
  });
});

function trialBecause(trial: ReturnType<typeof tribunal>, who: string): string {
  return trial.judges.find((judge) => judge.who === who)!.because;
}

describe("o dinheiro que ficou na mesma", () => {
  it("cala-se em vez de votar a favor", () => {
    // Dez a 1,40 e quatro falhadas devolvem exactamente o que levaram.
    // Quem saiu de lá com o dinheiro com que entrou não tem nada a
    // dizer sobre o próximo, e contar isso como voto favorável era
    // encher o tribunal de maiorias feitas de nada.
    const empatado = readPatterns([
      ...Array.from({ length: 10 }, () => ({
        market: "Mais de 2.5 Golos",
        odds: 1.4,
        won: true,
      })),
      ...Array.from({ length: 4 }, () => ({
        market: "Mais de 2.5 Golos",
        odds: 1.4,
        won: false,
      })),
    ]);

    const trial = tribunal(
      { record: new Map(), patterns: empatado },
      pick({ market: "Mais de 2.5 Golos" }),
    );

    expect(voto(trial, "Dinheiro")).toBe("cala-se");
    expect(trialBecause(trial, "Dinheiro")).toContain("ficámos na mesma");
  });
});
