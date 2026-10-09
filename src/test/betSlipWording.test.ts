import { describe, expect, it } from "vitest";
import { marketFamily, pickLabel, slipKind } from "@/lib/betSlip";
import type { PlanLeg } from "@/lib/planStore";

function leg(market: string, home = "Benfica", away = "Porto"): PlanLeg {
  return {
    match: `${home} vs ${away}`,
    homeTeam: home,
    awayTeam: away,
    league: "PPL",
    market,
    odds: 1.5,
    modelProb: 60,
    fixtureId: 1,
    kickoff: null,
    status: "pending",
  };
}

describe("what a bet is called", () => {
  it("names it by how many games are in it", () => {
    expect(slipKind(1)).toBe("Simples");
    expect(slipKind(2)).toBe("Dupla");
    expect(slipKind(3)).toBe("Tripla");
    expect(slipKind(5)).toBe("Múltipla de 5");
  });
});

describe("what was actually backed", () => {
  it("puts the team's name where the market says 'Casa'", () => {
    expect(pickLabel(leg("Casa"))).toBe("Benfica");
    expect(pickLabel(leg("Fora"))).toBe("Porto");
    expect(pickLabel(leg("1X"))).toBe("Benfica ou Empate");
    expect(pickLabel(leg("2X"))).toBe("Porto ou Empate");
  });

  it("writes a combination the way somebody would say it", () => {
    expect(pickLabel(leg("1X e Mais de 1.5 Golos"))).toBe(
      "Benfica ou Empate e Mais de 1.5 Golos",
    );
  });

  it("folds what was typed by hand before naming it", () => {
    // "x2 e +1,5" is the same bet as "2X e Mais de 1.5 Golos".
    expect(pickLabel(leg("x2 e +1,5 golos"))).toBe(
      "Porto ou Empate e Mais de 1.5 Golos",
    );
  });

  it("says Ambas Não Marcam rather than BTTS No", () => {
    expect(pickLabel(leg("BTTS No"))).toBe("Ambas Não Marcam");
  });

  it("falls back to the result when there is no team name", () => {
    expect(pickLabel(leg("1X", "", ""))).toBe("Casa ou Empate");
  });

  it("hands back untouched a market it cannot read", () => {
    expect(pickLabel(leg("Suíça +0.5 escanteios"))).toBe(
      "Suíça +0.5 escanteios",
    );
  });
});

describe("the kind of market, under the pick", () => {
  it("names each family", () => {
    expect(marketFamily("Casa")).toBe("Resultado final");
    expect(marketFamily("1X")).toBe("Hipótese dupla");
    expect(marketFamily("Mais de 2.5 Golos")).toBe("Total de golos");
    expect(marketFamily("Ambas Marcam")).toBe("Ambas marcam");
  });

  it("joins the two halves of a combination", () => {
    expect(marketFamily("1X e Mais de 1.5 Golos")).toBe(
      "Hipótese dupla & Total de golos",
    );
  });

  it("says nothing rather than guessing", () => {
    // A wrong label under a bet is worse than no label.
    expect(marketFamily("Suíça +0.5 escanteios")).toBe("");
  });
});
