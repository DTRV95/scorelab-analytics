import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david", email: "david@example.com" } }),
}));

// Hoisted: vi.mock's factory runs before the module body, so the spy has to
// exist before it.
const { savePlanBet } = vi.hoisted(() => ({
  savePlanBet: vi.fn(async (_planId: string, userId: string, payload: unknown) => ({
    ...(payload as Record<string, unknown>),
    id: "new",
    userId,
  })),
}));

vi.mock("@/lib/planStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore"
  );
  return {
    ...actual,
    fetchPlan: vi.fn(async () => ({
      plan: {
        id: "plan",
        name: "Plano Milhão",
        starting_bankroll: 10,
        target: 1000000,
        created_by: "david",
      },
      members: [
        { plan_id: "plan", user_id: "david", display_name: "David", starting_bankroll: 10 },
        { plan_id: "plan", user_id: "irmao", display_name: "Irmão", starting_bankroll: 10 },
      ],
    })),
    fetchPlanBets: vi.fn(async () => [
      {
        id: "b1",
        userId: "david",
        match: "FC Porto vs SL Benfica",
        homeTeam: "FC Porto",
        awayTeam: "SL Benfica",
        league: "Liga Portugal",
        market: "Casa",
        odds: 2,
        stake: 5,
        modelProb: 60,
        day: 1,
        status: "green" as const,
        profitLoss: 5,
        placedAt: "2026-09-21T10:00:00.000Z",
        settledAt: "2026-09-21T20:00:00.000Z",
        fixture: { id: 1, league: "Liga Portugal", kickoff: null },
      },
      {
        id: "b2",
        userId: "irmao",
        match: "Sporting CP vs Arouca",
        homeTeam: "Sporting CP",
        awayTeam: "Arouca",
        league: "Liga Portugal",
        market: "Casa",
        odds: 1.8,
        stake: 5,
        modelProb: 71,
        day: 1,
        status: "red" as const,
        profitLoss: -5,
        placedAt: "2026-09-21T10:00:00.000Z",
        settledAt: "2026-09-21T20:00:00.000Z",
        fixture: { id: 2, league: "Liga Portugal", kickoff: null },
      },
    ]),
    savePlanBet,
  };
});

import MillionPlan from "@/pages/MillionPlan";
import { writeCachedBoard } from "@/lib/probabilityBoardCache";

function boardMatch(id: number, home: string, pct: number) {
  return {
    fixture_id: id,
    league: "Liga Portugal",
    home_name: home,
    away_name: "Rival",
    kickoff: "2026-09-26T18:00:00Z",
    headline_market: "Casa",
    headline_pct: pct,
    amostra_pct: 80,
    amostra_label: "Alta",
    lambda_casa: 1.8,
    lambda_fora: 1.0,
    total_golos_esperados: 2.8,
    mercados: [
      { mercado: "Casa", grupo: "Resultado", probabilidade_pct: pct, min_pct: pct - 5, max_pct: pct + 5 },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  savePlanBet.mockClear();
  // Twelve fixtures so the shortlist has to cut it down to ten.
  writeCachedBoard({
    days: 7,
    matches: Array.from({ length: 12 }, (_, i) =>
      boardMatch(100 + i, `Equipa ${i}`, 50 + i)
    ),
    unavailable: [],
    skipped: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter>
      <MillionPlan />
    </MemoryRouter>
  );
}

describe("Plano Milhão", () => {
  it("shows both brothers' bankrolls and the combined total", async () => {
    renderPage();

    // David won day 1: €10 + €5. His brother lost his: €10 - €5.
    // Each name appears twice: the standing card and the picks column.
    expect((await screen.findAllByText("David")).length).toBe(2);
    expect(screen.getAllByText("Irmão").length).toBe(2);
    expect(screen.getAllByText("15,00 €").length).toBeGreaterThan(0);
    expect(screen.getAllByText("5,00 €").length).toBeGreaterThan(0);
    // 15 + 5 combined.
    expect(screen.getByText("20,00 €")).toBeInTheDocument();
  });

  it("puts each brother on his own day of the plan", async () => {
    renderPage();

    // One bet each already placed, so both are on day 2.
    expect((await screen.findAllByText("Dia 2")).length).toBe(2);
  });

  it("offers the ten strongest calls, best first", async () => {
    renderPage();

    const rows = await screen.findAllByRole("button", { name: /^Escolher$/ });
    expect(rows).toHaveLength(10);
    // The board had twelve; the weakest two are left out.
    expect(screen.getByText(/Equipa 11 vs Rival/)).toBeInTheDocument();
    expect(screen.queryByText(/Equipa 0 vs Rival/)).not.toBeInTheDocument();
  });

  it("stakes the plan's share of the real bankroll, not of the table's figure", async () => {
    renderPage();

    // Day 2 is still a 50% day, and David has €15.
    expect(
      await screen.findByText(/O plano manda 50% da banca hoje/)
    ).toBeInTheDocument();
    expect(screen.getAllByText("7,50 €").length).toBeGreaterThan(0);
  });

  it("warns when the odd falls outside what the plan allows", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /^Escolher$/ }))[0]);
    fireEvent.change(screen.getByPlaceholderText("1.85"), {
      target: { value: "3.40" },
    });

    expect(
      await screen.findByText(/só aceita odds entre 1.75 e 2.10/)
    ).toBeInTheDocument();
  });

  it("registers the day's bet with the plan's stake", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /^Escolher$/ }))[0]);
    fireEvent.change(screen.getByPlaceholderText("1.85"), {
      target: { value: "1.85" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registar aposta do dia 2/ }));

    expect(savePlanBet).toHaveBeenCalledTimes(1);
    const [, userId, payload] = savePlanBet.mock.calls[0];
    expect(userId).toBe("david");
    expect(payload).toMatchObject({
      stake: 7.5,
      odds: 1.85,
      day: 2,
      status: "pending",
    });
  });

  it("says out loud what the ladder actually requires", async () => {
    renderPage();

    expect(await screen.findByText(/O que a escada exige/)).toBeInTheDocument();
    expect(screen.getByText(/sequência de vitórias seguidas/)).toBeInTheDocument();
    expect(screen.getByText(/Uma derrota hoje deixa-te em/)).toBeInTheDocument();
  });
});
