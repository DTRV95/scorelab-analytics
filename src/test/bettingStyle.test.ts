import { describe, expect, it } from "vitest";
import {
  buildCombinedStyle,
  buildPlayerStyle,
  legOutcome,
  type PlayerStyle,
} from "@/lib/bettingStyle";
import type { PlanBet, PlanLeg } from "@/lib/planStore";

function leg(overrides: Partial<PlanLeg> = {}): PlanLeg {
  return {
    match: "FC Porto vs Casa Pia",
    homeTeam: "FC Porto",
    awayTeam: "Casa Pia",
    league: "Liga Portugal",
    market: "Mais de 1.5 Golos",
    odds: 1.4,
    modelProb: 78,
    fixtureId: 1,
    kickoff: null,
    status: "pending",
    ...overrides,
  };
}

function bet(overrides: Partial<PlanBet> = {}): PlanBet {
  return {
    id: "b1",
    userId: "david",
    legs: [leg()],
    odds: 1.4,
    stake: 5,
    day: 1,
    status: "green",
    profitLoss: 2,
    placedAt: "2026-09-21T10:00:00.000Z",
    settledAt: "2026-09-21T20:00:00.000Z",
    ...overrides,
  };
}

const marketOf = (style: PlayerStyle, name: string) =>
  style.markets.find((row) => row.market === name);

describe("reading a leg's result", () => {
  it("takes every leg of a won bet as landed", () => {
    // A multiple pays only when all of them land, so a win says so about each
    // one even when nothing wrote it down leg by leg.
    const won = bet({ legs: [leg(), leg({ market: "Casa" })] });

    expect(legOutcome(won, won.legs[0])).toBe("landed");
    expect(legOutcome(won, won.legs[1])).toBe("landed");
  });

  it("leaves the legs of a hand-marked losing multiple unknown", () => {
    // "Perdi o dia" says the day went down, not which game took it.
    const lost = bet({
      status: "red",
      profitLoss: -5,
      legs: [leg(), leg({ market: "Casa" })],
    });

    expect(legOutcome(lost, lost.legs[0])).toBe("unknown");
  });

  it("uses what the score already decided, inside a lost bet", () => {
    const lost = bet({
      status: "red",
      profitLoss: -5,
      legs: [leg({ status: "green" }), leg({ market: "Casa", status: "red" })],
    });

    expect(legOutcome(lost, lost.legs[0])).toBe("landed");
    expect(legOutcome(lost, lost.legs[1])).toBe("failed");
  });
});

describe("how a player bets", () => {
  const bets: PlanBet[] = [
    // Two days of three games each, both won: the example that started this.
    bet({
      id: "a",
      legs: [
        leg({ market: "Mais de 1.5 Golos" }),
        leg({ market: "Mais de 1.5 Golos", odds: 1.5 }),
        leg({ market: "Casa", odds: 1.3, modelProb: 62 }),
      ],
      odds: 2.73,
      profitLoss: 8.65,
    }),
    bet({
      id: "b",
      legs: [
        leg({ market: "Mais de 1.5 Golos", odds: 1.45 }),
        leg({ market: "Mais de 1.5 Golos", odds: 1.35 }),
        leg({ market: "Ambas Marcam", odds: 1.6, modelProb: 54 }),
      ],
      odds: 3.13,
      profitLoss: 10.65,
    }),
    // A single that went down.
    bet({
      id: "c",
      status: "red",
      profitLoss: -7.5,
      stake: 7.5,
      legs: [leg({ market: "Casa", status: "red" })],
    }),
    // Somebody else's, which must not leak in.
    bet({ id: "d", userId: "nuno", legs: [leg({ market: "Empate" })] }),
  ];

  const style = buildPlayerStyle("david", "David", bets);

  it("counts only that player's bets", () => {
    expect(style.bets).toBe(3);
    expect(marketOf(style, "Empate")).toBeUndefined();
  });

  it("finds the market backed most often", () => {
    expect(style.favourite?.market).toBe("Mais de 1.5 Golos");
    expect(style.favourite?.backed).toBe(4);
    expect(style.favourite?.landed).toBe(4);
    expect(style.favourite?.hitPct).toBe(100);
  });

  it("scores a market by the legs whose result is known", () => {
    // Casa: two backed, one landed inside a won treble, one lost as a single.
    const casa = marketOf(style, "Casa");

    expect(casa?.backed).toBe(2);
    expect(casa?.landed).toBe(1);
    expect(casa?.failed).toBe(1);
    expect(casa?.hitPct).toBe(50);
  });

  it("will not call a market sharp off one or two legs", () => {
    // "Ambas Marcam" landed the only time it was backed; 100% off one leg is
    // not a finding, so the sharpest market is one with enough behind it.
    expect(marketOf(style, "Ambas Marcam")?.hitPct).toBe(100);
    expect(style.sharpest?.market).toBe("Mais de 1.5 Golos");
  });

  it("groups the bets by how many games went into them", () => {
    const [singles, trebles] = [
      style.sizes.find((row) => row.legs === 1),
      style.sizes.find((row) => row.legs === 3),
    ];

    expect(trebles?.bets).toBe(2);
    expect(trebles?.won).toBe(2);
    expect(trebles?.winPct).toBe(100);
    expect(singles?.bets).toBe(1);
    expect(singles?.lost).toBe(1);
    expect(singles?.winPct).toBe(0);
    // Nothing empty is carried: two games never happened.
    expect(style.sizes.some((row) => row.legs === 2)).toBe(false);
  });

  it("adds up the money and the shape of the betting", () => {
    expect(style.staked).toBe(17.5);
    expect(style.profit).toBe(11.8);
    expect(style.winPct).toBe(66.7);
    expect(style.avgLegs).toBe(2.3);
  });

  it("keeps the model's own call beside the market", () => {
    expect(marketOf(style, "Mais de 1.5 Golos")?.avgModelProb).toBe(78);
    // A game typed by hand carries no forecast, so it must not average in.
    const byHand = buildPlayerStyle("david", "David", [
      bet({ legs: [leg({ market: "Casa", modelProb: 0 })] }),
    ]);
    expect(marketOf(byHand, "Casa")?.avgModelProb).toBeNull();
  });
});

describe("counting what nobody decided", () => {
  it("reports the legs left hanging by a hand-marked loss", () => {
    const style = buildPlayerStyle("david", "David", [
      bet({
        status: "red",
        profitLoss: -5,
        legs: [leg({ market: "Casa" }), leg({ market: "Fora" })],
      }),
    ]);

    expect(style.undecided).toBe(2);
    expect(marketOf(style, "Casa")?.hitPct).toBeNull();
    expect(style.sharpest).toBeNull();
  });
});

describe("both players read as one", () => {
  it("pools the bets whoever placed them", () => {
    const combined = buildCombinedStyle([
      bet({ id: "a", userId: "david" }),
      bet({ id: "b", userId: "nuno", legs: [leg({ market: "Casa" })] }),
    ]);

    expect(combined.bets).toBe(2);
    expect(combined.markets).toHaveLength(2);
  });
});
