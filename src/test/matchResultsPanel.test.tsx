import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/persistenceSync", () => ({
  persistAnalysisRecord: vi.fn(),
  deleteAnalysisRecord: vi.fn(),
  queueEntitySync: vi.fn(),
}));

import { MatchResultsPanel } from "@/components/MatchResultsPanel";
import {
  createEmptyTracking,
  getAnalyses,
  overwriteAnalyses,
} from "@/lib/analysisStorage";
import type { SavedAnalysis } from "@/types/analysis";

const analysis: SavedAnalysis = {
  id: "a1",
  createdAt: "2026-09-01T10:00:00.000Z",
  homeTeam: "Porto",
  awayTeam: "Benfica",
  league: "Liga Portugal",
  fixture: { id: 501, league: "Liga Portugal", kickoff: "2026-09-02T19:00:00Z" },
  summary: { homeXg: 1.6, awayXg: 1.2, totalXg: 2.8, confidence: 60 },
  results: [],
  tracking: {
    ...createEmptyTracking(),
    betPlaced: true,
    selectedMarket: "Over 2.5",
    stakeUsed: 20,
    oddUsed: 2,
    bankrollBefore: 1000,
    bankrollAfter: 1000,
  },
};

function mockResults(body: unknown, ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
}

const finished = {
  league: "Liga Portugal",
  results: [
    {
      fixture_id: 501,
      status: "FINISHED",
      finished: true,
      home_goals: 2,
      away_goals: 1,
      kickoff: "2026-09-02T19:00:00Z",
      home_name: "Porto",
      away_name: "Benfica",
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  overwriteAnalyses([analysis]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MatchResultsPanel", () => {
  it("records the final score on its own but waits for a click to settle", async () => {
    mockResults(finished);

    render(<MatchResultsPanel analyses={getAnalyses()} />);

    expect(await screen.findByText(/1 resultado final atualizado/i)).toBeInTheDocument();

    // The score is in; the money is not.
    const [afterScore] = getAnalyses();
    expect(afterScore.modelAudit?.homeGoals).toBe(2);
    expect(afterScore.tracking.resultStatus).toBe("pending");
    expect(afterScore.tracking.bankrollAfter).toBe(1000);

    fireEvent.click(screen.getByRole("button", { name: /liquidar 1/i }));

    await waitFor(() => {
      const [settled] = getAnalyses();
      expect(settled.tracking.resultStatus).toBe("green");
      expect(settled.tracking.bankrollAfter).toBe(1020);
    });
  });

  it("drops a line from the batch when the user dismisses it", async () => {
    mockResults(finished);

    render(<MatchResultsPanel analyses={getAnalyses()} />);

    await screen.findByRole("button", { name: /liquidar 1/i });
    fireEvent.click(screen.getByTitle(/não liquidar esta/i));

    expect(
      screen.queryByRole("button", { name: /liquidar/i })
    ).not.toBeInTheDocument();
    expect(getAnalyses()[0].tracking.resultStatus).toBe("pending");
  });

  it("says nothing when the fixture has not been played", async () => {
    mockResults({
      league: "Liga Portugal",
      results: [
        {
          ...finished.results[0],
          status: "TIMED",
          finished: false,
          home_goals: null,
          away_goals: null,
        },
      ],
    });

    render(<MatchResultsPanel analyses={getAnalyses()} />);

    expect(
      await screen.findByText(/ainda não foi disputado/i)
    ).toBeInTheDocument();
    expect(getAnalyses()[0].modelAudit ?? null).toBeNull();
  });

  it("reports a competition the data source could not answer for", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    render(<MatchResultsPanel analyses={getAnalyses()} />);

    expect(
      await screen.findByText(/sem resposta da fonte de dados/i)
    ).toBeInTheDocument();
  });
});
