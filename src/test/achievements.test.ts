import { describe, expect, it } from "vitest";
import { achievements } from "@/lib/achievements";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

function leg(overrides: Partial<PlanLeg> = {}): PlanLeg {
  return {
    match: "FC Porto vs Casa Pia",
    homeTeam: "FC Porto",
    awayTeam: "Casa Pia",
    league: "Liga Portugal",
    market: "1X",
    odds: 1.3,
    modelProb: 85,
    fixtureId: 1,
    kickoff: null,
    status: "pending",
    ...overrides,
  } as PlanLeg;
}

function bet(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: Math.random().toString(36).slice(2),
    userId: "me",
    legs: [leg()],
    odds: 1.3,
    stake: 5,
    day: 1,
    status: "green",
    profitLoss: 1.5,
    placedAt: "2026-10-01T18:00:00.000Z",
    settledAt: "2026-10-01T22:00:00.000Z",
    ...overrides,
  } as PlanBet;
}

const ids = (bets: PlanBet[], level = 0) =>
  achievements(bets, level).earned.map((item) => item.id);

describe("as conquistas", () => {
  it("não dá nenhuma só por apostar muito", () => {
    // Cinquenta apostas por decidir, nenhuma fechada, todas abaixo do preço
    // a que ficariam a zero. Volume não é conquista nenhuma.
    const many = Array.from({ length: 50 }, () =>
      bet({
        status: "pending",
        settledAt: null,
        odds: 1.05,
        legs: [leg({ modelProb: 85, odds: 1.05 })],
      }),
    );

    expect(ids(many)).toEqual(["primeira"]);
  });

  it("conta a aposta aceite acima do preço a que fica a zero", () => {
    // Uma perna a 85% fica a zero a 1.18: dez a 1.30 ganham-na, dez a 1.10
    // não — e são as de 1.10 que fazem perder dinheiro a acertar.
    const good = Array.from({ length: 10 }, () =>
      bet({ odds: 1.3, legs: [leg({ modelProb: 85, odds: 1.3 })] }),
    );
    const cheap = Array.from({ length: 10 }, () =>
      bet({ odds: 1.1, legs: [leg({ modelProb: 85, odds: 1.1 })] }),
    );

    expect(ids(good)).toContain("preco-certo");
    expect(ids(cheap)).not.toContain("preco-certo");
  });

  it("só conta para a lista curta a dupla hipótese alta", () => {
    const shortlist = Array.from({ length: 25 }, () =>
      bet({ legs: [leg({ market: "1X", modelProb: 78 })] }),
    );
    const goals = Array.from({ length: 25 }, () =>
      bet({ legs: [leg({ market: "Mais de 2.5 Golos", modelProb: 78 })] }),
    );
    const weak = Array.from({ length: 25 }, () =>
      bet({ legs: [leg({ market: "1X", modelProb: 61 })] }),
    );

    expect(ids(shortlist)).toContain("lista-curta");
    expect(ids(goals)).not.toContain("lista-curta");
    expect(ids(weak)).not.toContain("lista-curta");
  });

  it("dá a mesa limpa a quem não tem nada por fechar, e tira-a a quem tem", () => {
    const closed = Array.from({ length: 10 }, () => bet());
    expect(ids(closed)).toContain("sem-pendencias");

    expect(ids([...closed, bet({ status: "pending", settledAt: null })])).not.toContain(
      "sem-pendencias",
    );
  });

  it("premeia dizer quais das pernas falharam", () => {
    const named = Array.from({ length: 5 }, () =>
      bet({
        status: "red",
        profitLoss: -5,
        legs: [
          leg({ status: "green" }),
          leg({ match: "B vs C", status: "red" }),
        ],
      }),
    );
    const vague = Array.from({ length: 5 }, () =>
      bet({
        status: "red",
        profitLoss: -5,
        legs: [leg({ status: "pending" }), leg({ match: "B vs C", status: "pending" })],
      }),
    );

    expect(ids(named)).toContain("disse-o-que-falhou");
    expect(ids(vague)).not.toContain("disse-o-que-falhou");
  });

  it("conta a corrida pela ordem em que as apostas foram registadas", () => {
    const run = [
      bet({ placedAt: "2026-10-01T10:00:00.000Z" }),
      bet({ placedAt: "2026-10-02T10:00:00.000Z" }),
      bet({ placedAt: "2026-10-03T10:00:00.000Z", status: "red", profitLoss: -5 }),
      bet({ placedAt: "2026-10-04T10:00:00.000Z" }),
      bet({ placedAt: "2026-10-05T10:00:00.000Z" }),
      bet({ placedAt: "2026-10-06T10:00:00.000Z" }),
    ];

    // Três antes da derrota e três depois: nenhuma corrida de cinco.
    expect(ids(run)).not.toContain("cinco-seguidas");
    expect(
      ids([...run, bet({ placedAt: "2026-10-07T10:00:00.000Z" }), bet({ placedAt: "2026-10-08T10:00:00.000Z" })]),
    ).toContain("cinco-seguidas");
  });

  it("os níveis vêm do desafio, não das apostas", () => {
    expect(ids([bet()], 10)).toContain("nivel-dez");
    expect(ids([bet()], 9)).not.toContain("nivel-dez");
    expect(ids([bet()], 20)).toContain("nivel-vinte");
  });

  it("aponta a seguinte como a que está mais perto de sair", () => {
    // Vinte e quatro de vinte e cinco na lista curta está mais perto do que
    // uma de cinquenta decididas, mesmo faltando o mesmo número.
    const bets = Array.from({ length: 24 }, () =>
      bet({ legs: [leg({ market: "2X", modelProb: 74 })] }),
    );

    expect(achievements(bets).next?.id).toBe("lista-curta");
  });

  it("não inventa nada para quem ainda não registou nada", () => {
    const view = achievements([]);

    expect(view.earned).toEqual([]);
    expect(view.next?.id).toBe("primeira");
  });
});
