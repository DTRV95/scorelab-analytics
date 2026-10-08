import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { PublicBoard } from "@/components/PublicBoard";

/** A kickoff N days from now, at a given hour, as the provider sends it. */
function at(days: number, hour: number, minute = 0): string {
  const when = new Date();
  when.setDate(when.getDate() + days);
  when.setHours(hour, minute, 0, 0);
  return when.toISOString();
}

const match = (
  id: number,
  home: string,
  away: string,
  pct: number,
  kickoff: string,
) => ({
  fixture_id: id,
  league: "Liga Portugal",
  home_name: home,
  away_name: away,
  kickoff,
  headline_market: "1X",
  headline_pct: pct,
  lambda_casa: 1.6,
  lambda_fora: 1.1,
  total_golos_esperados: 2.7,
  amostra_pct: 80,
  amostra_label: "Alta",
  mercados: [],
});

function answers(matches: unknown[]) {
  return vi.fn(async (url: RequestInfo | URL) => {
    void url;
    return {
      ok: true,
      json: async () => ({ matches, unavailable: [], skipped: 0 }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => cleanup());

describe("the day's games, for anybody who has not signed in", () => {
  it("shows today's, and leaves the rest of the week out of it", async () => {
    const fetchMock = answers([
      match(1, "FC Porto", "Rio Ave", 88.4, at(0, 18, 30)),
      match(2, "Benfica", "Estoril", 79.1, at(0, 20, 45)),
      match(3, "Sporting", "Braga", 71.0, at(2, 19)),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicBoard />);

    expect(await screen.findByText("FC Porto")).toBeInTheDocument();
    expect(screen.getByText("Benfica")).toBeInTheDocument();
    // Two days out is not today.
    expect(screen.queryByText("Sporting")).toBeNull();
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/data/probability-board",
    );
  });

  it("says the hour and the market, which is the whole point", async () => {
    vi.stubGlobal("fetch", answers([
      match(1, "FC Porto", "Rio Ave", 88.4, at(0, 18, 30)),
    ]));

    render(<PublicBoard />);

    await screen.findByText("FC Porto");
    expect(screen.getByText("18:30")).toBeInTheDocument();
    expect(screen.getByText("Casa ou Empate (1X)")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("moves on to the next day once today has nothing left", async () => {
    // An empty list at eleven at night would be true and useless.
    vi.stubGlobal("fetch", answers([
      match(4, "Ajax", "PSV", 64.2, at(1, 16)),
    ]));

    render(<PublicBoard />);

    expect(await screen.findByText("Ajax")).toBeInTheDocument();
    expect(screen.getByText("Amanhã")).toBeInTheDocument();
  });

  it("keeps the list short, whatever came back", async () => {
    vi.stubGlobal("fetch", answers(
      Array.from({ length: 30 }, (_, index) =>
        match(index + 1, `Casa ${index}`, "Fora", 70, at(0, 12, index)),
      ),
    ));

    render(<PublicBoard limit={3} />);

    await screen.findByText("Casa 0");
    expect(screen.queryByText("Casa 3")).toBeNull();
  });

  it("says what is happening when the engine does not answer", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });

    render(<PublicBoard />);

    await waitFor(() =>
      expect(screen.getByText(/Não há jogos a chegar/)).toBeInTheDocument(),
    );
    // And says when it is worth coming back.
    expect(screen.getByText(/troca sozinha à meia-noite/)).toBeInTheDocument();
  });

  it("does not ask twice for a board it already has", async () => {
    const fetchMock = answers([
      match(1, "FC Porto", "Rio Ave", 88, at(0, 18)),
    ]);
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<PublicBoard />);
    await screen.findByText("FC Porto");
    first.unmount();

    render(<PublicBoard />);
    await screen.findByText("FC Porto");

    // The same cache the app itself uses: somebody who signs up after reading
    // this does not pay for the request twice.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
