import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { COVERED_LEAGUES } from "@/lib/boardLeagues";
import type { LeagueReport } from "@/lib/leagueReport";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const { fetchLeagueReport } = vi.hoisted(() => ({
  fetchLeagueReport: vi.fn(async () => ({}) as unknown),
}));

vi.mock("@/lib/leagueReport", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leagueReport")>(
    "@/lib/leagueReport",
  );
  return { ...actual, fetchLeagueReport };
});

import Leagues from "@/pages/Leagues";

const report = (overrides: Partial<LeagueReport> = {}): LeagueReport => ({
  league: "Liga Portugal",
  played: 100,
  markets: [
    { mercado: "Casa", grupo: "Resultado", jogos: 46, pct: 46 },
    { mercado: "Empate", grupo: "Resultado", jogos: 26, pct: 26 },
    { mercado: "Fora", grupo: "Resultado", jogos: 28, pct: 28 },
    { mercado: "Mais de 2.5 Golos", grupo: "Golos", jogos: 52, pct: 52 },
    { mercado: "Menos de 3.5 Golos", grupo: "Golos", jogos: 72, pct: 72 },
    { mercado: "Ambas Marcam", grupo: "Ambas Marcam", jogos: 49, pct: 49 },
    {
      mercado: "2X e Mais de 1.5 Golos",
      grupo: "Combinados",
      jogos: 40,
      pct: 40,
    },
  ],
  goals: { home_avg: 1.5, away_avg: 1.2, total_avg: 2.7 },
  form: [
    {
      team: "Benfica",
      played: 5,
      points: 13,
      won: 4,
      drawn: 1,
      lost: 0,
      scored: 11,
      conceded: 3,
      run: "VEVVV",
    },
    {
      team: "Porto",
      played: 5,
      points: 11,
      won: 3,
      drawn: 2,
      lost: 0,
      scored: 8,
      conceded: 2,
      run: "EVVEV",
    },
    {
      team: "Sporting CP",
      played: 5,
      points: 10,
      won: 3,
      drawn: 1,
      lost: 1,
      scored: 9,
      conceded: 5,
      run: "VDVEV",
    },
    {
      team: "Braga",
      played: 5,
      points: 9,
      won: 3,
      drawn: 0,
      lost: 2,
      scored: 7,
      conceded: 6,
      run: "VDVDV",
    },
  ],
  form_window: 5,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchLeagueReport.mockResolvedValue(report());
});
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <MemoryRouter>
      <Leagues />
    </MemoryRouter>,
  );

describe("what a competition actually does", () => {
  it("opens on a covered league and asks for that one", async () => {
    renderPage();

    // The games tile, which every percentage on the page is out of.
    expect(await screen.findByText("100")).toBeInTheDocument();
    expect(fetchLeagueReport).toHaveBeenCalledWith(COVERED_LEAGUES[0]);
  });

  it("shows every market as a share of the games played", async () => {
    renderPage();

    await screen.findByText("46 de 100");
    expect(screen.getByText("Vitória Casa")).toBeInTheDocument();
    expect(screen.getByText("72 de 100")).toBeInTheDocument();
    // Twice over: the group's heading, and the market inside it.
    expect(screen.getAllByText("Ambas Marcam")).toHaveLength(2);
  });

  it("sorts the markets into the groups a slip is built in", async () => {
    renderPage();

    await screen.findByText("46 de 100");
    for (const group of ["Resultado", "Golos", "Ambas Marcam", "Combinados"]) {
      expect(screen.getAllByText(group).length).toBeGreaterThan(0);
    }
  });

  it("keeps the form to the best three, with the run itself", async () => {
    renderPage();

    const form = (await screen.findByText("Quem está em forma")).closest(
      "section",
    ) as HTMLElement;

    expect(within(form).getByText("Benfica")).toBeInTheDocument();
    expect(within(form).getByText("Sporting CP")).toBeInTheDocument();
    // Fourth by points, so it stays out.
    expect(within(form).queryByText("Braga")).toBeNull();
    expect(within(form).getByLabelText("Forma: VEVVV")).toBeInTheDocument();
  });

  it("asks for the league that was tapped", async () => {
    renderPage();
    await screen.findByText("46 de 100");

    fireEvent.click(screen.getByRole("button", { name: "Serie A" }));

    expect(fetchLeagueReport).toHaveBeenLastCalledWith("Serie A");
  });

  it("invents no percentage for a season that has not started", async () => {
    fetchLeagueReport.mockResolvedValue(
      report({ played: 0, form: [], markets: [] }),
    );

    renderPage();

    expect(
      await screen.findByText(/Ainda não há jogos disputados/),
    ).toBeInTheDocument();
  });

  it("says so when the competition cannot be read, and offers to retry", async () => {
    fetchLeagueReport.mockRejectedValue(new Error("nope"));

    renderPage();

    expect(
      await screen.findByText(/Não foi possível ler esta competição/),
    ).toBeInTheDocument();

    fetchLeagueReport.mockResolvedValue(report());
    fireEvent.click(screen.getByRole("button", { name: /Tentar outra vez/ }));

    expect(await screen.findByText("46 de 100")).toBeInTheDocument();
  });
});
