import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "david", email: "david@example.com" },
    signOut: vi.fn(),
  }),
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
import { markSeen } from "@/lib/seenStore";
import Home from "@/pages/Home";

const plan = (id: string, name: string): PlanRecord => ({
  id,
  name,
  starting_bankroll: 10,
  target: 1_000_000,
  created_by: "david",
  start_date: null,
  days: 38,
  rules: MILLION_PLAN_RULES,
  visible: false,
  template_key: "milhao",
  ended_at: null,
  ended_by: null,
});

const member = (planId: string, userId: string, name: string): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: name,
  starting_bankroll: 10,
});

function bet(
  planId: string,
  userId: string,
  profitLoss: number,
  day: number,
  placedAt = "2026-09-25T10:00:00.000Z",
): PlanBet & { planId: string } {
  const settled = profitLoss !== 0;
  return {
    planId,
    id: `${planId}-${userId}-${day}`,
    userId,
    legs: [],
    odds: 1.9,
    stake: 5,
    day,
    status: settled ? (profitLoss > 0 ? "green" : "red") : "pending",
    profitLoss,
    placedAt,
    settledAt: settled ? "2026-09-25T20:00:00.000Z" : null,
  };
}

function load(
  plans: PlanRecord[],
  members: PlanMember[],
  bets: (PlanBet & { planId: string })[] = [],
) {
  fetchPlans.mockResolvedValue(plans);
  fetchMembersOfPlans.mockResolvedValue(members);
  fetchBetsOfPlans.mockResolvedValue(bets);
  fetchFundsOfPlans.mockResolvedValue([]);
}

const renderHome = () =>
  render(
    <MemoryRouter>
      <PlanBoardProvider>
        <Home />
      </PlanBoardProvider>
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});
afterEach(() => cleanup());

describe("the home page and the person on the other side", () => {
  it("says where you stand, by name and by how much", async () => {
    load(
      [plan("p", "Plano Milhão")],
      [member("p", "david", "David"), member("p", "irmao", "Vilagreen")],
      [bet("p", "david", -3, 1), bet("p", "irmao", 5, 1)],
    );

    renderHome();

    expect(
      await screen.findByText(/Estás 8,00\s€ atrás de Vilagreen/),
    ).toBeInTheDocument();
  });

  it("turns the sentence round when you are the one ahead", async () => {
    load(
      [plan("p", "Plano Milhão")],
      [member("p", "david", "David"), member("p", "irmao", "Vilagreen")],
      [bet("p", "david", 5, 1), bet("p", "irmao", -3, 1)],
    );

    renderHome();

    expect(
      await screen.findByText(/Estás 8,00\s€ à frente de Vilagreen/),
    ).toBeInTheDocument();
  });

  it("tells you what they did while you were away", async () => {
    markSeen("david", "p", "2026-09-25T09:00:00.000Z");
    load(
      [plan("p", "Plano Milhão")],
      [member("p", "david", "David"), member("p", "irmao", "Vilagreen")],
      [bet("p", "irmao", 5, 4, "2026-09-25T10:00:00.000Z")],
    );

    renderHome();

    expect(await screen.findByText(/Vilagreen ganhou o nível 4/)).toBeInTheDocument();
    expect(screen.getByText("2 novidades")).toBeInTheDocument();
  });

  it("stops reporting what you have already seen", async () => {
    markSeen("david", "p", "2026-09-26T09:00:00.000Z");
    load(
      [plan("p", "Plano Milhão")],
      [member("p", "david", "David"), member("p", "irmao", "Vilagreen")],
      [bet("p", "irmao", 5, 4, "2026-09-25T10:00:00.000Z")],
    );

    renderHome();

    await screen.findByText(/Estás/);
    expect(screen.queryByText(/Vilagreen ganhou/)).not.toBeInTheDocument();
  });

  it("says nothing at all about a challenge nobody else is in", async () => {
    // There is no gap to a person who does not exist.
    load(
      [plan("sozinho", "Mil euros em 10")],
      [member("sozinho", "david", "David")],
      [bet("sozinho", "david", 5, 1)],
    );

    renderHome();

    await screen.findByText("Mil euros em 10");
    expect(screen.queryByText("Frente a frente")).not.toBeInTheDocument();
  });
});
