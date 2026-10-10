import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const scoring = vi.hoisted(() => ({
  snapshot: vi.fn(async () => null as unknown),
}));

vi.mock("@/lib/boardResults", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/boardResults")>(
      "@/lib/boardResults",
    );
  return { ...actual, fetchResultsSnapshot: scoring.snapshot };
});

import ProbabilityRadar from "@/pages/ProbabilityRadar";
import { forgetLeagueRates } from "@/hooks/useLeagueRates";
import { forgetPrefill } from "@/components/MatchForm";
import {
  readCachedBoard,
  writeCachedBoard,
} from "@/lib/probabilityBoardCache";

const boardPayload = {
  matches: [
    {
      fixture_id: 1,
      league: "Liga Portugal",
      home_name: "Porto",
      away_name: "Nacional",
      kickoff: "2026-09-20T18:00:00Z",
      headline_market: "Casa",
      headline_pct: 78.4,
      amostra_pct: 90,
      amostra_label: "Alta",
      lambda_casa: 2.4,
      lambda_fora: 0.6,
      total_golos_esperados: 3.0,
      mercados: [
        { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 78.4, min_pct: 70, max_pct: 85 },
        { mercado: "Empate", grupo: "Resultado", probabilidade_pct: 14, min_pct: 10, max_pct: 18 },
        { mercado: "Fora", grupo: "Resultado", probabilidade_pct: 7.6, min_pct: 4, max_pct: 12 },
      ],
    },
    {
      fixture_id: 2,
      league: "Premier League",
      home_name: "City",
      away_name: "United",
      kickoff: "2026-09-20T20:00:00Z",
      headline_market: "Mais de 2.5 Golos",
      headline_pct: 55.1,
      amostra_pct: 40,
      amostra_label: "Baixa",
      lambda_casa: 1.6,
      lambda_fora: 1.3,
      total_golos_esperados: 2.9,
      mercados: [
        { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 45, min_pct: 38, max_pct: 52 },
        { mercado: "Mais de 2.5 Golos", grupo: "Golos", probabilidade_pct: 55.1, min_pct: 46, max_pct: 64 },
      ],
    },
    {
      fixture_id: 3,
      league: "Bundesliga",
      home_name: "Bayern",
      away_name: "Dortmund",
      kickoff: "2026-09-21T17:30:00Z",
      headline_market: "Mais de 2.5 Golos",
      headline_pct: 60.0,
      amostra_pct: 85,
      amostra_label: "Alta",
      lambda_casa: 2.0,
      lambda_fora: 1.4,
      total_golos_esperados: 3.4,
      mercados: [
        { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 50, min_pct: 42, max_pct: 58 },
        { mercado: "Mais de 2.5 Golos", grupo: "Golos", probabilidade_pct: 60.0, min_pct: 52, max_pct: 68 },
      ],
    },
  ],
  unavailable: ["Serie A"],
  skipped: 2,
};

/** What the competitions have given this season, for the board to read a
 *  forecast against. */
const ratesPayload = [
  {
    league: "Liga Portugal",
    played: 94,
    markets: [
      { mercado: "Casa", grupo: "Resultado", jogos: 42, pct: 44.7 },
      { mercado: "Mais de 2.5 Golos", grupo: "Golos", jogos: 48, pct: 51.1 },
    ],
  },
];

/** The season behind one fixture, as /data/prefill sends it. */
const prefillPayload = {
  jogos_casa: 9,
  golos_marcados_casa: 21,
  golos_sofridos_casa: 6,
  jogos_casa_rec: 5,
  golos_marcados_casa_rec: 12,
  golos_sofridos_casa_rec: 3,
  jogos_fora: 8,
  golos_marcados_fora: 7,
  golos_sofridos_fora: 14,
  jogos_fora_rec: 5,
  golos_marcados_fora_rec: 4,
  golos_sofridos_fora_rec: 9,
  league_averages: {
    league_home_goals_avg: 1.55,
    league_away_goals_avg: 1.12,
    sample_matches: 94,
  },
};

function mockFetchSequence() {
  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/data/status")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response);
    }
    if (url.includes("/data/probability-board")) {
      return Promise.resolve({
        ok: true,
        json: async () => boardPayload,
      } as Response);
    }
    if (url.includes("/data/prefill")) {
      return Promise.resolve({
        ok: true,
        json: async () => prefillPayload,
      } as Response);
    }
    if (url.includes("/data/league-rates")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ leagues: ratesPayload }),
      } as Response);
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProbabilityRadar />
    </MemoryRouter>
  );
}

function yesterdayScored() {
  const when = new Date();
  when.setDate(when.getDate() - 1);
  when.setHours(20, 0, 0, 0);

  return {
    matches: [
      {
        fixture_id: 77,
        league: "Liga Portugal",
        home_name: "Braga",
        away_name: "Estoril",
        kickoff: when.toISOString(),
        home_goals: 2,
        away_goals: 1,
        headline_market: "Casa",
        headline_pct: 71,
        landed: true,
      },
    ],
    played: 1,
    hits: 1,
    hit_pct: 100,
    predicted_pct: 71,
    unavailable: [],
    skipped: 0,
    at: Date.now(),
    source: "snapshot" as const,
  };
}

beforeEach(() => {
  localStorage.clear();
  scoring.snapshot.mockResolvedValue(null);
  // Both of these are held for the session, which would outlive one test.
  forgetLeagueRates();
  forgetPrefill();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProbabilityRadar board", () => {
  it("groups the default day by league, ranked highest probability first within each", async () => {
    mockFetchSequence();
    renderPage();

    const rows = await screen.findAllByText(/vs/);
    expect(rows.map((row) => row.textContent)).toEqual([
      "Porto vs Nacional",
      "City vs United",
    ]);
    expect(screen.getByText("Liga Portugal")).toBeInTheDocument();
    expect(screen.getByText("Premier League")).toBeInTheDocument();

    // The next day's match is not shown until that day tab is picked.
    expect(screen.queryByText("Bayern vs Dortmund")).not.toBeInTheDocument();
  });

  it("switches which day's matches are visible via the day tabs", async () => {
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");

    const dayTabs = screen.getAllByRole("button", { name: /\d/ });
    fireEvent.click(dayTabs[1]);

    expect(await screen.findByText("Bayern vs Dortmund")).toBeInTheDocument();
    expect(screen.getByText("Bundesliga")).toBeInTheDocument();
    expect(screen.queryByText("Porto vs Nacional")).not.toBeInTheDocument();
  });

  it("puts yesterday in the same row of days, with what it got right", async () => {
    scoring.snapshot.mockResolvedValue(yesterdayScored());
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");
    fireEvent.click(screen.getByRole("button", { name: /^Ontem/ }));

    expect(await screen.findByText("1 de 1")).toBeInTheDocument();
    expect(screen.getByText(/Braga/)).toBeInTheDocument();
    // The games still to play are out of the way while the past is open.
    expect(screen.queryByText("Porto vs Nacional")).toBeNull();
  });

  it("expands a row into the full breakdown only when clicked", async () => {
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");
    // Collapsed: only the headline market shows, not the full breakdown.
    expect(screen.queryByText("Empate")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Porto vs Nacional").closest("button")!);

    expect(await screen.findByText("Empate")).toBeInTheDocument();
    // Appears twice now: the row header and the full breakdown below it.
    expect(screen.getAllByText("Vitória Casa").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /análise avançada/i })
    ).toBeInTheDocument();
  });

  it("surfaces skipped fixtures and unavailable leagues honestly", async () => {
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");

    expect(screen.getByText(/2 jogos sem histórico suficiente/i)).toBeInTheDocument();
    expect(screen.getByText(/Serie A/)).toBeInTheDocument();
  });

  it("keeps the manual entry path available but collapsed by default", async () => {
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");

    expect(screen.queryByText("Equipa da Casa")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/análise manual/i).closest("button")!);

    expect(await screen.findByText("Equipa da Casa")).toBeInTheDocument();
  });

  it("reopening the tab shows the same board instantly, with no new fetch", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/data/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true }) } as Response);
      }
      if (url.includes("/data/probability-board")) {
        return Promise.resolve({ ok: true, json: async () => boardPayload } as Response);
      }
      if (url.includes("/data/prefill")) {
      return Promise.resolve({
        ok: true,
        json: async () => prefillPayload,
      } as Response);
    }
    if (url.includes("/data/league-rates")) {
        return Promise.resolve({ ok: true, json: async () => ({ leagues: ratesPayload }) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = renderPage();
    await screen.findByText("Porto vs Nacional");
    const callsAfterFirstLoad = fetchMock.mock.calls.length;
    expect(callsAfterFirstLoad).toBeGreaterThan(0);

    first.unmount();
    renderPage();

    // Cached data renders straight away — no "a ligar ao motor" wait, and no
    // new network call for either the status check or the board itself.
    expect(screen.getByText("Porto vs Nacional")).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirstLoad);
  });

  it("still fetches fresh data when the user asks for a refresh", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/data/status")) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true }) } as Response);
      }
      if (url.includes("/data/probability-board")) {
        return Promise.resolve({ ok: true, json: async () => boardPayload } as Response);
      }
      if (url.includes("/data/prefill")) {
      return Promise.resolve({
        ok: true,
        json: async () => prefillPayload,
      } as Response);
    }
    if (url.includes("/data/league-rates")) {
        return Promise.resolve({ ok: true, json: async () => ({ leagues: ratesPayload }) } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await screen.findByText("Porto vs Nacional");
    const callsAfterFirstLoad = fetchMock.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: /Procurar jogos outra vez/i }),
    );
    await screen.findByText("Porto vs Nacional");

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirstLoad);
  });

  it("offers a button beside the message when there is nothing to show", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/data/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ configured: true }),
        } as Response);
      }
      if (url.includes("/data/probability-board")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ matches: [], unavailable: [], skipped: 0 }),
        } as Response);
      }
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await screen.findByText(/Sem jogos analisáveis/);
    const callsAfterFirstLoad = fetchMock.mock.calls.length;

    // Two: the header icon and the one next to the message. The point of this
    // change is that the second one exists.
    const buttons = screen.getAllByRole("button", {
      name: /Procurar jogos outra vez/i,
    });
    expect(buttons.length).toBeGreaterThan(1);

    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirstLoad),
    );
  });

  it("does not sit on an empty board for the full cache window", () => {
    writeCachedBoard({ days: 7, matches: [], unavailable: [], skipped: 0 });

    const stored = JSON.parse(
      localStorage.getItem("scorelab_probability_board_cache") as string,
    );
    // Six minutes on: past the short life an incomplete board gets, well
    // inside the two hours a full one would keep.
    stored.fetchedAt = Date.now() - 6 * 60 * 1000;
    localStorage.setItem(
      "scorelab_probability_board_cache",
      JSON.stringify(stored),
    );

    expect(readCachedBoard(7)).toBeNull();
  });
});

describe("what opening a game shows", () => {
  it("opens on the markets, with the rest behind a tap", async () => {
    mockFetchSequence();
    renderPage();

    fireEvent.click(await screen.findByText("Porto vs Nacional"));

    expect(await screen.findByText("Empate")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Mais informações/ }),
    ).toBeInTheDocument();
    // Not until somebody asks for it.
    expect(screen.queryByText("A forma por trás do número")).toBeNull();
    expect(screen.queryByText("Valor por mercado")).toBeNull();
  });

  it("asks the engine for the season only when that tap happens", async () => {
    // Fifteen rows on screen would be fifteen requests nobody wanted.
    mockFetchSequence();
    renderPage();

    fireEvent.click(await screen.findByText("Porto vs Nacional"));
    await screen.findByText("Empate");

    const prefills = () =>
      vi
        .mocked(globalThis.fetch)
        .mock.calls.filter((call) => String(call[0]).includes("/data/prefill"));
    expect(prefills()).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /Mais informações/ }));

    expect(
      await screen.findByText("A forma por trás do número"),
    ).toBeInTheDocument();
    await waitFor(() => expect(prefills()).toHaveLength(1));
  });

  it("shows the goals per game behind the forecast once opened", async () => {
    mockFetchSequence();
    renderPage();

    fireEvent.click(await screen.findByText("Porto vs Nacional"));
    await screen.findByText("Empate");
    fireEvent.click(screen.getByRole("button", { name: /Mais informações/ }));

    // 21 goals in 9 games at home, 7 in 8 away, against the league's average.
    expect(await screen.findByText(/2\.33 marcados/)).toBeInTheDocument();
    expect(screen.getByText(/0\.88 marcados/)).toBeInTheDocument();
    expect(screen.getByText(/liga: 1.55/)).toBeInTheDocument();
  });
});
