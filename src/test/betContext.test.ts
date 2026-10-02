import { describe, expect, it } from "vitest";
import {
  clearsThePrice,
  leagueRate,
  legContext,
  ownRate,
  requiredPct,
} from "@/lib/betContext";
import { buildPlayerStyle } from "@/lib/bettingStyle";
import type { LeagueReport } from "@/lib/leagueReport";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

const report = (overrides: Partial<LeagueReport> = {}): LeagueReport => ({
  league: "Liga Portugal",
  played: 94,
  markets: [
    { mercado: "Casa", grupo: "Resultado", jogos: 42, pct: 44.7 },
    { mercado: "1X", grupo: "Resultado", jogos: 66, pct: 70.2 },
    { mercado: "Mais de 2.5 Golos", grupo: "Golos", jogos: 48, pct: 51.1 },
    { mercado: "Ambas Marcam", grupo: "Ambas Marcam", jogos: 46, pct: 48.9 },
  ],
  goals: { home_avg: 1.54, away_avg: 1.19, total_avg: 2.73 },
  form: [],
  form_window: 5,
  ...overrides,
});

const leg = (market: string, status: PlanLeg["status"]): PlanLeg => ({
  match: "Casa vs Fora",
  homeTeam: "Casa",
  awayTeam: "Fora",
  league: "Liga Portugal",
  market,
  odds: 1.5,
  modelProb: 0,
  fixtureId: null,
  kickoff: null,
  status,
});

const bet = (legs: PlanLeg[], status: PlanBet["status"] = "green"): PlanBet => ({
  id: `b${Math.random()}`,
  userId: "david",
  legs,
  odds: 1.5,
  stake: 5,
  day: 1,
  status,
  profitLoss: status === "green" ? 2.5 : -5,
  placedAt: "2026-09-20T10:00:00.000Z",
  settledAt: "2026-09-20T20:00:00.000Z",
});

/** Each leg its own bet, won or lost, which is how these two actually bet. */
const singles = (market: string, greens: number, reds: number): PlanBet[] => [
  ...Array.from({ length: greens }, () => bet([leg(market, "green")])),
  ...Array.from({ length: reds }, () => bet([leg(market, "red")], "red")),
];

describe("what a price is asking for", () => {
  it("turns an odd into the hit rate it needs to pay for itself", () => {
    // A 1.25 has to come in four times in five just to stand still.
    expect(requiredPct(1.25)).toBe(80);
    expect(requiredPct(2)).toBe(50);
    expect(requiredPct(1.47)).toBe(68);
  });

  it("says nothing about a price that is not one", () => {
    expect(requiredPct(1)).toBeNull();
    expect(requiredPct(0)).toBeNull();
    expect(requiredPct(Number.NaN)).toBeNull();
  });
});

describe("what the competition gives", () => {
  it("finds the market however it was written on the slip", () => {
    // "X1" and "+2,5 golos" are the same bets the report counts as "1X" and
    // "Mais de 2.5 Golos".
    expect(leagueRate(report(), "X1")).toMatchObject({ pct: 70, hits: 66, of: 94 });
    expect(leagueRate(report(), "+2,5 golos")).toMatchObject({ pct: 51 });
    expect(leagueRate(report(), "AM")).toMatchObject({ pct: 49 });
  });

  it("names the competition it is talking about", () => {
    expect(leagueRate(report(), "Casa")?.league).toBe("Liga Portugal");
  });

  it("has nothing to say about a market the report does not count", () => {
    // A handicap, an escanteio, a goalscorer: not in the report, not invented.
    expect(leagueRate(report(), "Suíça +0.5")).toBeNull();
  });

  it("has nothing to say before a ball is kicked", () => {
    expect(leagueRate(report({ played: 0, markets: [] }), "Casa")).toBeNull();
    expect(leagueRate(null, "Casa")).toBeNull();
  });
});

describe("what this person's own bets did", () => {
  const style = (greens: number, reds: number) =>
    buildPlayerStyle("david", "David", [
      ...singles("Ambas Marcam", greens, 0),
      ...singles("AM", 0, reds),
    ]);

  it("counts the market however it was spelt, bet to bet", () => {
    // "Ambas Marcam" nine times and "AM" five: one market, fourteen legs.
    expect(ownRate(style(9, 5), "ambas marcam")).toMatchObject({
      pct: 64,
      hits: 9,
      of: 14,
    });
  });

  it("stays quiet about a market backed a handful of times", () => {
    // Two of two is 100% and is not evidence of anything.
    expect(ownRate(style(2, 0), "Ambas Marcam")).toBeNull();
  });

  it("stays quiet when there is no record at all", () => {
    expect(ownRate(null, "Casa")).toBeNull();
    expect(ownRate(style(9, 5), "Casa")).toBeNull();
  });
});

describe("putting the three side by side", () => {
  it("says the odd is asking for more than the competition gives", () => {
    // Mais de 2.5 na Liga Portugal: 51 em cada 100 jogos. A 1.47 o preço pede
    // 68. É a mesma aposta que já foi feita e perdida.
    const context = legContext({
      market: "Mais de 2,5 Golos",
      odds: 1.47,
      report: report(),
    });

    expect(context.required).toBe(68);
    expect(context.league?.pct).toBe(51);
    expect(clearsThePrice(context)).toBe("abaixo");
  });

  it("says when the price is covered by what usually happens", () => {
    // 1X dá 70% e a 1.30 o preço pede 77 — ainda não chega; a 1.55 pede 65.
    expect(
      clearsThePrice(legContext({ market: "1X", odds: 1.3, report: report() })),
    ).toBe("abaixo");
    expect(
      clearsThePrice(legContext({ market: "1X", odds: 1.55, report: report() })),
    ).toBe("acima");
  });

  it("believes the competition over the record, when it has both", () => {
    // Hundreds of games against a dozen bets: the bigger count is the one that
    // decides, and the record is still shown beside it.
    const style = buildPlayerStyle(
      "david",
      "David",
      singles("Mais de 2.5 Golos", 8, 0),
    );
    const context = legContext({
      market: "Mais de 2.5 Golos",
      odds: 1.47,
      report: report(),
      style,
    });

    expect(context.own?.pct).toBe(100);
    expect(clearsThePrice(context)).toBe("abaixo");
  });

  it("falls back to the record for a game the provider does not cover", () => {
    // Every bet these two have ever placed was on a competition like this.
    const style = buildPlayerStyle(
      "david",
      "David",
      singles("Ambas Marcam", 6, 1),
    );
    const context = legContext({
      market: "Ambas Marcam",
      odds: 1.5,
      report: null,
      style,
    });

    expect(context.league).toBeNull();
    expect(context.own).toMatchObject({ pct: 86, of: 7 });
    expect(clearsThePrice(context)).toBe("acima");
  });

  it("refuses a verdict with nothing to go on", () => {
    const context = legContext({ market: "Casa", odds: 1.5 });

    expect(context.required).toBe(67);
    expect(clearsThePrice(context)).toBeNull();
  });
});
