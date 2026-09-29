import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { fetchPlans } = vi.hoisted(() => ({
  fetchPlans: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@/lib/planStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore"
  );
  return { ...actual, fetchPlans };
});

import { AppSidebar } from "@/components/layout/AppSidebar";

const plan = (id: string, name: string) => ({
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

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

const renderNav = () =>
  render(
    <MemoryRouter>
      <AppSidebar />
    </MemoryRouter>
  );

describe("getting to a challenge from the sidebar", () => {
  it("names the list as the list, not as one challenge", async () => {
    // It used to read "Plano Milhão" and open the list of every challenge:
    // a label promising one thing and a link doing another.
    renderNav();

    const link = await screen.findByRole("link", { name: /Todos os desafios/ });
    expect(link).toHaveAttribute("href", "/desafios");
  });

  it("lists the challenges being played, each straight to its own page", async () => {
    fetchPlans.mockResolvedValueOnce([
      plan("p1", "Plano Milhão"),
      plan("p2", "Dobrar a banca"),
    ]);

    renderNav();

    expect(
      await screen.findByRole("link", { name: /Plano Milhão/ }),
    ).toHaveAttribute("href", "/desafios/p1");
    expect(
      screen.getByRole("link", { name: /Dobrar a banca/ }),
    ).toHaveAttribute("href", "/desafios/p2");
  });

  it("shows no challenge of its own when there are none", async () => {
    renderNav();

    await screen.findByRole("link", { name: /Todos os desafios/ });
    expect(screen.queryByRole("link", { name: /Plano Milhão/ })).not.toBeInTheDocument();
  });

  it("puts the bettor analysis where the challenges are", async () => {
    renderNav();

    expect(
      await screen.findByRole("link", { name: /Análise de apostador/ }),
    ).toHaveAttribute("href", "/desafios/analise");
  });
});
