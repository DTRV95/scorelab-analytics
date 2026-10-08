import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { writeCachedBoard, type BoardMatch } from "@/lib/probabilityBoardCache";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/modelAccuracy", () => ({
  fetchLeagueAccuracy: async () => ({ markets: [] }),
}));

import MatchDeepDive from "@/pages/MatchDeepDive";

const match = {
  fixture_id: 77,
  league: "Liga Portugal",
  home_name: "FC Porto",
  away_name: "Casa Pia",
  kickoff: "2026-10-09T19:00:00.000Z",
  headline_market: "1X",
  headline_pct: 88,
  lambda_casa: 1.7,
  lambda_fora: 0.95,
  total_golos_esperados: 2.65,
  amostra_pct: 82,
  amostra_label: "Alta",
  mercados: [
    { mercado: "1X", grupo: "Resultado", probabilidade_pct: 88, min_pct: 80, max_pct: 93 },
    { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 71, min_pct: 62, max_pct: 79 },
  ],
} as unknown as BoardMatch;

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({}) })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/match/77"]}>
      <Routes>
        <Route path="/match/:fixtureId" element={<MatchDeepDive />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the page for one game", () => {
  it("opens on the game, instead of a blank screen", async () => {
    // It went blank: a helper that writes the kick-off was deleted along with
    // a panel that moved out of this file, and nothing rendered this page in
    // a test, so nothing noticed until somebody tapped a game.
    writeCachedBoard({
      days: 7,
      matches: [match],
      unavailable: [],
      skipped: 0,
    });

    renderPage();

    expect(
      (await screen.findAllByText(/FC Porto/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Casa Pia/).length).toBeGreaterThan(0);
    // The kick-off, written under the name.
    expect(screen.getByText(/19:00|20:00/)).toBeInTheDocument();
  });

  it("says so when the game is no longer on the board", async () => {
    writeCachedBoard({ days: 7, matches: [], unavailable: [], skipped: 0 });

    renderPage();

    expect(
      await screen.findByText(/já não está no quadro de probabilidades/),
    ).toBeInTheDocument();
  });
});
