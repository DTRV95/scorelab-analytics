import { describe, expect, it } from "vitest";
import {
  growthPerBet,
  measuredEdge,
  MIN_FOR_EDGE,
  sustainableStake,
} from "@/lib/measuredEdge";
import type { PlanBet } from "@/lib/planStore";

function bet(won: boolean, odds: number, index: number): PlanBet {
  const stake = 5;
  return {
    id: `b${index}`,
    userId: "u1",
    legs: [],
    odds,
    stake,
    day: 1,
    status: won ? "green" : "red",
    profitLoss: won ? Number((stake * (odds - 1)).toFixed(2)) : -stake,
    placedAt: `2026-09-${String(1 + (index % 28)).padStart(2, "0")}T10:00:00.000Z`,
    settledAt: `2026-09-${String(1 + (index % 28)).padStart(2, "0")}T20:00:00.000Z`,
  };
}

/** `wins` ganhas e o resto perdidas, todas à mesma odd. */
const registo = (wins: number, total: number, odds: number) =>
  Array.from({ length: total }, (_, i) => bet(i < wins, odds, i));

describe("a vantagem medida no registo de quem aposta", () => {
  it("cala-se enquanto o registo for curto", () => {
    // Com cinco apostas a taxa de acerto é uma moeda a cair umas vezes
    // seguidas, e pôr ruído ao lado de uma quantia em euros é pior do que
    // não pôr nada.
    expect(measuredEdge(registo(3, 5, 2))).toBeNull();
    expect(measuredEdge(registo(10, MIN_FOR_EDGE - 1, 2))).toBeNull();
    expect(measuredEdge(registo(10, MIN_FOR_EDGE, 2))).not.toBeNull();
  });

  it("não conta as apostas por decidir", () => {
    const abertas = registo(10, 20, 2).map((entry, index) =>
      index >= 16
        ? { ...entry, status: "pending" as const, profitLoss: 0 }
        : entry,
    );

    expect(measuredEdge(abertas)?.settled).toBe(16);
  });

  it("mede o que cada euro devolve, que não é a taxa de acerto", () => {
    // 55% a 1,80 é dinheiro; 55% a 1,70 é perder devagar. A taxa de acerto
    // é igual nos dois e a resposta é o contrário uma da outra.
    const bom = measuredEdge(registo(11, 20, 1.8));
    const mau = measuredEdge(registo(11, 20, 1.7));

    expect(bom?.winPct).toBe(55);
    expect(mau?.winPct).toBe(55);
    expect(bom?.perEuro).toBeCloseTo(0.99, 2);
    expect(mau?.perEuro).toBeCloseTo(0.935, 2);
  });

  it("não manda apostar nada quando a vantagem é negativa", () => {
    // Com uma aposta má em si mesma a resposta é zero, e não "aposta
    // pouco": apostar pouco numa coisa que perde é perder devagar.
    const edge = measuredEdge(registo(10, 20, 1.8));

    expect(edge?.perEuro).toBeLessThan(1);
    expect(edge?.stakePct).toBe(0);
    expect(sustainableStake(edge!, 100)).toBe(0);
  });

  it("dá a fracção que a vantagem aguenta quando ela existe", () => {
    // 60% a 2,00: Kelly diz 20% da banca. Nem metade, nem tudo.
    const edge = measuredEdge(registo(12, 20, 2));

    expect(edge?.perEuro).toBeCloseTo(1.2, 2);
    expect(edge?.stakePct).toBeCloseTo(20, 1);
    expect(sustainableStake(edge!, 50)).toBeCloseTo(10, 1);
  });
});

describe("o que a banca faz por aposta", () => {
  it("encolhe quando se aposta muito acima do que a vantagem aguenta", () => {
    // O caso do Plano Milhão: metade da banca com 51% de acerto a 2,03.
    // Ganhar uma e perder outra deixa 72% do que lá estava, e nenhuma maré
    // de sorte corrige isso.
    const edge = measuredEdge(registo(51, 100, 2.03))!;

    expect(growthPerBet(edge, 50)).toBeLessThan(0.9);
  });

  it("cresce quando se aposta o que ela aguenta", () => {
    const edge = measuredEdge(registo(60, 100, 2))!;

    expect(growthPerBet(edge, edge.stakePct)).toBeGreaterThan(1);
  });

  it("não responde a uma fracção que não é uma fracção", () => {
    const edge = measuredEdge(registo(60, 100, 2))!;

    expect(growthPerBet(edge, 0)).toBeNull();
    expect(growthPerBet(edge, 100)).toBeNull();
  });
});
