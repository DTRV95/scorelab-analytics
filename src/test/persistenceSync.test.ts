import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hydrateAnalysesFromServer,
  hydrateMultiplesFromServer,
  persistAnalysisRecord,
  persistMultipleRecord,
} from "@/lib/persistenceSync";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("persistenceSync", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("hydrates analyses from dedicated analysis records", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        analyses: [
          {
            id: "analysis-1",
            payload: {
              id: "analysis-1",
              homeTeam: "Benfica",
              awayTeam: "Porto",
              createdAt: "2026-04-22T10:00:00.000Z",
            },
          },
        ],
      }),
    } as Response);

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
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        multiples: [
          {
            id: "multiple-1",
            payload: {
              id: "multiple-1",
              createdAt: "2026-04-22T12:00:00.000Z",
              combinedOdds: 2.6,
            },
          },
        ],
      }),
    } as Response);

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
    localStorage.setItem(
      "scorelab_analyses",
      JSON.stringify([{ id: "analysis-1", notes: "local-version" }])
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        analysis: {
          id: "analysis-1",
          payload: { id: "analysis-1", notes: "server-version" },
        },
        ignored_due_to_staleness: true,
      }),
    } as Response);

    persistAnalysisRecord({
      id: "analysis-1",
      notes: "local-version",
    });

    await flushPromises();

    expect(JSON.parse(localStorage.getItem("scorelab_analyses") || "[]")).toEqual([
      { id: "analysis-1", notes: "server-version" },
    ]);
  });

  it("replaces local multiple with backend winner when write is stale", async () => {
    localStorage.setItem(
      "scorelab_multiples",
      JSON.stringify([{ id: "multiple-1", notes: "local-version" }])
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        multiple: {
          id: "multiple-1",
          payload: { id: "multiple-1", notes: "server-version" },
        },
        ignored_due_to_staleness: true,
      }),
    } as Response);

    persistMultipleRecord({
      id: "multiple-1",
      notes: "local-version",
    });

    await flushPromises();

    expect(JSON.parse(localStorage.getItem("scorelab_multiples") || "[]")).toEqual([
      { id: "multiple-1", notes: "server-version" },
    ]);
  });
});
