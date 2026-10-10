import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { ScoredMatch } from "@/lib/boardResults";

const db = vi.hoisted(() => ({
  row: null as unknown,
  error: null as unknown,
  asked: 0,
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            db.asked += 1;
            return { data: db.row, error: db.error };
          },
        }),
      }),
    }),
  },
}));

import { hitRate, loadBoardResults, playedYesterday } from "@/lib/boardResults";

let id = 0;
function scored(
  landed: boolean,
  { hoursAgo = 26, pct = 78 }: { hoursAgo?: number; pct?: number } = {},
): ScoredMatch {
  id += 1;
  return {
    fixture_id: id,
    league: "Liga Portugal",
    home_name: "Benfica",
    away_name: "Rio Ave",
    kickoff: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
    home_goals: 2,
    away_goals: 0,
    headline_market: "1X",
    headline_pct: pct,
    landed,
  };
}

function snapshot(matches: ScoredMatch[], hoursAgo = 4) {
  const hits = matches.filter((match) => match.landed).length;
  return {
    payload: {
      matches,
      played: matches.length,
      hits,
      hit_pct: (hits / matches.length) * 100,
      predicted_pct: 78,
      unavailable: [],
      skipped: 0,
    },
    computed_at: new Date(Date.now() - hoursAgo * 3600_000).toISOString(),
  };
}

beforeEach(() => {
  localStorage.clear();
  db.row = null;
  db.error = null;
  db.asked = 0;
  vi.restoreAllMocks();
});
afterEach(() => localStorage.clear());

describe("how often the board was right", () => {
  it("counts the ticks against the games, not against the misses", () => {
    const rate = hitRate([scored(true), scored(true), scored(false)]);

    expect(rate.played).toBe(3);
    expect(rate.hits).toBe(2);
    expect(rate.pct).toBe(67);
  });

  it("says what the model claimed, beside what it did", () => {
    // Fifteen of twenty is one thing when it said 75% and another when it
    // said 95%, and a hit rate on its own cannot tell them apart.
    const rate = hitRate([
      scored(true, { pct: 90 }),
      scored(false, { pct: 70 }),
    ]);

    expect(rate.said).toBe(80);
  });

  it("refuses to turn nothing into a percentage", () => {
    const rate = hitRate([]);

    expect(rate.pct).toBeNull();
    expect(rate.said).toBeNull();
  });
});

describe("ontem", () => {
  it("takes yesterday by this phone's calendar, not by the clock", () => {
    // A game at 22:00 yesterday is 26 hours ago at midday and 10 hours ago at
    // 08:00; both are yesterday, and only a calendar day says so.
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(20, 0, 0, 0);

    const older = new Date();
    older.setDate(older.getDate() - 3);

    const today = new Date();
    today.setHours(Math.max(1, today.getHours() - 1), 0, 0, 0);

    const found = playedYesterday([
      { ...scored(true), kickoff: yesterday.toISOString() },
      { ...scored(true), kickoff: older.toISOString() },
      { ...scored(false), kickoff: today.toISOString() },
    ]);

    expect(found).toHaveLength(1);
    expect(new Date(found[0].kickoff!).getDate()).toBe(yesterday.getDate());
  });
});

describe("where the scoring comes from", () => {
  it("takes what the nightly job left, without waking the engine", async () => {
    db.row = snapshot([scored(true), scored(false)]);
    const asked = vi.fn();
    vi.stubGlobal("fetch", asked);

    const results = await loadBoardResults(7);

    expect(results.source).toBe("snapshot");
    expect(results.played).toBe(2);
    expect(asked).not.toHaveBeenCalled();
  });

  it("keeps it, so coming back to the page asks nobody", async () => {
    db.row = snapshot([scored(true)]);
    vi.stubGlobal("fetch", vi.fn());

    await loadBoardResults(7);
    const second = await loadBoardResults(7);

    expect(second.source).toBe("cache");
    expect(db.asked).toBe(1);
  });

  it("ignores a scoring old enough to be about another week", async () => {
    db.row = snapshot([scored(true)], 72);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          matches: [scored(false)],
          played: 1,
          hits: 0,
          hit_pct: 0,
          predicted_pct: 71,
          unavailable: [],
          skipped: 0,
        }),
      })),
    );

    const results = await loadBoardResults(7);

    expect(results.source).toBe("engine");
    expect(results.hits).toBe(0);
  });

  it("goes straight to the engine when somebody asks for it", async () => {
    db.row = snapshot([scored(true)]);
    const asked = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        matches: [scored(true), scored(true)],
        played: 2,
        hits: 2,
        hit_pct: 100,
        predicted_pct: 80,
        unavailable: ["Serie A"],
        skipped: 3,
      }),
    }));
    vi.stubGlobal("fetch", asked);

    const results = await loadBoardResults(7, { force: true });

    expect(results.source).toBe("engine");
    expect(results.unavailable).toEqual(["Serie A"]);
    expect(asked).toHaveBeenCalled();
  });

  it("says what went wrong instead of showing an empty week", async () => {
    db.row = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ detail: "Fonte de dados não configurada." }),
      })),
    );

    await expect(loadBoardResults(7)).rejects.toThrow(
      "Fonte de dados não configurada.",
    );
  });
});
