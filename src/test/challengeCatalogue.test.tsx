import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CHALLENGE_TEMPLATES } from "@/lib/challengeRules";
import { challengeLines } from "@/lib/challengePitch";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david", email: "david@example.com" } }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const {
  fetchPlans,
  createPlan,
  fetchVisiblePlans,
  fetchMembersOfPlans,
  fetchBetsOfPlans,
  fetchFundsOfPlans,
} = vi.hoisted(() => ({
  fetchPlans: vi.fn(async () => [] as unknown[]),
  createPlan: vi.fn(async () => "new-plan"),
  fetchVisiblePlans: vi.fn(async () => [] as unknown[]),
  fetchMembersOfPlans: vi.fn(async () => [] as unknown[]),
  fetchBetsOfPlans: vi.fn(async () => [] as unknown[]),
  fetchFundsOfPlans: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@/lib/planStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore"
  );
  return {
    ...actual,
    fetchPlans,
    createPlan,
    fetchVisiblePlans,
    fetchMembersOfPlans,
    fetchBetsOfPlans,
    fetchFundsOfPlans,
  };
});

import { PlanBoardProvider } from "@/contexts/PlanBoardContext";
import ChallengeCatalogue from "@/pages/ChallengeCatalogue";

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <MemoryRouter>
      <PlanBoardProvider>
        <ChallengeCatalogue />
      </PlanBoardProvider>
    </MemoryRouter>
  );

describe("the page of challenges there are", () => {
  it("lists every ready-made challenge", async () => {
    renderPage();

    for (const template of CHALLENGE_TEMPLATES) {
      expect(await screen.findByText(template.name)).toBeInTheDocument();
    }
  });

  it("puts a measured difficulty on each one", async () => {
    renderPage();

    // The Plano Milhão is never finished in any simulation; the Sprint is
    // finished in about four runs of ten. Both are said out loud.
    expect(
      (await screen.findAllByText(/Nunca se acabou em nenhuma simulação/)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/de cada 100 tentativas/).length,
    ).toBeGreaterThan(0);
  });

  it("explains a challenge from its own rules when it is opened", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("Sprint de 7"));

    expect(screen.getByText("O que custa um dia mau")).toBeInTheDocument();
    expect(screen.getByText("Aposta por dia")).toBeInTheDocument();
    expect(screen.getByText(/Matematicamente viável/)).toBeInTheDocument();
  });

  it("keeps the phrases on a row of their own, where a phone can read them", async () => {
    // Measured at 360px: in half a row these two were cut off mid-word, and
    // they are the two somebody most needs before starting.
    const lines = challengeLines(
      CHALLENGE_TEMPLATES.find((t) => t.key === "milhao")!,
    );
    const wide = lines.filter((line) => line.wide).map((line) => line.label);

    expect(wide).toEqual(["Aposta por dia", "O que custa um dia mau"]);
  });

  it("writes a big multiple in a way somebody can read", async () => {
    const lines = challengeLines(
      CHALLENGE_TEMPLATES.find((t) => t.key === "milhao")!,
    );
    const multiple = lines.find((line) => line.label === "Quanto multiplica");

    // The separator is a non-breaking space, which is the point: it keeps the
    // number from being split across two lines on a narrow phone.
    expect(multiple?.value.replace(/\u00a0/g, " ")).toBe("100 000× a banca");
    expect(multiple?.value).toContain("\u00a0");
  });

  it("says outright which ones are a chase rather than a plan", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("Dobrar 10 dias seguidos"));

    expect(screen.getByText(/Bilhete de lotaria, e de propósito/)).toBeInTheDocument();
  });

  it("creates a challenge from the one being read about", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("Dobrar a banca"));
    fireEvent.click(screen.getByRole("button", { name: /Novo desafio/ }));

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Criar desafio$/ }));

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Dobrar a banca" }),
    );
  });

  it("keeps a running challenge one tap from the day's bet", async () => {
    fetchPlans.mockResolvedValueOnce([
      {
        id: "plan-1",
        name: "Plano Milhão",
        starting_bankroll: 10,
        target: 1000000,
        created_by: "david",
        start_date: null,
        days: 38,
        rules: {},
      },
    ]);

    renderPage();

    const link = await screen.findByRole("link", { name: /Plano Milhão/ });
    expect(link).toHaveAttribute("href", "/desafios/plan-1");
  });
});

describe("seeing what everybody else is running", () => {
  const openPlan = {
    id: "p-open",
    name: "Dobrar a banca",
    starting_bankroll: 20,
    target: 40,
    created_by: "outro",
    start_date: null,
    days: 14,
    rules: {},
    visible: true,
    template_key: "dobrar",
  };

  it("counts how many people are on each challenge", async () => {
    fetchVisiblePlans.mockResolvedValueOnce([openPlan]);
    fetchMembersOfPlans.mockResolvedValueOnce([
      { plan_id: "p-open", user_id: "outro", display_name: "Outro", starting_bankroll: 20 },
      { plan_id: "p-open", user_id: "terceiro", display_name: "Terceiro", starting_bankroll: 20 },
    ]);

    renderPage();

    expect(await screen.findByText("2 a fazer")).toBeInTheDocument();
  });

  it("opens a ranking of everybody doing it", async () => {
    fetchVisiblePlans.mockResolvedValueOnce([openPlan]);
    fetchMembersOfPlans.mockResolvedValueOnce([
      { plan_id: "p-open", user_id: "outro", display_name: "Outro", starting_bankroll: 20 },
    ]);
    fetchBetsOfPlans.mockResolvedValueOnce([
      {
        planId: "p-open",
        id: "b1",
        userId: "outro",
        legs: [],
        odds: 1.9,
        stake: 5,
        day: 1,
        status: "green",
        profitLoss: 10,
        placedAt: "2026-09-20T10:00:00.000Z",
        settledAt: "2026-09-20T20:00:00.000Z",
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByText("Dobrar a banca"));
    fireEvent.click(await screen.findByRole("button", { name: /Ver classificação/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Outro")).toBeInTheDocument();
    // €10 of a €20 climb.
    expect(within(dialog).getByText("50%")).toBeInTheDocument();
  });

  it("offers no ranking for a challenge nobody has opened up", async () => {
    renderPage();

    fireEvent.click(await screen.findByText("Sprint de 7"));

    expect(
      screen.queryByRole("button", { name: /Ver classificação/ }),
    ).not.toBeInTheDocument();
  });

  it("can put the busiest challenges first, or leave them in order", async () => {
    renderPage();

    const toggle = await screen.findByRole("button", { name: /Mais feitos primeiro/ });
    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: /Por ordem/ })).toBeInTheDocument();
  });
});
