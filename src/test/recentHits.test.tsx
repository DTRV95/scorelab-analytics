import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BoardResults, ScoredMatch } from "@/lib/boardResults";

const api = vi.hoisted(() => ({
  snapshot: vi.fn(async () => null as BoardResults | null),
  load: vi.fn(async () => ({}) as BoardResults),
}));

vi.mock("@/lib/boardResults", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/boardResults")>(
      "@/lib/boardResults",
    );
  return {
    ...actual,
    fetchResultsSnapshot: api.snapshot,
    loadBoardResults: api.load,
  };
});

import { RecentHits } from "@/components/RecentHits";

let id = 0;
function scored(
  landed: boolean,
  {
    daysAgo = 1,
    hour = 20,
    pct = 78,
    home = "Benfica",
    away = "Rio Ave",
  }: {
    daysAgo?: number;
    hour?: number;
    pct?: number;
    home?: string;
    away?: string;
  } = {},
): ScoredMatch {
  id += 1;
  const when = new Date();
  when.setDate(when.getDate() - daysAgo);
  when.setHours(hour, 0, 0, 0);

  return {
    fixture_id: id,
    league: "Liga Portugal",
    home_name: home,
    away_name: away,
    kickoff: when.toISOString(),
    home_goals: landed ? 2 : 0,
    away_goals: landed ? 0 : 1,
    headline_market: "1X",
    headline_pct: pct,
    landed,
  };
}

function results(matches: ScoredMatch[]): BoardResults {
  const hits = matches.filter((match) => match.landed).length;
  return {
    matches,
    played: matches.length,
    hits,
    hit_pct: matches.length ? (hits / matches.length) * 100 : 0,
    predicted_pct: 78,
    unavailable: [],
    skipped: 0,
    at: Date.now(),
    source: "snapshot",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.snapshot.mockResolvedValue(null);
});
afterEach(() => cleanup());

describe("how the board did", () => {
  it("counts yesterday's games, and says what the model claimed", async () => {
    api.snapshot.mockResolvedValue(
      results([
        scored(true, { pct: 80 }),
        scored(true, { pct: 70, home: "Porto" }),
        scored(false, { pct: 60, home: "Sporting" }),
        // Three days ago: in the week, not in yesterday.
        scored(false, { daysAgo: 3, home: "Braga" }),
      ]),
    );

    render(<RecentHits />);

    expect(await screen.findByText("2 de 3")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText(/Dizia, em média, 70%/)).toBeInTheDocument();
    expect(screen.queryByText(/Braga/)).toBeNull();
  });

  it("switches to the whole week without asking anybody again", async () => {
    api.snapshot.mockResolvedValue(
      results([scored(true), scored(false, { daysAgo: 4, home: "Braga" })]),
    );

    render(<RecentHits />);
    fireEvent.click(await screen.findByRole("button", { name: "Semana" }));

    expect(await screen.findByText("1 de 2")).toBeInTheDocument();
    expect(screen.getByText(/Braga/)).toBeInTheDocument();
    expect(api.load).not.toHaveBeenCalled();
  });

  it("says so when nothing was played, instead of showing 0%", async () => {
    api.snapshot.mockResolvedValue(
      results([scored(true, { daysAgo: 5, home: "Braga" })]),
    );

    render(<RecentHits />);

    expect(
      await screen.findByText(/Ontem não se jogou nada/),
    ).toBeInTheDocument();
  });

  it("never wakes the engine on its own", async () => {
    // Scoring a week means simulating every game in it again, and the engine
    // takes most of a minute to get up. Nobody opens this page into that.
    api.snapshot.mockResolvedValue(null);

    render(<RecentHits />);

    expect(
      await screen.findByRole("button", { name: /Ver como correram/ }),
    ).toBeInTheDocument();
    expect(api.load).not.toHaveBeenCalled();
  });

  it("asks the engine when somebody presses the button", async () => {
    api.snapshot.mockResolvedValue(null);
    api.load.mockResolvedValue(results([scored(true), scored(true)]));

    render(<RecentHits />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver como correram/ }),
    );

    expect(await screen.findByText("2 de 2")).toBeInTheDocument();
    expect(api.load).toHaveBeenCalledWith(7, { force: true });
  });

  it("says a failed request failed", async () => {
    api.snapshot.mockResolvedValue(null);
    api.load.mockRejectedValue(new Error("Fonte de dados não configurada."));

    render(<RecentHits />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver como correram/ }),
    );

    expect(
      await screen.findByText("Fonte de dados não configurada."),
    ).toBeInTheDocument();
  });
});
