import { describe, expect, it } from "vitest";
import { canonicalMarket } from "@/lib/marketNames";

describe("folding the same bet written five ways", () => {
  it("reads a goals line however it was typed", () => {
    // All of these are on the slips already.
    ["-3.5", "-3,5", "-3,5 Golos", "-3.5 golos", "Menos de 3.5", "under 3.5 goals"]
      .forEach((written) => {
        expect(canonicalMarket(written)).toBe("Menos de 3.5 Golos");
      });

    ["+2.5", "+2,5 Golos", "Mais de 2.5", "over 2.5"].forEach((written) => {
      expect(canonicalMarket(written)).toBe("Mais de 2.5 Golos");
    });
  });

  it("keeps a handicap out of the goals lines", () => {
    // A handicap always names the team it applies to; a bare sign and number
    // cannot be one, which is what makes the rule above safe.
    expect(canonicalMarket("Suíça +0.5")).toBe("Suíça +0.5");
    expect(canonicalMarket("Benfica -1,5")).toBe("Benfica -1,5");
  });

  it("folds the double chance and the both-teams markets", () => {
    expect(canonicalMarket("X2")).toBe("2X");
    expect(canonicalMarket("2x")).toBe("2X");
    expect(canonicalMarket("Fora ou Empate")).toBe("2X");
    expect(canonicalMarket("1X")).toBe("1X");
    expect(canonicalMarket("Ambas Marcam - Sim")).toBe("Ambas Marcam");
    expect(canonicalMarket("BTTS")).toBe("Ambas Marcam");
    expect(canonicalMarket("ambas não marcam")).toBe("BTTS No");
  });

  it("folds the result markets", () => {
    expect(canonicalMarket("casa")).toBe("Casa");
    expect(canonicalMarket("Vitória Casa")).toBe("Casa");
    expect(canonicalMarket("EMPATE")).toBe("Empate");
  });

  it("hands back anything it cannot recognise, only tidied", () => {
    // A team to win, a wording nobody anticipated: guessing would be worse
    // than leaving it as written.
    expect(canonicalMarket("França")).toBe("França");
    expect(canonicalMarket("  Suíça   Para Vencer ")).toBe("Suíça Para Vencer");
    expect(canonicalMarket("Escanteios +9.5")).toBe("Escanteios +9.5");
  });

  it("survives an empty market without inventing one", () => {
    expect(canonicalMarket("")).toBe("");
    expect(canonicalMarket("   ")).toBe("");
  });
});
