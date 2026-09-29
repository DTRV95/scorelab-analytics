import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CHALLENGE_TEMPLATES } from "@/lib/challengeRules";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david", email: "david@example.com" } }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { fetchPlans, createPlan } = vi.hoisted(() => ({
  fetchPlans: vi.fn(async () => [] as unknown[]),
  createPlan: vi.fn(async () => "new-plan"),
}));

vi.mock("@/lib/planStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore"
  );
  return { ...actual, fetchPlans, createPlan };
});

import ChallengeCatalogue from "@/pages/ChallengeCatalogue";

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <MemoryRouter>
      <ChallengeCatalogue />
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
