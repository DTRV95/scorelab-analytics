import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PlanBetPayload } from "@/lib/planStore";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david" }, signOut: vi.fn() }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { fetchLooseBets, saveLooseBet, updateLooseBet, deleteLooseBet } =
  vi.hoisted(() => ({
    fetchLooseBets: vi.fn(async () => [] as unknown[]),
    saveLooseBet: vi.fn(async () => ({})),
    updateLooseBet: vi.fn(async () => undefined),
    deleteLooseBet: vi.fn(async () => undefined),
  }));

vi.mock("@/lib/looseBets", async () => {
  const actual = await vi.importActual<typeof import("@/lib/looseBets")>(
    "@/lib/looseBets",
  );
  return { ...actual, fetchLooseBets, saveLooseBet, updateLooseBet, deleteLooseBet };
});

const { fetchPlans, fetchMembersOfPlans, fetchBetsOfPlans, fetchFundsOfPlans } =
  vi.hoisted(() => ({
    fetchPlans: vi.fn(async () => [] as unknown[]),
    fetchMembersOfPlans: vi.fn(async () => [] as unknown[]),
    fetchBetsOfPlans: vi.fn(async () => [] as unknown[]),
    fetchFundsOfPlans: vi.fn(async () => [] as unknown[]),
  }));

vi.mock("@/lib/planStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore",
  );
  return {
    ...actual,
    fetchPlans,
    fetchMembersOfPlans,
    fetchBetsOfPlans,
    fetchFundsOfPlans,
  };
});

const { fetchFixtureResults } = vi.hoisted(() => ({
  fetchFixtureResults: vi.fn(async () => ({
    results: new Map<number, unknown>(),
    unavailable: [] as string[],
  })),
}));

vi.mock("@/lib/resultsSync", async () => {
  const actual = await vi.importActual<typeof import("@/lib/resultsSync")>(
    "@/lib/resultsSync",
  );
  return { ...actual, fetchFixtureResults };
});

import { PlanBoardProvider } from "@/contexts/PlanBoardContext";
import { Toaster } from "@/components/ui/toaster";
import LooseBets from "@/pages/LooseBets";
import type { LooseBet } from "@/lib/looseBets";

const leg = (home: string, away: string, market: string, odds: number) => ({
  match: `${home} vs ${away}`,
  homeTeam: home,
  awayTeam: away,
  league: "Adicionado à mão",
  market,
  odds,
  modelProb: 0,
  fixtureId: null,
  kickoff: null,
  status: "pending" as const,
});

const bet = (overrides: Partial<LooseBet> = {}): LooseBet => ({
  id: "b1",
  userId: "david",
  legs: [leg("Braga", "Estoril", "Casa", 1.5), leg("Porto", "Benfica", "2X", 1.9)],
  odds: 2.85,
  stake: 10,
  day: 0,
  status: "pending",
  profitLoss: 0,
  placedAt: "2026-10-02T10:00:00.000Z",
  settledAt: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchLooseBets.mockResolvedValue([]);
  fetchFixtureResults.mockResolvedValue({
    results: new Map(),
    unavailable: [],
  });
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ matches: [], unavailable: [] }),
  })) as unknown as typeof fetch;
});
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <MemoryRouter>
      <PlanBoardProvider>
        <LooseBets />
        <Toaster />
      </PlanBoardProvider>
    </MemoryRouter>,
  );

describe("bets that answer to no challenge", () => {
  it("says what there is to do when there is nothing yet", async () => {
    renderPage();

    expect(
      await screen.findByText(/não tem dia nem escada/),
    ).toBeInTheDocument();
  });

  it("registers a bet of two games, with the odds multiplied", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Registar aposta/ }),
    );

    const dialog = await screen.findByRole("dialog", { name: /Registar aposta/ });
    fireEvent.click(within(dialog).getByRole("button", { name: /Inserir jogo/ }));

    const picker = await screen.findByRole("dialog", { name: /Inserir jogo/ });
    for (const [home, away, market, odd] of [
      ["Braga", "Estoril", "Casa", "1.50"],
      ["Porto", "Benfica", "2X", "1.90"],
    ]) {
      // The form stays open and empty after a game goes in, ready for the
      // next one, so the way in is only there for the first.
      const openForm = within(picker).queryByRole("button", {
        name: /Adicionar um jogo à mão/,
      });
      if (openForm) fireEvent.click(openForm);

      fireEvent.change(within(picker).getByPlaceholderText("Equipa casa"), {
        target: { value: home },
      });
      fireEvent.change(within(picker).getByPlaceholderText("Equipa fora"), {
        target: { value: away },
      });
      fireEvent.change(within(picker).getByLabelText("A tua aposta"), {
        target: { value: market },
      });
      fireEvent.change(within(picker).getByPlaceholderText("Odd"), {
        target: { value: odd },
      });
      fireEvent.click(
        within(picker).getByRole("button", { name: /Juntar ao boletim/ }),
      );
    }
    fireEvent.click(within(picker).getByRole("button", { name: /Concluído/ }));

    fireEvent.change(await within(dialog).findByLabelText("Valor apostado"), {
      target: { value: "10" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /^Registar aposta$/ }),
    );

    await waitFor(() => expect(saveLooseBet).toHaveBeenCalled());
    const [userId, payload] = saveLooseBet.mock.calls[0] as unknown as [
      string,
      PlanBetPayload,
    ];
    expect(userId).toBe("david");
    expect(payload.legs).toHaveLength(2);
    expect(payload.stake).toBe(10);
    // 1.50 and 1.90, multiplied, as any bookmaker would.
    expect(payload.odds).toBeCloseTo(2.85, 5);
    // No day, because there is no ladder to be on.
    expect(payload.day).toBe(0);
    expect(payload.status).toBe("pending");
  });

  it("adds up what was decided, and keeps what is still riding apart", async () => {
    fetchLooseBets.mockResolvedValue([
      bet({ id: "a", status: "green", profitLoss: 18.5, stake: 10 }),
      bet({ id: "b", status: "red", profitLoss: -5, stake: 5 }),
      bet({ id: "c", status: "pending", stake: 8, odds: 2 }),
    ]);

    renderPage();

    const tiles = (await screen.findByText("Apostado")).closest(
      "div.grid",
    ) as HTMLElement;
    expect(within(tiles).getByText("15,00 €")).toBeInTheDocument();
    expect(within(tiles).getByText("+13,50 €")).toBeInTheDocument();
    expect(within(tiles).getByText("50%")).toBeInTheDocument();
    expect(within(tiles).getByText("8,00 €")).toBeInTheDocument();
  });

  it("settles itself once every game is marked", async () => {
    fetchLooseBets.mockResolvedValue([bet()]);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Ver a aposta/ }));
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getAllByRole("button", { name: /Entrou/ })[0]);
    await waitFor(() => expect(updateLooseBet).toHaveBeenCalled());

    const [, payload] = updateLooseBet.mock.calls[0] as unknown as [
      string,
      PlanBetPayload,
    ];
    // One of two marked: the bet is not decided yet.
    expect(payload.status).toBe("pending");
    expect(payload.legs[0].status).toBe("green");
  });

  it("closes itself off the final scores, game by game", async () => {
    // Exactly as inside a challenge, and from the same provider: the market
    // that came in goes green, the one that failed goes red, and the bet is
    // green only when every game is.
    const fromBoard = {
      ...leg("Cruzeiro", "São Paulo", "1X", 1.5),
      fixtureId: 11,
      league: "Brasileirão",
    };
    const other = {
      ...leg("Internacional", "Corinthians", "Menos de 3.5 Golos", 1.9),
      fixtureId: 12,
      league: "Brasileirão",
    };
    fetchLooseBets.mockResolvedValue([bet({ legs: [fromBoard, other] })]);
    fetchFixtureResults.mockResolvedValue({
      results: new Map([
        [11, { fixture_id: 11, status: "FINISHED", finished: true, home_goals: 2, away_goals: 0, kickoff: null, home_name: null, away_name: null }],
        [12, { fixture_id: 12, status: "FINISHED", finished: true, home_goals: 3, away_goals: 2, kickoff: null, home_name: null, away_name: null }],
      ]),
      unavailable: [],
    });

    renderPage();

    await waitFor(() => expect(updateLooseBet).toHaveBeenCalled());
    const [, payload] = updateLooseBet.mock.calls[0] as unknown as [
      string,
      PlanBetPayload,
    ];
    // 2-0 is a home win, so 1X came in. 3-2 is five goals, so under 3.5 did
    // not — and one red takes the whole bet down.
    expect(payload.legs[0].status).toBe("green");
    expect(payload.legs[1].status).toBe("red");
    expect(payload.status).toBe("red");
    expect(payload.profitLoss).toBe(-10);
  });

  it("leaves a game typed by hand for its owner", async () => {
    // Nothing to look up and no result to fetch.
    fetchLooseBets.mockResolvedValue([bet()]);

    renderPage();
    await screen.findByRole("button", { name: /Ver a aposta/ });

    expect(fetchFixtureResults).not.toHaveBeenCalled();
    expect(updateLooseBet).not.toHaveBeenCalled();
  });

  it("names the bet by its games, with no day to name it by", async () => {
    fetchLooseBets.mockResolvedValue([bet()]);

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Ver a aposta/ }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("heading")).toHaveTextContent(
      "Braga vs Estoril",
    );
    expect(within(dialog).queryByText(/^Dia /)).toBeNull();
  });
});
