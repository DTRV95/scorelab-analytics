import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david" }, signOut: vi.fn() }),
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
import { AppSidebar } from "@/components/layout/AppSidebar";
import { markSeen } from "@/lib/seenStore";

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
  template_key: "dobrar",
});

const member = (planId: string, userId: string, name: string): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: name,
  starting_bankroll: 10,
});

const bet = (
  planId: string,
  userId: string,
  day: number,
  placedAt: string,
): PlanBet & { planId: string } => ({
  planId,
  id: `${planId}-${day}`,
  userId,
  legs: [],
  odds: 1.9,
  stake: 5,
  day,
  status: "pending",
  profitLoss: 0,
  placedAt,
  settledAt: null,
});

function load(plans: PlanRecord[] = [], members: PlanMember[] = [], bets: (PlanBet & { planId: string })[] = []) {
  fetchPlans.mockResolvedValue(plans);
  fetchMembersOfPlans.mockResolvedValue(members);
  fetchBetsOfPlans.mockResolvedValue(bets);
  fetchFundsOfPlans.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  load();
});
afterEach(() => cleanup());

const renderNav = () =>
  render(
    <MemoryRouter>
      <PlanBoardProvider>
        <AppSidebar />
      </PlanBoardProvider>
    </MemoryRouter>,
  );

describe("getting to a challenge from the sidebar", () => {
  it("lists the challenges being played, each straight to its own page", async () => {
    load([plan("p1", "Plano Milhão"), plan("p2", "Dobrar a banca")]);

    renderNav();

    expect(
      await screen.findByRole("link", { name: /Plano Milhão/ }),
    ).toHaveAttribute("href", "/desafios/p1");
    expect(
      screen.getByRole("link", { name: /Dobrar a banca/ }),
    ).toHaveAttribute("href", "/desafios/p2");
  });

  it("keeps the way to all of them, and to the comparison, below them", async () => {
    // The group opened with "Todos os desafios", a tautology under a heading
    // that already says Desafios, and closed with "Análise de apostador" —
    // not a challenge, sitting in a list of challenge names, answering to
    // almost the same words as the "Análises" two groups above it.
    renderNav();

    expect(
      await screen.findByRole("link", { name: /Todos os desafios/ }),
    ).toHaveAttribute("href", "/desafios");
    expect(
      screen.getByRole("link", { name: /Comparar jogadores/ }),
    ).toHaveAttribute("href", "/desafios/analise");
    expect(screen.queryByRole("link", { name: "Análise de apostador" })).toBeNull();
  });

  it("shows no challenge of its own when there are none", async () => {
    renderNav();

    await screen.findByRole("link", { name: /Todos os desafios/ });
    expect(
      screen.queryByRole("link", { name: /Plano Milhão/ }),
    ).not.toBeInTheDocument();
  });

  it("marks a challenge the other player moved while you were away", async () => {
    markSeen("david", "p1", "2026-10-01T08:00:00.000Z");
    load(
      [plan("p1", "Plano Milhão")],
      [member("p1", "david", "David"), member("p1", "irmao", "Vilagreen")],
      [bet("p1", "irmao", 4, "2026-10-01T10:00:00.000Z")],
    );

    renderNav();

    expect(await screen.findByLabelText("1 novidade")).toBeInTheDocument();
  });

  it("says nothing on a challenge with nothing new", async () => {
    markSeen("david", "p1", "2026-10-02T08:00:00.000Z");
    load(
      [plan("p1", "Plano Milhão")],
      [member("p1", "david", "David"), member("p1", "irmao", "Vilagreen")],
      [bet("p1", "irmao", 4, "2026-10-01T10:00:00.000Z")],
    );

    renderNav();

    await screen.findByRole("link", { name: /Plano Milhão/ });
    expect(screen.queryByLabelText(/novidade/)).toBeNull();
  });
});
