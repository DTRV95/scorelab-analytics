import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSession = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabaseClient", () => ({
  isSupabaseConfigured: true,
  SUPABASE_NOT_CONFIGURED_MESSAGE: "Supabase is not configured.",
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  hydrateAnalysesFromServer,
  hydrateMultiplesFromServer,
  hydrateStorageFromServer,
  persistAnalysisRecord,
  persistMultipleRecord,
} from "@/lib/persistenceSync";

const flushPromises = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

function mockSignedIn(userId = "user-1") {
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: userId } } },
  });
}

function mockTableRows(table: string, rows: unknown[]) {
  mockFrom.mockImplementation((name: string) => ({
    select: () => ({
      order: () =>
        Promise.resolve(
          name === table ? { data: rows, error: null } : { data: [], error: null }
        ),
    }),
  }));
}

describe("persistenceSync", () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetSession.mockReset();
    mockRpc.mockReset();
    mockFrom.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports signed-out instead of touching the server without a session", async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });

    const result = await hydrateStorageFromServer();

    expect(result).toMatchObject({ hydrated: false, source: "signed-out" });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("hydrates analyses from dedicated analysis records", async () => {
    mockSignedIn();
    mockTableRows("user_analyses", [
      {
        id: "analysis-1",
        payload: {
          id: "analysis-1",
          homeTeam: "Benfica",
          awayTeam: "Porto",
          createdAt: "2026-04-22T10:00:00.000Z",
        },
      },
    ]);

    const result = await hydrateAnalysesFromServer();

    expect(result).toMatchObject({
      hydrated: true,
      source: "analysis-records",
    });
    expect(JSON.parse(localStorage.getItem("scorelab_analyses") || "[]")).toEqual([
      {
        id: "analysis-1",
        homeTeam: "Benfica",
        awayTeam: "Porto",
        createdAt: "2026-04-22T10:00:00.000Z",
      },
    ]);
  });

  it("hydrates multiples from dedicated multiple records", async () => {
    mockSignedIn();
    mockTableRows("user_multiples", [
      {
        id: "multiple-1",
        payload: {
          id: "multiple-1",
          createdAt: "2026-04-22T12:00:00.000Z",
          combinedOdds: 2.6,
        },
      },
    ]);

    const result = await hydrateMultiplesFromServer();

    expect(result).toMatchObject({
      hydrated: true,
      source: "multiple-records",
    });
    expect(JSON.parse(localStorage.getItem("scorelab_multiples") || "[]")).toEqual([
      {
        id: "multiple-1",
        createdAt: "2026-04-22T12:00:00.000Z",
        combinedOdds: 2.6,
      },
    ]);
  });

  it("replaces local analysis with backend winner when write is stale", async () => {
    mockSignedIn();
    localStorage.setItem(
      "scorelab_analyses",
      JSON.stringify([{ id: "analysis-1", notes: "local-version" }])
    );

    mockRpc.mockResolvedValue({
      data: {
        payload: { id: "analysis-1", notes: "server-version" },
        was_stale: true,
      },
      error: null,
    });

    persistAnalysisRecord({
      id: "analysis-1",
      notes: "local-version",
    });

    await flushPromises();

    expect(mockRpc).toHaveBeenCalledWith(
      "save_user_analysis",
      expect.objectContaining({ p_id: "analysis-1" })
    );
    expect(JSON.parse(localStorage.getItem("scorelab_analyses") || "[]")).toEqual([
      { id: "analysis-1", notes: "server-version" },
    ]);
  });

  it("replaces local multiple with backend winner when write is stale", async () => {
    mockSignedIn();
    localStorage.setItem(
      "scorelab_multiples",
      JSON.stringify([{ id: "multiple-1", notes: "local-version" }])
    );

    mockRpc.mockResolvedValue({
      data: {
        payload: { id: "multiple-1", notes: "server-version" },
        was_stale: true,
      },
      error: null,
    });

    persistMultipleRecord({
      id: "multiple-1",
      notes: "local-version",
    });

    await flushPromises();

    expect(mockRpc).toHaveBeenCalledWith(
      "save_user_multiple",
      expect.objectContaining({ p_id: "multiple-1" })
    );
    expect(JSON.parse(localStorage.getItem("scorelab_multiples") || "[]")).toEqual([
      { id: "multiple-1", notes: "server-version" },
    ]);
  });
});
