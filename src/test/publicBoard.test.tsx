import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { PublicBoard } from "@/components/PublicBoard";

const match = (id: number, home: string, away: string, pct: number) => ({
  fixture_id: id,
  league: "Liga Portugal",
  home_name: home,
  away_name: away,
  kickoff: null,
  headline_market: "1X",
  headline_pct: pct,
  lambda_casa: 1.6,
  lambda_fora: 1.1,
  total_golos_esperados: 2.7,
  amostra_pct: 80,
  amostra_label: "Alta",
  mercados: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});
afterEach(() => cleanup());

describe("the games anybody can see, without an account", () => {
  it("asks the engine for them and shows what came back", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      void url;
      return {
        ok: true,
        json: async () => ({
          matches: [
            match(1, "FC Porto", "Rio Ave", 88.4),
            match(2, "Benfica", "Estoril", 79.1),
          ],
          unavailable: [],
          skipped: 0,
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PublicBoard />);

    expect(await screen.findByText("FC Porto vs Rio Ave")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getAllByText("Casa ou Empate (1X)").length).toBe(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/data/probability-board");
  });

  it("keeps the list short, whatever came back", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({
        matches: Array.from({ length: 20 }, (_, index) =>
          match(index + 1, `Casa ${index}`, "Fora", 70),
        ),
      }),
    }));

    render(<PublicBoard limit={3} />);

    await screen.findByText("Casa 0 vs Fora");
    expect(screen.queryByText("Casa 3 vs Fora")).toBeNull();
  });

  it("says what is happening when the engine does not answer", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });

    render(<PublicBoard />);

    await waitFor(() =>
      expect(screen.getByText(/não estão a chegar/)).toBeInTheDocument(),
    );
  });

  it("does not ask twice for a board it already has", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ matches: [match(1, "FC Porto", "Rio Ave", 88)] }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = render(<PublicBoard />);
    await screen.findByText("FC Porto vs Rio Ave");
    first.unmount();

    render(<PublicBoard />);
    await screen.findByText("FC Porto vs Rio Ave");

    // The same cache the app itself uses: somebody who signs up after reading
    // this does not pay for the request twice.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
