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
import { readCachedBoard, writeCachedBoard } from "@/lib/probabilityBoardCache";

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

  it("takes a newer stored board on refresh instead of waking the engine", async () => {
    // The copy in the browser was computed three hours ago; the job has
    // rewritten the board since. Refresh means "show me the newer one", and
    // that is the newer one — a minute of waking the engine would have
    // produced the same games.
    writeCachedBoard({
      days: 7,
      matches: [match("Guardado")],
      unavailable: [],
      skipped: 0,
      computedAt: Date.now() - 3 * 3600_000,
    });
    db.row = snapshot("Da base de dados", 1);
    const engine = vi.fn();
    vi.stubGlobal("fetch", engine);

    const board = await loadBoard(7, { force: true });

    expect(board.source).toBe("snapshot");
    expect(board.matches[0].home_name).toBe("Da base de dados");
    expect(engine).not.toHaveBeenCalled();
  });

  it("goes to the engine on refresh when the stored board is the one in hand", async () => {
    const computedAt = Date.now() - 3600_000;
    writeCachedBoard({
      days: 7,
      matches: [match("Guardado")],
      unavailable: [],
      skipped: 0,
      computedAt,
    });
    db.row = {
      payload: { matches: [match("Da base de dados")], unavailable: [], skipped: 1 },
      computed_at: new Date(computedAt).toISOString(),
    };
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
  });

  it("hands over a newer stored board after serving the saved copy", async () => {
    writeCachedBoard({
      days: 7,
      matches: [match("Guardado")],
      unavailable: [],
      skipped: 0,
      computedAt: Date.now() - 3 * 3600_000,
    });
    db.row = snapshot("Da base de dados", 1);
    vi.stubGlobal("fetch", vi.fn());

    const newer: string[] = [];
    const board = await loadBoard(7, {
      onNewer: (data) => newer.push(data.matches[0].home_name),
    });

    expect(board.source).toBe("cache");
    expect(board.matches[0].home_name).toBe("Guardado");

    await vi.waitFor(() => expect(newer).toEqual(["Da base de dados"]));
    // And the browser keeps the newer one, so the next visit starts there.
    expect(readCachedBoard(7)?.matches[0].home_name).toBe("Da base de dados");
  });

  it("says nothing when the stored board is no newer than the saved copy", async () => {
    const computedAt = Date.now() - 3600_000;
    writeCachedBoard({
      days: 7,
      matches: [match("Guardado")],
      unavailable: [],
      skipped: 0,
      computedAt,
    });
    db.row = {
      payload: { matches: [match("Da base de dados")], unavailable: [], skipped: 1 },
      computed_at: new Date(computedAt).toISOString(),
    };

    const onNewer = vi.fn();
    await loadBoard(7, { onNewer });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onNewer).not.toHaveBeenCalled();
    expect(readCachedBoard(7)?.matches[0].home_name).toBe("Guardado");
  });

  it("will not let an empty answer from the engine erase a board that exists", async () => {
    // The engine wakes up cold, runs into the provider's ten requests a
    // minute and says "no games". That used to replace the board with an
    // empty page, and write the empty page over the copy in the browser.
    writeCachedBoard({
      days: 7,
      matches: [match("Guardado")],
      unavailable: [],
      skipped: 0,
      computedAt: Date.now() - 3600_000,
    });
    db.row = snapshot("Da base de dados", 2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ matches: [], unavailable: [], skipped: 0 }),
      })),
    );

    const board = await loadBoard(7, { force: true });

    expect(board.matches).toHaveLength(1);
    expect(board.source).toBe("snapshot");
    expect(readCachedBoard(7)?.matches).toHaveLength(1);
  });

  it("keeps an empty answer out of the saved copy when there is nothing anywhere", async () => {
    db.row = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ matches: [], unavailable: [], skipped: 0 }),
      })),
    );

    const board = await loadBoard(7);

    expect(board.matches).toEqual([]);
    // Nothing saved: "no games" is never an answer worth keeping, and the
    // next visit asks again instead of repeating it.
    expect(localStorage.getItem("scorelab_probability_board_cache")).toBeNull();
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
