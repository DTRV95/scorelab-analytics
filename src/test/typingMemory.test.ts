import { describe, expect, it } from "vitest";
import { typingMemory } from "@/lib/typingMemory";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

function leg(home: string, away: string, market: string): PlanLeg {
  return {
    match: `${home} vs ${away}`,
    homeTeam: home,
    awayTeam: away,
    league: "Adicionado à mão",
    market,
    odds: 1.5,
    modelProb: 0,
    fixtureId: null,
    kickoff: null,
    status: "pending",
  };
}

function bet(legs: PlanLeg[]): PlanBet {
  return {
    id: Math.random().toString(36),
    userId: "david",
    legs,
    odds: 1.5,
    stake: 5,
    day: 1,
    status: "pending",
    profitLoss: 0,
    placedAt: "2026-09-29T10:00:00.000Z",
    settledAt: null,
  };
}

describe("what has already been typed on these slips", () => {
  it("offers the markets most used first, folded to one name", () => {
    const memory = typingMemory([
      bet([leg("Espanha", "Croácia", "V1")]),
      bet([leg("Chéquia", "Inglaterra", "V2")]),
      bet([leg("Escócia", "Suíça", "V1")]),
      bet([leg("Grécia", "Países Baixos", "Casa")]),
    ]);

    // "V1" and "Casa" are the same bet written two ways: three uses, not two
    // markets, and the name is the one the model also uses.
    expect(memory.markets[0]).toBe("Casa");
    expect(memory.markets).toEqual(["Casa", "Fora"]);
  });

  it("keeps the spelling most used, not the first seen", () => {
    // The odd one out is usually the typo, and the spelling somebody writes
    // most is the one they will recognise in a list.
    const memory = typingMemory([
      bet([leg("Suiça", "Escócia", "V1")]),
      bet([leg("Suíça", "Noruega", "V1")]),
      bet([leg("Suíça", "Grécia", "V1")]),
    ]);

    expect(memory.teams).toContain("Suíça");
    expect(memory.teams).not.toContain("Suiça");
  });

  it("counts both sides of every game", () => {
    const memory = typingMemory([bet([leg("Gales", "Noruega", "X2")])]);

    expect(memory.teams).toEqual(["Gales", "Noruega"]);
  });

  it("leaves two genuinely different names alone", () => {
    // "Gales" and "País de Gales" are the same side, but nothing here can know
    // that. Both are offered, so the next slip picks one instead of a third.
    const memory = typingMemory([
      bet([leg("Gales", "Noruega", "X2")]),
      bet([leg("País de Gales", "Noruega", "X2")]),
    ]);

    expect(memory.teams).toContain("Gales");
    expect(memory.teams).toContain("País de Gales");
  });

  it("has nothing to say about an empty record", () => {
    expect(typingMemory([])).toEqual({ markets: [], teams: [] });
  });

  it("ignores a blank market rather than offering one", () => {
    const memory = typingMemory([bet([leg("Braga", "Estoril", "   ")])]);

    expect(memory.markets).toEqual([]);
  });
});
