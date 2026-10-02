import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { PlanBet, PlanLeg, PlanMember, PlanRecord } from "@/lib/planStore";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david" }, signOut: vi.fn() }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

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

import { PlanBoardProvider } from "@/contexts/PlanBoardContext";
import BettorAnalysis from "@/pages/BettorAnalysis";

const plan = (id: string, name: string): PlanRecord => ({
  id,
  name,
  starting_bankroll: 10,
  target: 1000,
  created_by: "david",
  start_date: null,
  days: 14,
  rules: {},
  visible: false,
  template_key: null,
});

const member = (planId: string, userId: string, name: string): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: name,
  starting_bankroll: 10,
});

const leg = (market: string): PlanLeg => ({
  match: "Casa vs Fora",
  homeTeam: "Casa",
  awayTeam: "Fora",
  league: "Adicionado à mão",
  market,
  odds: 1.9,
  modelProb: 0,
  fixtureId: null,
  kickoff: null,
  status: "green",
});

const bet = (
  planId: string,
  userId: string,
  market: string,
  n: number,
): PlanBet & { planId: string } => ({
  planId,
  id: `${planId}-${userId}-${n}`,
  userId,
  legs: [leg(market)],
  odds: 1.9,
  stake: 5,
  day: n,
  status: "green",
  profitLoss: 4.5,
  placedAt: `2026-09-2${n}T10:00:00.000Z`,
  settledAt: `2026-09-2${n}T20:00:00.000Z`,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Two challenges: the first of the account has both brothers in it, the
  // second is this person on their own.
  fetchPlans.mockResolvedValue([
    plan("juntos", "Plano Milhão"),
    plan("sozinho", "Mil euros em 10"),
  ]);
  fetchMembersOfPlans.mockResolvedValue([
    member("juntos", "david", "David"),
    member("juntos", "irmao", "Vilagreen"),
    member("sozinho", "david", "David"),
  ]);
  fetchBetsOfPlans.mockResolvedValue([
    bet("juntos", "david", "Casa", 1),
    bet("juntos", "irmao", "Ambas Marcam", 2),
    bet("sozinho", "david", "2X", 3),
  ]);
  fetchFundsOfPlans.mockResolvedValue([]);
});
afterEach(() => cleanup());

const renderAt = (planId: string) =>
  render(
    <MemoryRouter initialEntries={[`/desafios/${planId}/analise`]}>
      <PlanBoardProvider>
        <Routes>
          <Route path="/desafios/:planId/analise" element={<BettorAnalysis />} />
        </Routes>
      </PlanBoardProvider>
    </MemoryRouter>,
  );

describe("the analysis of a challenge's bettors", () => {
  it("reads the challenge in the address, not the first one of the account", async () => {
    // Opening it from a challenge nobody else is in used to show the other
    // challenge's bets, and the other player's with them.
    renderAt("sozinho");

    expect(await screen.findByText(/Mil euros em 10/)).toBeInTheDocument();
    expect(screen.getAllByText(/Fora ou Empate \(2X\)/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Ambas Marcam/)).toBeNull();
    expect(screen.queryByText(/Vitória Casa/)).toBeNull();
  });

  it("offers nobody to switch to in a challenge of one", async () => {
    renderAt("sozinho");

    await screen.findByText(/Mil euros em 10/);
    expect(screen.queryByRole("button", { name: /Os dois/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Vilagreen/ })).toBeNull();
  });

  it("offers both players in a challenge they share", async () => {
    renderAt("juntos");

    expect(await screen.findByText(/Plano Milhão/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Os dois/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vilagreen/ })).toBeInTheDocument();
    // And the bets of that challenge only.
    expect(screen.queryByText(/Fora ou Empate \(2X\)/)).toBeNull();
  });
});
