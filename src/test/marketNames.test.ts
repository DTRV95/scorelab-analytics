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

// Every one of these was read off the bets already registered. Before this,
// none of them was recognised: "V1" and "Casa" counted as two markets, "AM"
// and "Ambas Marcam" as two more, and the two spellings of "X2 e +1,5 golos"
// as two again — which is why the analysis could almost never reach the three
// decided days it needs before it says anything.
describe("the shorthand these two actually write", () => {
  it("reads V1, V2 and AM", () => {
    expect(canonicalMarket("V1")).toBe("Casa");
    expect(canonicalMarket("V2")).toBe("Fora");
    expect(canonicalMarket("AM")).toBe("Ambas Marcam");
    expect(canonicalMarket("AM - Não")).toBe("BTTS No");
  });

  it("folds a combination, whichever way round it was typed", () => {
    // And onto the model's own spelling of it, so a bet typed by hand lands
    // on the very market the board already forecasts.
    expect(canonicalMarket("X2 e +1.5 golos")).toBe("2X e Mais de 1.5 Golos");
    expect(canonicalMarket("X2 e +1,5 Golos")).toBe("2X e Mais de 1.5 Golos");
    expect(canonicalMarket("+1,5 golos e X2")).toBe("2X e Mais de 1.5 Golos");
    expect(canonicalMarket("1 e + 2,5 Golos")).toBe("Casa e Mais de 2.5 Golos");
    expect(canonicalMarket("V1 e AM - Não")).toBe("Casa e BTTS No");
  });

  it("leaves a combination alone unless it reads every half", () => {
    // Half a fold is worse than none: tidied into something else, it would be
    // a different bet from the one somebody placed.
    expect(canonicalMarket("Casa e escanteios acima de 9")).toBe(
      "Casa e escanteios acima de 9",
    );
    expect(canonicalMarket("Benfica e Sporting")).toBe("Benfica e Sporting");
  });

  it("does not read a double chance written with 'e' as both at once", () => {
    expect(canonicalMarket("Casa ou Empate")).toBe("1X");
    expect(canonicalMarket("casa e empate")).toBe("1X");
    expect(canonicalMarket("Fora e Empate")).toBe("2X");
  });
});
