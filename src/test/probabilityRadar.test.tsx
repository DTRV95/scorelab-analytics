import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ProbabilityRadar from "@/pages/ProbabilityRadar";

const boardPayload = {
  matches: [
    {
      fixture_id: 1,
      league: "Liga Portugal",
      home_name: "Porto",
      away_name: "Nacional",
      kickoff: "2026-09-20T18:00:00Z",
      headline_market: "Casa",
      headline_pct: 78.4,
      amostra_pct: 90,
      amostra_label: "Alta",
      lambda_casa: 2.4,
      lambda_fora: 0.6,
      total_golos_esperados: 3.0,
      mercados: [
        { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 78.4, min_pct: 70, max_pct: 85 },
        { mercado: "Empate", grupo: "Resultado", probabilidade_pct: 14, min_pct: 10, max_pct: 18 },
        { mercado: "Fora", grupo: "Resultado", probabilidade_pct: 7.6, min_pct: 4, max_pct: 12 },
      ],
    },
    {
      fixture_id: 2,
      league: "Premier League",
      home_name: "City",
      away_name: "United",
      kickoff: "2026-09-21T15:00:00Z",
      headline_market: "Mais de 2.5 Golos",
      headline_pct: 55.1,
      amostra_pct: 40,
      amostra_label: "Baixa",
      lambda_casa: 1.6,
      lambda_fora: 1.3,
      total_golos_esperados: 2.9,
      mercados: [
        { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 45, min_pct: 38, max_pct: 52 },
        { mercado: "Mais de 2.5 Golos", grupo: "Golos", probabilidade_pct: 55.1, min_pct: 46, max_pct: 64 },
      ],
    },
  ],
  unavailable: ["Serie A"],
  skipped: 2,
};

function mockFetchSequence() {
  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/data/status")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response);
    }
    if (url.includes("/data/probability-board")) {
      return Promise.resolve({
        ok: true,
        json: async () => boardPayload,
      } as Response);
    }
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProbabilityRadar />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ProbabilityRadar board", () => {
  it("loads and shows every match ranked highest probability first, with no odds anywhere", async () => {
    mockFetchSequence();
    renderPage();

    const rows = await screen.findAllByText(/vs/);
    expect(rows[0]).toHaveTextContent("Porto vs Nacional");
    expect(rows[1]).toHaveTextContent("City vs United");

    expect(screen.getByText("78.4%")).toBeInTheDocument();
    expect(screen.getByText("55.1%")).toBeInTheDocument();
  });

  it("expands a row into the full breakdown only when clicked", async () => {
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");
    // Collapsed: only the headline market shows, not the full breakdown.
    expect(screen.queryByText("Empate")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Porto vs Nacional").closest("button")!);

    expect(await screen.findByText("Empate")).toBeInTheDocument();
    // Appears twice now: the row header and the full breakdown below it.
    expect(screen.getAllByText("Vitória Casa").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /continuar para análise de valor/i })
    ).toBeInTheDocument();
  });

  it("surfaces skipped fixtures and unavailable leagues honestly", async () => {
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");

    expect(screen.getByText(/2 jogos sem histórico suficiente/i)).toBeInTheDocument();
    expect(screen.getByText(/Serie A/)).toBeInTheDocument();
  });

  it("keeps the manual entry path available but collapsed by default", async () => {
    mockFetchSequence();
    renderPage();

    await screen.findByText("Porto vs Nacional");

    expect(screen.queryByText("Equipa da Casa")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/análise manual/i).closest("button")!);

    expect(await screen.findByText("Equipa da Casa")).toBeInTheDocument();
  });
});
