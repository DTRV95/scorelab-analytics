import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type {
  PlanBet,
  PlanFunds,
  PlanMember,
  PlanRecord,
} from "@/lib/planStore";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "david", email: "david@example.com" },
    signOut: vi.fn(),
  }),
}));

// The command centre listens on the window and pulls in the whole search
// index; the bar only needs the event name.
vi.mock("@/components/ScoreLabCommandCenter", () => ({
  OPEN_COMMAND_CENTER_EVENT: "scorelab:open-command-center",
  ScoreLabCommandCenter: () => null,
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

import { PLANS_CHANGED_EVENT } from "@/lib/planStore";
import { PlanBoardProvider } from "@/contexts/PlanBoardContext";
import { TopBar } from "@/components/layout/TopBar";

const plan = (id: string): PlanRecord => ({
  id,
  name: "Plano Milhão",
  starting_bankroll: 10,
  target: 1_000_000,
  created_by: "david",
  start_date: null,
  days: 38,
  rules: MILLION_PLAN_RULES,
  visible: false,
  template_key: "milhao",
});

const member = (planId: string, userId = "david"): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: "David",
  starting_bankroll: 10,
});

const bet = (
  planId: string,
  status: PlanBet["status"],
  profitLoss: number,
  userId = "david",
): PlanBet & { planId: string } => ({
  planId,
  id: `${planId}-${profitLoss}`,
  userId,
  legs: [],
  odds: 1.9,
  stake: 5,
  day: 1,
  status,
  profitLoss,
  placedAt: "2026-09-20T10:00:00.000Z",
  settledAt: status === "pending" ? null : "2026-09-20T20:00:00.000Z",
});

const funds = (planId: string, amount: number): PlanFunds & { planId: string } => ({
  planId,
  id: `f-${planId}-${amount}`,
  userId: "david",
  amount,
  note: null,
  at: "2026-09-29T10:00:00.000Z",
});

function load(
  plans: PlanRecord[],
  members: PlanMember[],
  bets: (PlanBet & { planId: string })[] = [],
  moved: (PlanFunds & { planId: string })[] = [],
) {
  fetchPlans.mockResolvedValue(plans);
  fetchMembersOfPlans.mockResolvedValue(members);
  fetchBetsOfPlans.mockResolvedValue(bets);
  fetchFundsOfPlans.mockResolvedValue(moved);
}

const renderBar = () =>
  render(
    <MemoryRouter>
      <PlanBoardProvider>
        <TopBar />
      </PlanBoardProvider>
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("the bankroll in the bar at the top of every page", () => {
  it("shows every challenge's bankroll added up", async () => {
    // Two challenges of 10 €, one 5 € up and one 3 € down: the same sum the
    // home page calls "banca somada". The bar used to show a total built from
    // saved analyses instead, a figure that matched nothing else on screen.
    load(
      [plan("a"), plan("b")],
      [member("a"), member("b")],
      [bet("a", "green", 5), bet("b", "red", -3)],
    );

    renderBar();

    expect(await screen.findByText("22,00 €")).toBeInTheDocument();
  });

  it("counts money put into a bankroll, as the challenge page does", async () => {
    load([plan("a")], [member("a")], [], [funds("a", 50)]);

    renderBar();

    expect(await screen.findByText("60,00 €")).toBeInTheDocument();
  });

  it("leaves out a challenge this person is not in", async () => {
    load([plan("dos-outros")], [member("dos-outros", "irmao")]);

    renderBar();

    expect(await screen.findByText("0,00 €")).toBeInTheDocument();
  });

  it("says nothing at all until the figure is known", async () => {
    load([plan("a")], [member("a")]);

    renderBar();

    // Rendering 0 € first and correcting it a moment later reads as money
    // lost for as long as it is on screen.
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(await screen.findByText("10,00 €")).toBeInTheDocument();
  });

  it("is the way into the bankroll page", async () => {
    // The thumb row gave the bankroll's place to the leagues, so this figure
    // is how a phone gets there — and it is the obvious thing to tap to see
    // where the number came from.
    load([plan("a")], [member("a")]);

    renderBar();

    const link = (await screen.findByText("10,00 €")).closest("a");
    expect(link).toHaveAttribute("href", "/bankroll");
  });

  it("follows a bet registered somewhere else in the app", async () => {
    load([plan("a")], [member("a")]);

    renderBar();
    expect(await screen.findByText("10,00 €")).toBeInTheDocument();

    load([plan("a")], [member("a")], [bet("a", "green", 7)]);
    act(() => {
      window.dispatchEvent(new Event(PLANS_CHANGED_EVENT));
    });

    await waitFor(() =>
      expect(screen.getByText("17,00 €")).toBeInTheDocument(),
    );
  });
});
