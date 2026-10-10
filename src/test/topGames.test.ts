import { describe, expect, it } from "vitest";
import { topByDay } from "@/lib/topGames";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

let id = 0;

/**
 * A fixture tomorrow or later, at a daytime hour: always in the future,
 * whatever time of day the suite happens to run at, and never a few hours
 * from rolling into the next day.
 */
function game(
  pct: number,
  { daysAhead = 1, hour = 12 }: { daysAhead?: number; hour?: number } = {},
): BoardMatch {
  id += 1;
  const when = new Date();
  when.setDate(when.getDate() + Math.max(1, daysAhead));
  when.setHours(hour, 0, 0, 0);

  return {
    fixture_id: id,
    league: "Liga Portugal",
    home_name: `Casa ${id}`,
    away_name: `Fora ${id}`,
    kickoff: when.toISOString(),
    headline_market: "1X",
    headline_pct: pct,
    mercados: [],
  } as unknown as BoardMatch;
}

function past(pct: number): BoardMatch {
  const when = new Date();
  when.setHours(when.getHours() - 2);
  return { ...game(pct), kickoff: when.toISOString() };
}

describe("the strongest games of each day", () => {
  it("keeps three per day, the three the model is surest of", () => {
    // Deliberately out of order: the list is a finding, not a clock.
    const days = topByDay([
      game(61, { hour: 10 }),
      game(88, { hour: 16 }),
      game(74, { hour: 12 }),
      game(80, { hour: 18 }),
    ]);

    expect(days).toHaveLength(1);
    expect(days[0].items.map((item) => item.headline_pct)).toEqual([
      88, 80, 74,
    ]);
  });

  it("splits the days, soonest first", () => {
    const days = topByDay([
      game(70, { daysAhead: 3 }),
      game(90, { daysAhead: 2 }),
      game(60, { daysAhead: 1 }),
    ]);

    expect(days).toHaveLength(3);
    expect(days[0].short).toBe("Amanhã");
    // The nearest day first, however sure the model is about a later one.
    expect(days.map((day) => day.items[0].headline_pct)).toEqual([60, 90, 70]);
  });

  it("leaves out what has already kicked off", () => {
    // A 92% on a game being played is a fact, not a tip.
    const days = topByDay([past(92), game(55)]);

    expect(days).toHaveLength(1);
    expect(days[0].items).toHaveLength(1);
    expect(days[0].items[0].headline_pct).toBe(55);
  });

  it("has nothing to say about an empty board", () => {
    expect(topByDay([])).toEqual([]);
  });
});
