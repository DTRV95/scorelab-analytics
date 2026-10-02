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
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
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

function load(
  plans: PlanRecord[] = [],
  members: PlanMember[] = [],
  bets: (PlanBet & { planId: string })[] = [],
) {
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

describe("getting to the challenges from the sidebar", () => {
  it("holds one way in, not one entry per challenge", async () => {
    // The menu used to unfold them: every challenge by name, the full list,
    // and the comparison — four entries in a sidebar for what is one page.
    load([plan("p1", "Plano Milhão"), plan("p2", "Dobrar a banca")]);

    renderNav();

    expect(
      await screen.findByRole("link", { name: /Desafios/ }),
    ).toHaveAttribute("href", "/desafios");
    expect(screen.queryByRole("link", { name: /Plano Milhão/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Todos os desafios/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Comparar jogadores/ })).toBeNull();
  });

  it("counts what the other players did across every challenge", async () => {
    markSeen("david", "p1", "2026-10-01T08:00:00.000Z");
    markSeen("david", "p2", "2026-10-01T08:00:00.000Z");
    load(
      [plan("p1", "Plano Milhão"), plan("p2", "Dobrar a banca")],
      [
        member("p1", "david", "David"),
        member("p1", "irmao", "Vilagreen"),
        member("p2", "david", "David"),
        member("p2", "irmao", "Vilagreen"),
      ],
      [
        bet("p1", "irmao", 4, "2026-10-01T10:00:00.000Z"),
        bet("p2", "irmao", 2, "2026-10-01T11:00:00.000Z"),
      ],
    );

    renderNav();

    expect(await screen.findByLabelText("2 novidades")).toBeInTheDocument();
  });

  it("says nothing when there is nothing new", async () => {
    markSeen("david", "p1", "2026-10-02T08:00:00.000Z");
    load(
      [plan("p1", "Plano Milhão")],
      [member("p1", "david", "David"), member("p1", "irmao", "Vilagreen")],
      [bet("p1", "irmao", 4, "2026-10-01T10:00:00.000Z")],
    );

    renderNav();

    await screen.findByRole("link", { name: /Desafios/ });
    expect(screen.queryByLabelText(/novidade/)).toBeNull();
  });
});

describe("the thumb row, which on a phone is the whole menu", () => {
  const renderRow = () =>
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>,
    );

  it("carries the leagues, and gets to the bankroll from the bar instead", () => {
    // Five places is all a thumb row holds. The bankroll's figure is in the
    // top bar of every page and opens the page itself, so it did not need a
    // second way in; the leagues had none at all.
    renderRow();

    expect(screen.getByRole("link", { name: "Ligas" })).toHaveAttribute(
      "href",
      "/ligas",
    );
    expect(screen.queryByRole("link", { name: "Banca" })).toBeNull();
  });

  it("keeps the four places a bet is made or followed", () => {
    renderRow();

    for (const [name, url] of [
      ["Início", "/dashboard"],
      ["Jogos", "/probability"],
      ["Desafios", "/desafios"],
      ["Apostas", "/apostas"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", url);
    }
  });
});
