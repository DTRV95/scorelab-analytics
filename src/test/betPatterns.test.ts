import { describe, expect, it } from "vitest";
import {
  familyOf,
  implied,
  losing,
  patternFor,
  proven,
  readPatterns,
  type SettledLeg,
} from "@/lib/betPatterns";

/**
 * As pernas a sério, como estão guardadas.
 *
 * Os mercados vêm escritos à mão e cada um escreve o seu: "menos de 3.5
 * golos", "-4,5 golos", "x2 é mais de 1,5 golos". Se a conta não aguenta
 * isto não aguenta nada, por isso são estas as que estão aqui.
 */
const n = (market: string, odds: number, won: boolean, vezes = 1) =>
  Array.from({ length: vezes }, () => ({ market, odds, won }));

const legs: SettledLeg[] = [
  ...n("1x", 1.28, true, 23),
  ...n("1x", 1.28, false, 4),
  ...n("2x", 1.23, true, 5),
  ...n("2x", 1.23, false, 2),
  ...n("x2", 1.29, true, 3),
  ...n("menos de 3.5 golos", 1.32, true, 3),
  ...n("menos de 3.5 golos", 1.32, false, 5),
  ...n("-4,5 golos", 1.23, true),
  ...n("-4,5 golos", 1.23, false),
  ...n("-3,5 golos", 1.32, true),
  ...n("-3.5", 1.34, true, 2),
  ...n("menos de 4,5 golos", 1.07, true),
  ...n("menos de 5,5 golos", 1.1, true),
  ...n("menos de 5.5 golos", 1.1, true),
  ...n("mais de 2.5 golos", 1.37, true, 6),
  ...n("mais de 2.5 golos", 1.37, false),
  ...n("mais de 2,5 golos", 1.43, true, 4),
  ...n("mais de 2,5 golos", 1.43, false, 2),
  ...n("mais 1.5 golos", 1.3, true),
  ...n("ambas marcam", 1.56, true, 5),
  ...n("ambas marcam", 1.56, false, 3),
  ...n("ambas marcam - sim", 1.45, true, 3),
  ...n("am", 1.55, true),
  ...n("am", 1.55, false),
  ...n("1x e menos de 3.5 golos", 1.89, true, 4),
  ...n("1x e menos de 3.5 golos", 1.89, false),
  ...n("1x e mais de 2.5 golos", 1.6, true, 3),
  ...n("1x e mais de 2.5 golos", 1.6, false),
  ...n("1 e mais de 1,5 golos", 1.36, true),
  ...n("1 e mais de 1,5 golos", 1.36, false),
  ...n("v1 e am - não", 1.4, false),
  ...n("v2", 1.69, true, 5),
  ...n("v1", 1.31, true, 3),
  ...n("v1", 1.31, false),
  ...n("casa", 1.26, true, 2),
];

describe("familyOf", () => {
  it("lê o que cada um escreveu, em todas as grafias", () => {
    expect(familyOf("1x")).toBe("dupla hipótese");
    expect(familyOf("X2")).toBe("dupla hipótese");
    expect(familyOf("-4,5 golos")).toBe("menos de X golos");
    expect(familyOf("menos de 3.5 golos")).toBe("menos de X golos");
    expect(familyOf("mais 1.5 golos")).toBe("mais de X golos");
    expect(familyOf("am")).toBe("ambas marcam");
    expect(familyOf("1x e menos de 3.5 golos")).toBe("combinado");
    expect(familyOf("v2")).toBe("vencedor simples");
  });

  it("não deixa um combinado passar por uma das metades dele", () => {
    // "1X e Menos de 3.5" é um mercado diferente do 1X e tem de contar
    // noutro sítio: entra bem menos vezes e paga bem mais.
    expect(familyOf("1x e menos de 3.5 golos")).not.toBe("dupla hipótese");
  });
});

describe("readPatterns", () => {
  it("recusa-se a medir o que não dá para medir", () => {
    expect(readPatterns(legs.slice(0, 5))).toBeNull();
  });

  it("encontra a família que perde dinheiro, e só essa", () => {
    const found = readPatterns(legs)!;

    expect(found.families.filter(losing).map((row) => row.key)).toEqual([
      "menos de X golos",
    ]);
  });

  it("não dá nada por provado, que é o que os números dão", () => {
    // A que mais perde fica a dezasseis pontos do que o preço pedia,
    // com uma margem de vinte e quatro. Cabe lá dentro, logo não é um
    // padrão — é uma semana. Este teste existe para o dia em que
    // deixar de ser verdade dar erro aqui em vez de passar em branco.
    const found = readPatterns(legs)!;

    expect(found.families.filter(proven)).toEqual([]);
  });

  it("diz que o preço é o problema, e não o acerto", () => {
    const found = readPatterns(legs)!;
    const golos = found.families.find((r) => r.key === "menos de X golos")!;
    const dupla = found.families.find((r) => r.key === "dupla hipótese")!;

    // Entram seis em cada dez e estão cotadas para entrarem oito.
    expect(golos.rate).toBeCloseTo(62.5, 0);
    expect(golos.needed).toBeGreaterThan(golos.paid);
    expect(golos.perEuro).toBeLessThan(0);

    // A dupla hipótese entra menos vezes do que um vencedor simples e
    // mesmo assim paga, porque é cotada em conformidade.
    expect(dupla.needed).toBeLessThan(dupla.paid);
    expect(dupla.perEuro).toBeGreaterThan(0);
  });

  it("ordena pelo que cada euro devolve, não pelo acerto", () => {
    const found = readPatterns(legs)!;
    const ordem = found.families.map((row) => row.key);

    expect(ordem[0]).toBe("menos de X golos");
    expect(ordem[ordem.length - 1]).toBe("vencedor simples");
  });

  it("deixa de fora os grupos pequenos de mais para dizerem alguma coisa", () => {
    const found = readPatterns(legs)!;

    expect(found.families.every((row) => row.n >= 10)).toBe(true);
    expect(found.markets.every((row) => row.n >= 10)).toBe(true);
  });
});

describe("implied", () => {
  it("mede cada família contra o preço dela, não contra as outras", () => {
    const found = readPatterns(legs)!;
    const dupla = found.families.find((r) => r.key === "dupla hipótese")!;
    const ambas = found.families.find((r) => r.key === "ambas marcam")!;

    // A dupla acerta muito mais do que o "ambas marcam" e não é por
    // isso que é melhor: é mais barata, e tem de acertar mais.
    expect(dupla.rate).toBeGreaterThan(ambas.rate);
    expect(implied(dupla)).toBeGreaterThan(implied(ambas));

    // As duas pagam, apesar da diferença de acerto entre elas.
    expect(losing(dupla)).toBe(false);
    expect(losing(ambas)).toBe(false);
  });
});

describe("patternFor", () => {
  it("liga um mercado sugerido ao que as nossas apostas dizem dele", () => {
    const found = readPatterns(legs);

    expect(patternFor("Menos de 3.5 Golos", found)?.key).toBe(
      "menos de X golos",
    );
    expect(patternFor("Menos de 3.5 Golos", null)).toBeNull();
  });
});
