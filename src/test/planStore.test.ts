import { describe, expect, it } from "vitest";
import {
  ladderFor,
  MILLION_PLAN_RULES,
  stakeForDay,
} from "@/lib/challengeRules";
import {
  buildStanding,
  combineOdds,
  combinedModelProb,
  editBet,
  isManualLeg,
  openFixtureRefs,
  type PlanFunds,
  reopenBet,
  resettleBet,
  setLegStatus,
  setRemainingLegs,
  settleFromScores,
  settleLostWith,
  settleManually,
  type PlanBet,
  type PlanMember,
} from "@/lib/planStore";

const member: PlanMember = {
  plan_id: "plan",
  user_id: "u1",
  display_name: "David",
  starting_bankroll: 10,
};

function leg(overrides: Partial<PlanBet["legs"][number]> = {}) {
  return {
    match: "FC Porto vs SL Benfica",
    homeTeam: "FC Porto",
    awayTeam: "SL Benfica",
    league: "Liga Portugal",
    market: "Casa",
    odds: 2,
    modelProb: 60,
    fixtureId: 1,
    kickoff: null,
    status: "pending" as const,
    ...overrides,
  };
}

function bet(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: "b1",
    userId: "u1",
    legs: [leg()],
    odds: 2,
    stake: 5,
    day: 1,
    status: "green",
    profitLoss: 5,
    placedAt: "2026-09-21T10:00:00.000Z",
    settledAt: "2026-09-21T20:00:00.000Z",
    ...overrides,
  };
}

const scores = (entries: [number, [number, number]][]) =>
  new Map(entries.map(([id, [h, a]]) => [id, { homeGoals: h, awayGoals: a }]));

describe("a player's standing", () => {
  it("builds the bankroll from the results, so it cannot drift", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", day: 1, profitLoss: 5 }),
      bet({
        id: "b2",
        day: 2,
        stake: 7.5,
        odds: 1.85,
        profitLoss: 6.38,
        placedAt: "2026-09-22T10:00:00.000Z",
        settledAt: "2026-09-22T20:00:00.000Z",
      }),
    ]);

    expect(standing.bankroll).toBe(21.38);
    expect(standing.greens).toBe(2);
    expect(standing.day).toBe(3);
  });

  it("só sobe de nível quando a banca chega ao que o nível seguinte pede", () => {
    // O caso que o David descreveu, na tabela do Plano Milhão: o nível 1
    // joga-se com 10 € e pede 5 €. Perdê-lo deixa 5 €.
    const perdeu = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", status: "red", profitLoss: -5 }),
    ]);
    expect(perdeu.bankroll).toBe(5);
    expect(perdeu.day).toBe(1);
    // Com 5 € não há 5 € para arriscar além dos que lá estão: é tudo.
    const escada = ladderFor(MILLION_PLAN_RULES, 10);
    expect(stakeForDay(escada, perdeu.day, perdeu.bankroll)).toBe(5);

    // Ganhar a seguir repõe os 10 € — e aqui é que o contador de passos
    // somava um e pedia o nível 2, que se joga com 15 € e manda apostar
    // 7,50 €: 75% de uma banca de 10 € num plano que nunca passa de 50%.
    const repos = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", status: "red", profitLoss: -5 }),
      bet({
        id: "b2",
        stake: 5,
        profitLoss: 5,
        placedAt: "2026-09-22T10:00:00.000Z",
      }),
    ]);
    expect(repos.bankroll).toBe(10);
    expect(repos.day).toBe(1);
    expect(stakeForDay(escada, repos.day, repos.bankroll)).toBe(5);

    // Só quando a banca chega mesmo aos 15 € da linha seguinte é que o
    // nível 2 se abre, e aí sim a aposta é a dele.
    const subiu = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", status: "red", profitLoss: -5 }),
      bet({ id: "b2", stake: 5, profitLoss: 5, placedAt: "2026-09-22T10:00:00.000Z" }),
      bet({ id: "b3", stake: 5, profitLoss: 5, placedAt: "2026-09-23T10:00:00.000Z" }),
    ]);
    expect(subiu.bankroll).toBe(15);
    expect(subiu.day).toBe(2);
    expect(stakeForDay(escada, subiu.day, subiu.bankroll)).toBe(7.5);
  });

  it("sobe um degrau de cada vez, por muito que se ganhe num dia", () => {
    // Ganhar a 5,00 onde a tabela pedia 2,00 põe o dinheiro três linhas à
    // frente, e o nível ia atrás dele. Mas os níveis do plano são
    // consecutivos: o nível 3 é o que se joga depois do 2, não uma linha
    // onde se aterra. O troco é almofada, não um degrau grátis.
    const grande = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", stake: 5, odds: 5, profitLoss: 20 }),
    ]);

    expect(grande.bankroll).toBe(30);
    // A banca chega ao nível 3 (21,38 €) e sobra. O nível é 2.
    expect(grande.day).toBe(2);
  });

  it("e o degrau que sobrou ganha-se no dia seguinte", () => {
    // O dinheiro já lá estava; o que faltava era o dia. Dois dias, dois
    // degraus, sem nunca saltar nenhum.
    const depois = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", day: 1, stake: 5, odds: 5, profitLoss: 20 }),
      bet({
        id: "b2",
        day: 2,
        stake: 7.5,
        profitLoss: 1,
        placedAt: "2026-09-22T10:00:00.000Z",
        settledAt: "2026-09-22T20:00:00.000Z",
      }),
    ]);

    expect(depois.bankroll).toBe(31);
    expect(depois.day).toBe(3);
  });

  it("desce para onde a banca chegar, que é outra coisa", () => {
    // Travar a descida escreveria no ecrã um nível que a banca não paga.
    // Perder metade da banca é quase sempre mais do que uma linha atrás, e
    // o nível tem de dizer com que dinheiro se joga a seguir.
    const dia = (n: number, profitLoss: number) =>
      bet({
        id: `b${n}`,
        profitLoss,
        placedAt: `2026-09-2${n}T10:00:00.000Z`,
        settledAt: `2026-09-2${n}T20:00:00.000Z`,
        status: profitLoss < 0 ? ("red" as const) : ("green" as const),
      });

    const caiu = buildStanding(member, MILLION_PLAN_RULES, [
      dia(1, 5), // 15 → nível 2
      dia(2, 6.38), // 21,38 → nível 3
      dia(3, 9.61), // 30,99 → nível 4
      dia(4, -20.3), // 10,69 → nível 1, e não 3
    ]);

    expect(caiu.bankroll).toBe(10.69);
    expect(caiu.day).toBe(1);
  });

  it("leaves a pending bet out of the bankroll but shows what is at risk", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({
        id: "b2",
        status: "pending",
        stake: 7.5,
        profitLoss: 0,
        settledAt: null,
        placedAt: "2026-09-22T10:00:00.000Z",
      }),
    ]);

    expect(standing.bankroll).toBe(15);
    expect(standing.openStake).toBe(7.5);
    expect(standing.settled).toBe(1);
  });

  it("counts losses since the last win, not losses in total", () => {
    const red = (id: string, placedAt: string) =>
      bet({ id, status: "red", profitLoss: -5, placedAt });

    const broken = buildStanding(member, MILLION_PLAN_RULES, [
      red("b1", "2026-09-21T10:00:00.000Z"),
      bet({ id: "b2", placedAt: "2026-09-22T10:00:00.000Z" }),
      red("b3", "2026-09-23T10:00:00.000Z"),
      red("b4", "2026-09-24T10:00:00.000Z"),
    ]);

    expect(broken.reds).toBe(3);
    expect(broken.lossStreak).toBe(2);
  });

  it("only counts the bets belonging to that player", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1" }),
      bet({ id: "b2", userId: "u2", profitLoss: 999 }),
    ]);

    expect(standing.bets).toHaveLength(1);
    expect(standing.bankroll).toBe(15);
  });

  it("counts the days left open and remembers the last one decided", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", profitLoss: 5 }),
      bet({
        id: "b2",
        status: "pending",
        profitLoss: 0,
        settledAt: null,
        placedAt: "2026-09-22T10:00:00.000Z",
      }),
    ]);

    expect(standing.openBets).toBe(1);
    expect(standing.lastSettled?.id).toBe("b1");
    // The open day has not moved the money, so it has not moved the day either.
    expect(standing.day).toBe(2);
  });

  it("starts a player who has not bet yet at the plan's opening stake", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, []);

    expect(standing.bankroll).toBe(10);
    expect(standing.day).toBe(1);
    expect(standing.lossStreak).toBe(0);
  });
});

describe("a day made of several games", () => {
  it("multiplies the prices, so short odds add up to the plan's line", () => {
    // Three games at 1.25 is the 1.95 the plan asks for, reached another way.
    expect(combineOdds([{ odds: 1.25 }, { odds: 1.25 }, { odds: 1.25 }])).toBe(1.95);
    expect(combineOdds([{ odds: 1.85 }])).toBe(1.85);
    expect(combineOdds([])).toBe(0);
  });

  it("multiplies the model's own chances the same way", () => {
    expect(combinedModelProb([{ modelProb: 50 }, { modelProb: 50 }])).toBe(25);
  });

  it("lists every fixture the open days are waiting on, once each", () => {
    const open = bet({
      id: "open",
      status: "pending",
      legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 2, league: "Liga Portugal" })],
    });
    const done = bet({ id: "done", legs: [leg({ fixtureId: 3 })] });

    expect(openFixtureRefs([open, done])).toEqual([
      { id: 1, league: "Liga Portugal" },
      { id: 2, league: "Liga Portugal" },
    ]);
  });
});

describe("settling a day", () => {
  it("pays out when every game lands", () => {
    const settled = settleFromScores(
      bet({
        status: "pending",
        profitLoss: 0,
        odds: 4,
        legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 2, market: "Fora" })],
      }),
      scores([
        [1, [2, 0]],
        [2, [0, 1]],
      ])
    );

    expect(settled?.status).toBe("green");
    expect(settled?.profitLoss).toBe(15);
    expect(settled?.legs.every((entry) => entry.status === "green")).toBe(true);
  });

  it("loses the day on one failed game", () => {
    const settled = settleFromScores(
      bet({
        status: "pending",
        profitLoss: 0,
        legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 2 })],
      }),
      scores([
        [1, [2, 0]],
        [2, [0, 1]],
      ])
    );

    expect(settled?.status).toBe("red");
    expect(settled?.profitLoss).toBe(-5);
    expect(settled?.legs.map((entry) => entry.status)).toEqual(["green", "red"]);
  });

  it("waits for a game that has not been played", () => {
    const settled = settleFromScores(
      bet({ status: "pending", legs: [leg({ fixtureId: 1 }), leg({ fixtureId: 9 })] }),
      scores([[1, [2, 0]]])
    );

    expect(settled).toBeNull();
  });

  it("leaves a market a score cannot decide alone", () => {
    const settled = settleFromScores(
      bet({ status: "pending", legs: [leg({ market: "Handicap Asiático +1.5" })] }),
      scores([[1, [2, 0]]])
    );

    expect(settled).toBeNull();
  });
});

describe("a game the site never heard of", () => {
  const manual = () =>
    bet({
      status: "pending",
      profitLoss: 0,
      stake: 10,
      odds: 1.9,
      settledAt: null,
      legs: [leg({ fixtureId: null, status: "pending", market: "Casa" })],
    });

  it("is recognised by having no fixture behind it", () => {
    expect(isManualLeg(leg({ fixtureId: null }))).toBe(true);
    expect(isManualLeg(leg({ fixtureId: 1 }))).toBe(false);
  });

  it("is never asked for from the results feed", () => {
    expect(
      openFixtureRefs([
        bet({
          status: "pending",
          legs: [leg({ fixtureId: null, status: "pending" }), leg({ fixtureId: 7, status: "pending" })],
        }),
      ])
    ).toEqual([{ id: 7, league: "Liga Portugal" }]);
  });

  it("keeps the day open, because no score can decide it", () => {
    expect(settleFromScores(manual(), scores([[1, [2, 0]]]))).toBeNull();
  });

  it("pays out when its owner says it landed", () => {
    const settled = settleManually(manual(), true);

    expect(settled.status).toBe("green");
    expect(settled.profitLoss).toBe(9);
    expect(settled.legs[0].status).toBe("green");
    expect(settled.settledAt).not.toBeNull();
  });

  it("takes the stake when its owner says it did not", () => {
    const settled = settleManually(manual(), false);

    expect(settled.status).toBe("red");
    expect(settled.profitLoss).toBe(-10);
  });

  it("does not blame a particular game for a lost day of several", () => {
    // Nobody said which one failed, and guessing would put a false result in
    // the history the model is judged against.
    const settled = settleManually(
      bet({
        status: "pending",
        stake: 10,
        odds: 3,
        legs: [leg({ fixtureId: null, status: "pending" }), leg({ fixtureId: 2, status: "pending" })],
      }),
      false
    );

    expect(settled.status).toBe("red");
    expect(settled.legs.map((entry) => entry.status)).toEqual(["pending", "pending"]);
  });
});

describe("a day that is already lost", () => {
  it("closes as soon as one game fails, without waiting for the rest", () => {
    // A multiple is dead the moment a leg goes down, and calling it "open"
    // would keep money on the books that cannot come back.
    const settled = settleFromScores(
      bet({
        status: "pending",
        profitLoss: 0,
        stake: 10,
        odds: 4,
        settledAt: null,
        legs: [
          leg({ fixtureId: 1, status: "pending", market: "Fora" }),
          leg({ fixtureId: 9, status: "pending" }),
        ],
      }),
      scores([[1, [2, 0]]])
    );

    expect(settled?.status).toBe("red");
    expect(settled?.profitLoss).toBe(-10);
    expect(settled?.legs.map((entry) => entry.status)).toEqual(["red", "pending"]);
  });
});

describe("saying how one game inside a bet went", () => {
  const open = () =>
    bet({
      status: "pending",
      profitLoss: 0,
      settledAt: null,
      stake: 10,
      odds: 2.5,
      legs: [
        leg({ fixtureId: null, status: "pending", market: "-4,5 Golos" }),
        leg({ fixtureId: null, status: "pending", market: "-3,5 Golos" }),
      ],
    });

  it("records the game without touching the rest", () => {
    const marked = setLegStatus(open(), 0, "green");

    expect(marked.legs.map((entry) => entry.status)).toEqual(["green", "pending"]);
    expect(marked.status).toBe("pending");
  });

  it("closes an open day as soon as one game is marked down", () => {
    const marked = setLegStatus(open(), 1, "red");

    expect(marked.status).toBe("red");
    expect(marked.profitLoss).toBe(-10);
    expect(marked.settledAt).not.toBeNull();
  });

  it("pays an open day out once every game is in", () => {
    const first = setLegStatus(open(), 0, "green");
    const marked = setLegStatus({ ...first, id: "b1", userId: "u1" }, 1, "green");

    expect(marked.status).toBe("green");
    expect(marked.profitLoss).toBe(15);
  });

  it("leaves the money alone on a day its owner already settled", () => {
    // Filling in which game failed afterwards must not re-pay a closed day.
    const settled = bet({
      status: "red",
      profitLoss: -10,
      stake: 10,
      odds: 2.5,
      legs: [
        leg({ fixtureId: null, status: "pending" }),
        leg({ fixtureId: null, status: "pending" }),
      ],
    });

    const marked = setLegStatus(settled, 0, "red");

    expect(marked.status).toBe("red");
    expect(marked.profitLoss).toBe(-10);
    expect(marked.legs[0].status).toBe("red");
  });
});

describe("settling every game left in one go", () => {
  it("marks the games still open and leaves the decided ones alone", () => {
    const settled = setRemainingLegs(
      bet({
        status: "red",
        profitLoss: -5,
        legs: [
          leg({ fixtureId: null, status: "green" }),
          leg({ fixtureId: null, status: "pending" }),
          leg({ fixtureId: null, status: "pending" }),
        ],
      }),
      "red"
    );

    expect(settled.legs.map((entry) => entry.status)).toEqual([
      "green",
      "red",
      "red",
    ]);
    // The day was already closed by its owner; the money does not move again.
    expect(settled.profitLoss).toBe(-5);
  });

  it("closes an open day when every game is settled at once", () => {
    const settled = setRemainingLegs(
      bet({
        status: "pending",
        profitLoss: 0,
        settledAt: null,
        stake: 10,
        odds: 2,
        legs: [
          leg({ fixtureId: null, status: "pending" }),
          leg({ fixtureId: null, status: "pending" }),
        ],
      }),
      "green"
    );

    expect(settled.status).toBe("green");
    expect(settled.profitLoss).toBe(10);
  });
});

describe("closing a lost day by naming the games that fell", () => {
  const day = () =>
    bet({
      status: "pending",
      profitLoss: 0,
      settledAt: null,
      stake: 7.5,
      odds: 2.4,
      legs: [
        leg({ fixtureId: null, status: "pending", market: "-4,5 Golos" }),
        leg({ fixtureId: null, status: "pending", market: "-3,5 Golos" }),
        leg({ fixtureId: null, status: "pending", market: "Casa" }),
      ],
    });

  it("settles the named games as lost and the rest as landed", () => {
    // A multiple goes down because one game fell; the others came in. Saying
    // which failed says everything about the day.
    const settled = settleLostWith(day(), [1]);

    expect(settled.legs.map((entry) => entry.status)).toEqual([
      "green",
      "red",
      "green",
    ]);
    expect(settled.status).toBe("red");
    expect(settled.profitLoss).toBe(-7.5);
  });

  it("takes more than one when more than one fell", () => {
    const settled = settleLostWith(day(), [0, 2]);

    expect(settled.legs.map((entry) => entry.status)).toEqual([
      "red",
      "green",
      "red",
    ]);
  });

  it("keeps the moment a day was already closed at", () => {
    const already = bet({
      status: "red",
      profitLoss: -7.5,
      stake: 7.5,
      settledAt: "2026-09-25T22:00:00.000Z",
      legs: [leg({ fixtureId: null, status: "pending" })],
    });

    expect(settleLostWith(already, [0]).settledAt).toBe(
      "2026-09-25T22:00:00.000Z"
    );
  });
});

describe("correcting a bet that was typed wrong", () => {
  it("prices the day again from the odds that were fixed", () => {
    const original = bet({
      legs: [leg({ odds: 2 }), leg({ odds: 1.5 })],
      odds: 3,
      stake: 10,
      status: "pending",
      profitLoss: 0,
    });

    const fixed = editBet(
      original,
      original.legs.map((entry, index) =>
        index === 0 ? { ...entry, odds: 1.8 } : entry,
      ),
      10,
    );

    expect(fixed.odds).toBe(2.7);
  });

  it("recomputes what a won day paid, not just the odd on screen", () => {
    const won = bet({ legs: [leg({ odds: 2 })], odds: 2, stake: 10, status: "green", profitLoss: 10 });

    const fixed = editBet(won, [leg({ odds: 1.5 })], 10);

    expect(fixed.odds).toBe(1.5);
    expect(fixed.profitLoss).toBe(5);
  });

  it("follows the stake on a lost day down to what it really cost", () => {
    const lost = bet({ status: "red", stake: 10, profitLoss: -10 });

    expect(editBet(lost, lost.legs, 4).profitLoss).toBe(-4);
  });

  it("leaves an open day owing nothing either way", () => {
    const open = bet({ status: "pending", profitLoss: 0 });

    expect(editBet(open, open.legs, 25).profitLoss).toBe(0);
  });

  it("prices a game taken out of the slip", () => {
    const double = bet({
      legs: [leg({ odds: 2 }), leg({ odds: 1.5 })],
      odds: 3,
      stake: 10,
      status: "pending",
    });

    expect(editBet(double, [double.legs[0]], 10).odds).toBe(2);
  });
});

describe("a day closed the wrong way round", () => {
  it("turns a lost day into a won one, with every game in", () => {
    const lost = bet({
      legs: [leg({ status: "red" }), leg({ status: "green" })],
      odds: 4,
      stake: 10,
      status: "red",
      profitLoss: -10,
    });

    const fixed = resettleBet(lost, true);

    expect(fixed.status).toBe("green");
    expect(fixed.profitLoss).toBe(30);
    expect(fixed.legs.every((entry) => entry.status === "green")).toBe(true);
  });

  it("does not let a day flipped to lost keep the greens it was given", () => {
    const won = bet({
      legs: [leg({ status: "green" }), leg({ status: "green" })],
      odds: 4,
      stake: 10,
      status: "green",
      profitLoss: 30,
    });

    const fixed = resettleBet(won, false);

    expect(fixed.status).toBe("red");
    expect(fixed.profitLoss).toBe(-10);
    // The person names which games fell, exactly as on any other lost day.
    expect(fixed.legs.every((entry) => entry.status === "pending")).toBe(true);
  });

  it("marks the single game of a one-game day, since there is nothing to name", () => {
    const won = bet({ status: "green", stake: 10, odds: 2, profitLoss: 10 });

    expect(resettleBet(won, false).legs[0].status).toBe("red");
  });

  it("puts a day back to undecided, owing nothing", () => {
    const won = bet({
      legs: [leg({ status: "green" })],
      status: "green",
      profitLoss: 10,
      settledAt: "2026-09-20T10:00:00.000Z",
    });

    const open = reopenBet(won);

    expect(open.status).toBe("pending");
    expect(open.profitLoss).toBe(0);
    expect(open.settledAt).toBeNull();
    expect(open.legs[0].status).toBe("pending");
  });

  it("takes a reopened day back off the ladder", () => {
    const won = bet({ day: 1, status: "green" });
    const before = buildStanding(member, MILLION_PLAN_RULES, [won]);
    const after = buildStanding(member, MILLION_PLAN_RULES, [
      { ...reopenBet(won), id: won.id, userId: won.userId },
    ]);

    expect(before.day).toBe(2);
    expect(after.day).toBe(1);
  });
});

/**
 * A escada, agora lida pelo dinheiro.
 *
 * Estes testes passavam com apostas impossíveis — uma perdida que pagava
 * +5 € — porque o nível vinha de contar ganhos e derrotas e nunca olhava
 * para o dinheiro. Passam a usar as quantias da tabela do Plano Milhão,
 * que é o que torna a pergunta "em que nível estou?" respondível.
 */
describe("walking the ladder", () => {
  /**
   * Um dia jogado, com a quantia verdadeira do que aconteceu.
   *
   * `nivel` é o degrau em que o boletim foi registado, e por omissão é o
   * próprio índice — um jogador que vai ganhando regista o dia 1, depois o
   * 2, depois o 3. Quem perde volta a registar o mesmo, e aí diz-se.
   */
  const day = (
    profitLoss: number,
    index: number,
    status: PlanBet["status"] = "green",
    nivel = index,
  ) =>
    bet({
      id: `l${index}`,
      status,
      day: nivel,
      profitLoss,
      placedAt: `2026-09-${String(20 + index).padStart(2, "0")}T10:00:00.000Z`,
      settledAt: `2026-09-${String(20 + index).padStart(2, "0")}T20:00:00.000Z`,
    });

  // Tabela do Plano Milhão: 10 → 15 → 21,38 → 30,99.
  const GANHA_1 = 5;
  const GANHA_2 = 6.38;

  it("sobe um degrau quando a banca chega ao que esse degrau pede", () => {
    expect(
      buildStanding(member, MILLION_PLAN_RULES, [day(GANHA_1, 1)]).day,
    ).toBe(2);
    expect(
      buildStanding(member, MILLION_PLAN_RULES, [
        day(GANHA_1, 1),
        day(GANHA_2, 2),
      ]).day,
    ).toBe(3);
  });

  it("desce na escada quando a banca cai, e não um passo no tempo", () => {
    // Dois ganhos põem a banca em 21,38 € — o nível 3. Perder a aposta
    // desse nível (10,69 €) deixa 10,69 €, que é menos do que os 15 € que
    // o nível 2 pede: por isso o degrau é o 1, não o 2. Um passo atrás no
    // contador diria 2 e mandaria apostar 7,50 € de uma banca de 10,69 €.
    const caiu = buildStanding(member, MILLION_PLAN_RULES, [
      day(GANHA_1, 1),
      day(GANHA_2, 2),
      day(-10.69, 3, "red"),
    ]);

    expect(caiu.bankroll).toBe(10.69);
    expect(caiu.day).toBe(1);
  });

  it("não cai abaixo do primeiro degrau", () => {
    expect(
      buildStanding(member, MILLION_PLAN_RULES, [day(-5, 1, "red")]).day,
    ).toBe(1);
  });

  it("repor o que se perdeu não é subir: fica-se no mesmo nível", () => {
    // Perder o nível 1 deixa 5 €; ganhar a seguir repõe os 10 €. Isso é
    // estar outra vez no princípio do nível 1, não ter chegado ao 2 — que
    // se joga com 15 €.
    const repos = buildStanding(member, MILLION_PLAN_RULES, [
      day(-5, 1, "red"),
      // Jogado outra vez o nível 1, que é o que o ecrã passou a pedir.
      day(5, 2, "green", 1),
    ]);

    expect(repos.bankroll).toBe(10);
    expect(repos.day).toBe(1);
  });

  it("não passa do fim da tabela", () => {
    const rules = { ...MILLION_PLAN_RULES, days: 3 };
    const bets = [day(GANHA_1, 1), day(GANHA_2, 2), day(9.61, 3)];

    // A banca chegaria ao degrau 4, mas o desafio acaba no 3.
    expect(buildStanding(member, rules, bets).bankroll).toBe(30.99);
    expect(buildStanding(member, rules, bets).day).toBe(3);
  });

  it("o nível é o dia a seguir ao que se jogou, e não onde o dinheiro aterra", () => {
    // O caso do Vilagreen, com os números dele. Jogou sete dias ao nível 1
    // (5 € cada) e ganhou quatro, depois jogou o nível 2 (7,50 €) e ganhou
    // — logo está no 3. O ecrã dizia 4, porque a banca de 33,17 € passa os
    // 30,99 € do degrau 4; só que desse dinheiro 10 € são um depósito e o
    // resto é troco de ter ganho acima do preço da tabela.
    const cinco = (index: number, profitLoss: number) =>
      bet({
        id: `v${index}`,
        day: 1,
        stake: 5,
        status: profitLoss < 0 ? ("red" as const) : ("green" as const),
        profitLoss,
        placedAt: `2026-09-${String(10 + index).padStart(2, "0")}T10:00:00.000Z`,
        settledAt: `2026-09-${String(10 + index).padStart(2, "0")}T20:00:00.000Z`,
      });

    const vilagreen = buildStanding(
      member,
      MILLION_PLAN_RULES,
      [
        cinco(1, -5),
        cinco(2, -5),
        cinco(3, 5.75),
        cinco(4, -5),
        cinco(5, 5.7),
        cinco(6, 5.05),
        cinco(7, 5),
        bet({
          id: "v8",
          day: 2,
          stake: 7.5,
          profitLoss: 6.67,
          placedAt: "2026-09-18T10:00:00.000Z",
          settledAt: "2026-09-18T20:00:00.000Z",
        }),
      ],
      [
        {
          id: "f10",
          userId: "u1",
          amount: 10,
          note: null,
          at: "2026-09-11T16:17:25.000Z",
        },
      ],
    );

    expect(vilagreen.bankroll).toBe(33.17);
    expect(vilagreen.day).toBe(3);
  });

  it("uma aposta em aberto não mexe no nível", () => {
    const bets = [
      day(GANHA_1, 1),
      bet({
        id: "l2",
        status: "pending",
        profitLoss: 0,
        settledAt: null,
        placedAt: "2026-09-22T10:00:00.000Z",
      }),
    ];

    expect(buildStanding(member, MILLION_PLAN_RULES, bets).day).toBe(2);
  });
});

describe("money put into the bankroll, apart from betting", () => {
  const funds = (amount: number, userId = "u1"): PlanFunds => ({
    id: `f${amount}`,
    userId,
    amount,
    note: null,
    at: "2026-09-26T10:00:00.000Z",
  });

  it("counts a deposit in the bankroll", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [], [funds(50)]);

    expect(standing.bankroll).toBe(60);
    expect(standing.added).toBe(50);
  });

  it("keeps a deposit out of the profit, which is the whole point", () => {
    // €50 added moves the bankroll exactly as far as €50 won. Without this
    // separation, putting money in reads on screen as winning it.
    const standing = buildStanding(member, MILLION_PLAN_RULES, [], [funds(50)]);

    expect(standing.profit).toBe(0);
  });

  it("adds the betting to the money put in", () => {
    const won = bet({ status: "green", profitLoss: 5 });
    const standing = buildStanding(member, MILLION_PLAN_RULES, [won], [funds(50)]);

    expect(standing.bankroll).toBe(65);
    expect(standing.profit).toBe(5);
    expect(standing.added).toBe(50);
  });

  it("takes money out when the amount is negative", () => {
    const standing = buildStanding(member, MILLION_PLAN_RULES, [], [funds(-4)]);

    expect(standing.bankroll).toBe(6);
    expect(standing.added).toBe(-4);
  });

  it("leaves the other player's money alone", () => {
    const standing = buildStanding(
      member,
      MILLION_PLAN_RULES,
      [],
      [funds(50, "outro")]
    );

    expect(standing.bankroll).toBe(10);
    expect(standing.added).toBe(0);
  });

  it("conta para o nível, porque o nível é onde a banca está", () => {
    // Isto esteve do avesso, e o caso real foi este: 10 € de início, 10 €
    // metidos e 4,45 € perdidos a apostar. Banca de 15,55 € no ecrã e
    // nível 1 — que manda apostar 5 € de uma banca que já passou os 15 €
    // da linha seguinte.
    const standing = buildStanding(
      member,
      MILLION_PLAN_RULES,
      [bet({ id: "b1", status: "red", profitLoss: -4.45 })],
      [funds(10)]
    );

    expect(standing.bankroll).toBe(15.55);
    expect(standing.day).toBe(2);
  });

  it("continua a não contar como lucro, que é outra pergunta", () => {
    // Subir de nível e estar a ganhar não são a mesma coisa, e o ecrã tem
    // de poder dizer as duas: a banca chegou aos 15 €, e mesmo assim as
    // apostas estão a perder.
    const standing = buildStanding(
      member,
      MILLION_PLAN_RULES,
      [bet({ id: "b1", status: "red", profitLoss: -4.45 })],
      [funds(10)]
    );

    expect(standing.profit).toBe(-4.45);
    expect(standing.added).toBe(10);
  });

  it("entra na ordem certa mesmo escrito noutro formato", () => {
    // As apostas trazem a hora como o navegador a escreve e os movimentos
    // da banca como a base de dados a devolve. Comparadas letra a letra, um
    // depósito das 19:58:52 vinha antes de uma aposta fechada às 19:58:27 —
    // e no registo real estão a vinte e cinco segundos uma da outra.
    const standing = buildStanding(
      member,
      MILLION_PLAN_RULES,
      [
        bet({
          id: "b1",
          status: "red",
          profitLoss: -5,
          settledAt: "2026-09-26T19:58:27.470Z",
        }),
      ],
      [{ ...funds(10), at: "2026-09-26 19:58:52.209893+00" }],
    );

    // Perdeu com 10 €, ficou com 5, meteu 10: quinze. O nível 2 pede 15 €,
    // e é um degrau acima do 1 — sobe. Pela ordem contrária teria passado
    // por 20 € e descido depois para 15, e o degrau dava no mesmo; o que
    // não dava no mesmo era a ordem estar errada à espera de um caso onde
    // desse.
    expect(standing.bankroll).toBe(15);
    expect(standing.day).toBe(2);
  });

  it("não começa o plano a meio por se ter metido dinheiro", () => {
    // 510 € alcançam o décimo degrau da tabela, e quem nunca jogou um dia
    // está no primeiro. O plano é uma escada que se sobe; dinheiro na
    // conta à partida é almofada, não degraus já subidos.
    const standing = buildStanding(member, MILLION_PLAN_RULES, [], [funds(500)]);

    expect(standing.bankroll).toBe(510);
    expect(standing.day).toBe(1);
  });

  it("mas abre o portão de quem já ganhou um dia — e só um", () => {
    // Ganhar o dia 1 e ficar com 10 € não chega ao nível 2, que pede 15 €:
    // o portão fica fechado e repete-se o nível 1. Meter dinheiro abre-o.
    // Não abre dez: o dia seguinte é um só, por muito que lá esteja.
    const semDinheiro = buildStanding(member, MILLION_PLAN_RULES, [
      bet({ id: "b1", day: 1, status: "red", profitLoss: -5 }),
      bet({
        id: "b2",
        day: 1,
        profitLoss: 5,
        placedAt: "2026-09-22T10:00:00.000Z",
        settledAt: "2026-09-22T20:00:00.000Z",
      }),
    ]);
    expect(semDinheiro.bankroll).toBe(10);
    expect(semDinheiro.day).toBe(1);

    const comDinheiro = buildStanding(
      member,
      MILLION_PLAN_RULES,
      [
        bet({ id: "b1", day: 1, status: "red", profitLoss: -5 }),
        bet({
          id: "b2",
          day: 1,
          profitLoss: 5,
          placedAt: "2026-09-22T10:00:00.000Z",
          settledAt: "2026-09-22T20:00:00.000Z",
        }),
      ],
      [{ ...funds(500), at: "2026-09-23T10:00:00.000Z" }],
    );
    expect(comDinheiro.bankroll).toBe(510);
    expect(comDinheiro.day).toBe(2);
  });

  it("tirar dinheiro também desce o nível", () => {
    // O corolário, e tem de valer nos dois sentidos: com 5 € na mão não se
    // joga o nível 2, haja o que houver escrito na história.
    const standing = buildStanding(
      member,
      MILLION_PLAN_RULES,
      [bet({ id: "b1", status: "green", profitLoss: 5 })],
      [funds(-10)]
    );

    expect(standing.bankroll).toBe(5);
    expect(standing.day).toBe(1);
  });
});
