import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { PlanBet, PlanFunds, PlanMember, PlanRecord } from "@/lib/planStore";

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
import BankrollTools from "@/pages/BankrollTools";

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

const member = (planId: string): PlanMember => ({
  plan_id: planId,
  user_id: "david",
  display_name: "David",
  starting_bankroll: 10,
});

const bet = (
  planId: string,
  status: PlanBet["status"],
  profitLoss: number,
  stake = 5,
): PlanBet & { planId: string } => ({
  planId,
  id: `${planId}-${status}-${profitLoss}`,
  userId: "david",
  legs: [],
  odds: 2,
  stake,
  day: 1,
  status,
  profitLoss,
  placedAt: "2026-09-20T10:00:00.000Z",
  settledAt: status === "pending" ? null : "2026-09-20T20:00:00.000Z",
});

const funds = (planId: string, amount: number): PlanFunds & { planId: string } => ({
  planId,
  id: `f-${planId}`,
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

const renderPage = () =>
  render(
    <MemoryRouter>
      <PlanBoardProvider>
        <BankrollTools />
      </PlanBoardProvider>
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("the bankroll page", () => {
  it("counts the same money the rest of the app counts", async () => {
    // Two challenges of 10 €, one 5 € up, one 3 € down, and 50 € put in.
    load(
      [plan("a", "Plano Milhão"), plan("b", "Mil euros em 10")],
      [member("a"), member("b")],
      [bet("a", "green", 5), bet("b", "red", -3)],
      [funds("a", 50)],
    );

    renderPage();

    // "Banca somada" era só os desafios a decorrer; o saldo é tudo — e
    // aparece duas vezes, nos números do topo e na conta que os explica.
    const tiles = (await screen.findAllByText("Saldo"))[0]
      .closest("div.grid") as HTMLElement;

    expect(within(tiles).getByText("72,00 €")).toBeInTheDocument();
    // What the betting did, with the deposit kept out of it.
    expect(within(tiles).getByText("+2,00 €")).toBeInTheDocument();
    // What was put on the table: two starting bankrolls and the deposit.
    expect(within(tiles).getByText("70,00 €")).toBeInTheDocument();
  });

  it("draws each challenge against where it started", async () => {
    load(
      [plan("a", "Plano Milhão")],
      [member("a")],
      [bet("a", "green", 5)],
    );

    const { container } = renderPage();
    await screen.findByText("Onde está a banca");

    expect(screen.getByText(/começou em/)).toBeInTheDocument();

    const bar = [...container.querySelectorAll("[title]")].find((node) =>
      node.getAttribute("title")?.includes("começou em"),
    );
    expect(bar).toBeTruthy();
  });

  it("says what each challenge did with the sign and the figure, not the colour alone", async () => {
    // Green and red are eight units apart for a deuteranope. The side of the
    // middle line, the sign and the number all have to say it too.
    load(
      [plan("a", "Plano Milhão"), plan("b", "Mil euros em 10")],
      [member("a"), member("b")],
      [bet("a", "green", 5), bet("b", "red", -3)],
    );

    renderPage();
    const section = (await screen.findByText("O que cada desafio deu"))
      .closest("section") as HTMLElement;

    expect(within(section).getByText("+5,00 €")).toBeInTheDocument();
    expect(within(section).getByText("-3,00 €")).toBeInTheDocument();
  });

  it("shows what is riding on days nobody has closed", async () => {
    load([plan("a", "Plano Milhão")], [member("a")], [bet("a", "pending", 0, 4)]);

    renderPage();

    expect(await screen.findByText("O que está em jogo")).toBeInTheDocument();
    // 4 € staked at 2.00 turns 10 € into 14 € if it lands.
    expect(screen.getByText(/a banca passa a/)).toBeInTheDocument();
    expect(screen.getByText("14,00 €")).toBeInTheDocument();
  });

  it("sends somebody with no challenges to where the bankroll lives", async () => {
    load([], []);

    renderPage();

    expect(
      await screen.findByText(/A banca vive dentro dos desafios/),
    ).toBeInTheDocument();
  });
});
