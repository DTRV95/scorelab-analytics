import { describe, expect, it } from "vitest";
import { betTips } from "@/lib/betTips";
import { buildPlayerStyle } from "@/lib/bettingStyle";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

function leg(overrides: Partial<PlanLeg> = {}): PlanLeg {
  return {
    match: "A vs B",
    homeTeam: "A",
    awayTeam: "B",
    league: "Adicionado à mão",
    market: "Ambas Marcam",
    odds: 1.5,
    modelProb: 0,
    fixtureId: null,
    kickoff: null,
    status: "green",
    ...overrides,
  };
}

function bet(legs: PlanLeg[], status: PlanBet["status"] = "green"): PlanBet {
  return {
    id: Math.random().toString(36),
    userId: "u1",
    legs,
    odds: 1.9,
    stake: 5,
    day: 1,
    status,
    profitLoss: status === "green" ? 4.5 : -5,
    placedAt: "2026-09-20T10:00:00.000Z",
    settledAt: "2026-09-20T20:00:00.000Z",
  };
}

const style = (bets: PlanBet[]) => buildPlayerStyle("u1", "David", bets);

describe("tips from the person's own record", () => {
  it("says nothing at all until there is a record to speak from", () => {
    const thin = style([bet([leg()])]);

    expect(betTips(thin, [{ market: "Ambas Marcam" }])).toEqual([]);
  });

  it("gives the record of a market being backed again", () => {
    const history = style([
      bet([leg(), leg(), leg()]),
      bet([leg({ status: "red" })], "red"),
    ]);

    const [tip] = betTips(history, [{ market: "Ambas Marcam" }]);

    expect(tip.text).toBe("Ambas Marcam: entraram 3 de 4 que fizeste.");
    expect(tip.tone).toBe("good");
  });

  it("calls a market the person keeps missing what it is", () => {
    const history = style([
      bet([
        leg({ status: "red" }),
        leg({ status: "red" }),
        leg({ status: "red" }),
      ], "red"),
    ]);

    const [tip] = betTips(history, [{ market: "Ambas Marcam" }]);

    expect(tip.tone).toBe("bad");
    expect(tip.text).toContain("entraram 0 de 3");
  });

  it("reads the five spellings of one market as one market", () => {
    // Everything is typed by hand, so the same bet arrives written five ways.
    const history = style([
      bet([
        leg({ market: "-3.5" }),
        leg({ market: "-3,5 Golos" }),
        leg({ market: "Menos de 3.5" }),
      ]),
    ]);

    const [tip] = betTips(history, [{ market: "Menos de 3.5 Golos" }]);

    expect(tip.text).toContain("entraram 3 de 3");
  });

  it("says when a market is new, once there is a record to compare it to", () => {
    const history = style([bet([leg(), leg(), leg()])]);

    const [tip] = betTips(history, [{ market: "Escanteios" }]);

    expect(tip.text).toContain("primeira vez");
    expect(tip.tone).toBe("neutral");
  });

  it("says how this many games at once has gone", () => {
    const history = style([
      bet([leg(), leg()]),
      bet([leg(), leg()]),
      bet([leg({ status: "red" }), leg()], "red"),
    ]);

    const tips = betTips(history, [
      { market: "Ambas Marcam" },
      { market: "Ambas Marcam" },
    ]);

    expect(tips.some((tip) => tip.text === "Boletins de 2 jogos: ganhaste 2 de 3.")).toBe(
      true
    );
  });

  it("puts the bad news first, where it can still change something", () => {
    const history = style([
      bet([leg({ market: "Ambas Marcam" }), leg({ market: "Mais de 2.5 Golos" })]),
      bet([leg({ market: "Ambas Marcam" }), leg({ market: "Mais de 2.5 Golos" })]),
      bet(
        [
          leg({ market: "Ambas Marcam" }),
          leg({ market: "Mais de 2.5 Golos", status: "red" }),
        ],
        "red"
      ),
      bet([leg({ market: "Mais de 2.5 Golos", status: "red" })], "red"),
      bet([leg({ market: "Mais de 2.5 Golos", status: "red" })], "red"),
    ]);

    const tips = betTips(history, [
      { market: "Ambas Marcam" },
      { market: "Mais de 2.5 Golos" },
    ]);

    expect(tips[0].tone).toBe("bad");
    expect(tips[0].text).toContain("Mais de 2.5 Golos");
  });

  it("says nothing with an empty slip", () => {
    const history = style([bet([leg(), leg(), leg()])]);

    expect(betTips(history, [])).toEqual([]);
  });

  it("never gives more than three", () => {
    const history = style([
      bet([leg(), leg(), leg()]),
      bet([leg(), leg(), leg()]),
    ]);

    const tips = betTips(
      history,
      ["a", "b", "c", "d", "e"].map((market) => ({ market }))
    );

    expect(tips.length).toBeLessThanOrEqual(3);
  });
});
