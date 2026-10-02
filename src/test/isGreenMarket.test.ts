import { describe, expect, it } from "vitest";
import { isGreenMarket } from "@/lib/modelAudit";

// Casa 1 - Fora 3: the away side won, four goals, both scored.
const away = (market: string) => isGreenMarket(market, 1, 3);
// Casa 2 - Fora 0: the home side won, two goals, one side blanked.
const home = (market: string) => isGreenMarket(market, 2, 0);
const nil = (market: string) => isGreenMarket(market, 0, 0);

describe("reading a market off the final score", () => {
  it("reads the shorthand these two write", () => {
    // Nine of the eleven markets on their own slips came back unreadable
    // while this went by raw text, which meant the provider's scores could
    // never close any of them.
    expect(away("V1")).toBe(false);
    expect(away("V2")).toBe(true);
    expect(away("X2")).toBe(true);
    expect(away("AM")).toBe(true);
    expect(home("AM")).toBe(false);
    expect(away("AM - Não")).toBe(false);
    expect(home("AM - Não")).toBe(true);
  });

  it("reads a goals line written with a comma", () => {
    expect(away("Mais de 2,5 Golos")).toBe(true);
    expect(home("Mais de 2,5 Golos")).toBe(false);
    expect(home("Menos de 2,5 Golos")).toBe(true);
  });

  it("reads a goals line at any number, not only the four hard-coded ones", () => {
    expect(away("Mais de 1.5 Golos")).toBe(true);
    expect(nil("Mais de 1.5 Golos")).toBe(false);
    expect(away("Menos de 4.5 Golos")).toBe(true);
    expect(away("Mais de 4.5 Golos")).toBe(false);
  });

  it("needs every half of a combination, not the one it happens to read", () => {
    // This is how "Casa e Mais de 2.5 Golos" came to be green on a 1-3 away
    // win: the goals were there, the result was not, and nothing looked at
    // the result.
    expect(away("1 e + 2,5 Golos")).toBe(false);
    expect(isGreenMarket("1 e + 2,5 Golos", 3, 1)).toBe(true);
    expect(away("X2 e +1,5 Golos")).toBe(true);
    expect(isGreenMarket("X2 e +1,5 Golos", 1, 0)).toBe(false);
    expect(away("V1 e AM - Não")).toBe(false);
    expect(isGreenMarket("V1 e AM - Não", 2, 0)).toBe(true);
  });

  it("stays quiet on anything it cannot read in full", () => {
    // Money rides on this, so silence is the only safe answer.
    expect(away("Inglaterra")).toBeNull();
    expect(away("Suíça +0.5")).toBeNull();
    expect(away("Casa e escanteios acima de 9")).toBeNull();
    expect(away("")).toBeNull();
  });

  it("still reads the plain names and the English ones", () => {
    expect(away("Casa")).toBe(false);
    expect(away("Fora")).toBe(true);
    expect(nil("Empate")).toBe(true);
    expect(away("1X")).toBe(false);
    expect(away("over 2.5")).toBe(true);
    expect(away("under 2.5")).toBe(false);
    expect(away("BTTS")).toBe(true);
    expect(home("btts no")).toBe(true);
    expect(away("2X e Menos de 3.5 Golos")).toBe(false);
  });
});
