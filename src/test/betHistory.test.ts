import { describe, expect, it } from "vitest";
import {
  buildHistory,
  byMonth,
  filterHistory,
  historyTotals,
} from "@/lib/betHistory";
import type { PlanBet, PlanRecord } from "@/lib/planStore";

const plan = (id: string, name: string, ended = false): PlanRecord => ({
  id,
  name,
  starting_bankroll: 10,
  target: 1000,
  created_by: "u1",
  start_date: null,
  days: 38,
  rules: {},
  visible: false,
  template_key: null,
  ended_at: ended ? "2026-10-01T10:00:00.000Z" : null,
  ended_by: ended ? "u1" : null,
});

function bet(
  id: string,
  planId: string,
  placedAt: string,
  status: PlanBet["status"],
  extra: Partial<PlanBet> = {},
): PlanBet & { planId: string } {
  const stake = 5;
  return {
    planId,
    id,
    userId: "u1",
    legs: [
      {
        match: "FC Porto vs Rio Ave",
        homeTeam: "FC Porto",
        awayTeam: "Rio Ave",
        league: "Liga Portugal",
        market: "Casa",
        odds: 2,
        modelProb: 60,
        fixtureId: 1,
        kickoff: null,
        status: "pending",
      },
    ],
    odds: 2,
    stake,
    day: 1,
    status,
    profitLoss: status === "green" ? 5 : status === "red" ? -5 : 0,
    placedAt,
    settledAt: status === "pending" ? null : placedAt,
    ...extra,
  };
}

const plans = [plan("p1", "Plano Milhão"), plan("p2", "Dez mil em 20", true)];

const registo = [
  bet("b1", "p1", "2026-09-10T10:00:00.000Z", "green"),
  bet("b2", "p2", "2026-10-02T10:00:00.000Z", "red"),
  bet("b3", "p1", "2026-10-15T10:00:00.000Z", "pending"),
];

describe("o histórico de apostas", () => {
  it("junta os desafios todos, da mais recente para a mais antiga", () => {
    // Cada desafio mostrava as suas e mais nada, e os terminados estão
    // atrás de uma prateleira própria: na prática não se via o que se fez.
    const history = buildHistory(registo, plans);

    expect(history.map((entry) => entry.bet.id)).toEqual(["b3", "b2", "b1"]);
    expect(history[0].plan).toBe("Plano Milhão");
    expect(history[1].plan).toBe("Dez mil em 20");
    expect(history[1].ended).toBe(true);
  });

  it("não deixa cair uma aposta cujo desafio já não existe", () => {
    const history = buildHistory(
      [bet("b9", "apagado", "2026-10-01T10:00:00.000Z", "green")],
      plans,
    );

    expect(history).toHaveLength(1);
    expect(history[0].plan).toBe("Desafio apagado");
  });
});

describe("filtrar o histórico", () => {
  const history = buildHistory(registo, plans);

  it("por desafio", () => {
    const so = filterHistory(history, { planId: "p1" });
    expect(so.map((entry) => entry.bet.id)).toEqual(["b3", "b1"]);
  });

  it("por como acabou", () => {
    expect(
      filterHistory(history, { outcome: "ganhas" }).map((e) => e.bet.id),
    ).toEqual(["b1"]);
    expect(
      filterHistory(history, { outcome: "perdidas" }).map((e) => e.bet.id),
    ).toEqual(["b2"]);
    expect(
      filterHistory(history, { outcome: "abertas" }).map((e) => e.bet.id),
    ).toEqual(["b3"]);
  });

  it("por equipa, mercado, competição ou desafio", () => {
    expect(filterHistory(history, { text: "rio ave" })).toHaveLength(3);
    expect(filterHistory(history, { text: "Liga Portugal" })).toHaveLength(3);
    expect(filterHistory(history, { text: "Dez mil" })).toHaveLength(1);
    expect(filterHistory(history, { text: "benfica" })).toHaveLength(0);
  });

  it("não procura espaços em branco", () => {
    expect(filterHistory(history, { text: "   " })).toHaveLength(3);
  });
});

describe("o que a lista no ecrã soma", () => {
  it("conta só o que já fechou, e diz quanto isso rendeu", () => {
    // Uma aposta em aberto não ganhou nem perdeu, e contá-la como perdida
    // seria dizer que o dinheiro já saiu.
    const totals = historyTotals(buildHistory(registo, plans));

    expect(totals.bets).toBe(3);
    expect(totals.settled).toBe(2);
    expect(totals.won).toBe(1);
    expect(totals.winPct).toBe(50);
    expect(totals.staked).toBe(10);
    expect(totals.profit).toBe(0);
    expect(totals.roi).toBe(0);
  });

  it("não inventa uma taxa quando não há nada fechado", () => {
    // 0% seria uma mentira: não é que se tenha falhado tudo, é que ainda
    // não se decidiu nada.
    const totals = historyTotals(
      buildHistory([bet("b3", "p1", "2026-10-15T10:00:00.000Z", "pending")], plans),
    );

    expect(totals.winPct).toBeNull();
    expect(totals.roi).toBeNull();
  });

  it("soma o que está filtrado, não o registo inteiro", () => {
    // É a pergunta por que se filtra: "e nisto, como é que me tenho saído?"
    const history = buildHistory(registo, plans);
    const totals = historyTotals(filterHistory(history, { planId: "p2" }));

    expect(totals.settled).toBe(1);
    expect(totals.profit).toBe(-5);
  });
});

describe("agrupar por mês", () => {
  it("dá degraus por onde descer a lista", () => {
    const grupos = byMonth(buildHistory(registo, plans));

    expect(grupos).toHaveLength(2);
    expect(grupos[0].entries.map((e) => e.bet.id)).toEqual(["b3", "b2"]);
    expect(grupos[1].entries.map((e) => e.bet.id)).toEqual(["b1"]);
  });
});
