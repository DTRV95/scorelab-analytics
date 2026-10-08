import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

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

import { loadBoard } from "@/lib/boardSource";
import { writeCachedBoard } from "@/lib/probabilityBoardCache";

const match = (home: string): BoardMatch =>
  ({
    fixture_id: 1,
    league: "Liga Portugal",
    home_name: home,
    away_name: "Rival",
    kickoff: new Date(Date.now() + 3600_000).toISOString(),
    headline_market: "1X",
    headline_pct: 80,
    lambda_casa: 1.6,
    lambda_fora: 1,
    total_golos_esperados: 2.6,
    amostra_pct: 80,
    amostra_label: "Alta",
    mercados: [],
  }) as unknown as BoardMatch;

function snapshot(home: string, hoursAgo = 2) {
  return {
    payload: { matches: [match(home)], unavailable: [], skipped: 1 },
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

describe("where the board of games comes from", () => {
  it("uses the copy this browser already has, and asks nobody", async () => {
    writeCachedBoard({
      days: 7,
      matches: [match("Guardado")],
      unavailable: [],
      skipped: 0,
    });
    const asked = vi.fn();
    vi.stubGlobal("fetch", asked);

    const board = await loadBoard(7);

    expect(board.source).toBe("cache");
    expect(board.matches[0].home_name).toBe("Guardado");
    expect(asked).not.toHaveBeenCalled();
    expect(db.asked).toBe(0);
  });

  it("takes last night's board from the database before waking the engine", async () => {
    // The engine sleeps and needs most of a minute to get up. The board is
    // the same for everybody and changes once a day, so nobody should be
    // waiting for that.
    db.row = snapshot("Da base de dados");
    const asked = vi.fn();
    vi.stubGlobal("fetch", asked);

    const board = await loadBoard(7);

    expect(board.source).toBe("snapshot");
    expect(board.matches[0].home_name).toBe("Da base de dados");
    expect(asked).not.toHaveBeenCalled();
  });

  it("keeps what it took, so the next page does not ask again", async () => {
    db.row = snapshot("Da base de dados");
    vi.stubGlobal("fetch", vi.fn());

    await loadBoard(7);
    const second = await loadBoard(7);

    expect(second.source).toBe("cache");
    expect(db.asked).toBe(1);
  });

  it("ignores a stored board old enough to be about games already played", async () => {
    db.row = snapshot("Antiguidade", 72);
    const asked = vi.fn(async () => ({
      ok: true,
      json: async () => ({ matches: [match("Do motor")], unavailable: [], skipped: 0 }),
    }));
    vi.stubGlobal("fetch", asked);

    const board = await loadBoard(7);

    expect(board.source).toBe("engine");
    expect(board.matches[0].home_name).toBe("Do motor");
  });

  it("asks the engine when the database has nothing", async () => {
    db.row = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ matches: [match("Do motor")], unavailable: ["Serie A"], skipped: 2 }),
      })),
    );

    const board = await loadBoard(7);

    expect(board.source).toBe("engine");
    expect(board.unavailable).toEqual(["Serie A"]);
    expect(board.skipped).toBe(2);
  });

  it("goes straight to the engine when somebody presses refresh", async () => {
    writeCachedBoard({
      days: 7,
      matches: [match("Guardado")],
      unavailable: [],
      skipped: 0,
    });
    db.row = snapshot("Da base de dados");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ matches: [match("Acabado de calcular")], unavailable: [], skipped: 0 }),
      })),
    );

    const board = await loadBoard(7, { force: true });

    expect(board.source).toBe("engine");
    expect(board.matches[0].home_name).toBe("Acabado de calcular");
    expect(db.asked).toBe(0);
  });

  it("carries the engine's own complaint rather than inventing one", async () => {
    db.row = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ detail: "A fonte de dados não respondeu." }),
      })),
    );

    await expect(loadBoard(7)).rejects.toThrow("A fonte de dados não respondeu.");
  });

  it("falls through to the engine when the database itself is unhappy", async () => {
    db.error = { message: "no" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ matches: [match("Do motor")], unavailable: [], skipped: 0 }),
      })),
    );

    const board = await loadBoard(7);
    expect(board.source).toBe("engine");
  });
});
