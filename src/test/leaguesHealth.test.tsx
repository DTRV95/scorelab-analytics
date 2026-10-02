import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { LeagueHealth } from "@/lib/leagueReport";

const { fetchLeaguesHealth } = vi.hoisted(() => ({
  fetchLeaguesHealth: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@/lib/leagueReport", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leagueReport")>(
    "@/lib/leagueReport",
  );
  return { ...actual, fetchLeaguesHealth };
});

import { LeaguesHealth } from "@/components/LeaguesHealth";

const row = (overrides: Partial<LeagueHealth>): LeagueHealth => ({
  league: "Liga Portugal",
  code: "PPL",
  state: "lida",
  detail: null,
  played: 94,
  upcoming: 10,
  next_kickoff: "2026-10-18T18:00:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchLeaguesHealth.mockResolvedValue([
    row({}),
    row({ league: "Serie A", code: "SA", state: "por-ler", played: null, upcoming: null }),
    row({
      league: "Championship",
      code: "ELC",
      state: "falhou",
      detail: "A chave da fonte de dados foi recusada.",
      played: null,
      upcoming: null,
    }),
  ]);
});
afterEach(() => cleanup());

describe("whether the data is actually arriving", () => {
  it("says what each competition is giving, in games", async () => {
    render(<LeaguesHealth />);

    expect(await screen.findByText("Liga Portugal")).toBeInTheDocument();
    expect(
      screen.getByText("94 jogos disputados · 10 por jogar"),
    ).toBeInTheDocument();
  });

  it("repeats the provider's own words for one that failed", async () => {
    render(<LeaguesHealth />);

    expect(
      await screen.findByText("A chave da fonte de dados foi recusada."),
    ).toBeInTheDocument();
    expect(screen.getByText("não respondeu")).toBeInTheDocument();
  });

  it("does not call a competition nobody has needed yet broken", async () => {
    render(<LeaguesHealth />);

    await screen.findByText("Serie A");
    expect(
      screen.getByText("o motor só a vai buscar quando precisar dela"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/não quer dizer avariada/),
    ).toBeInTheDocument();
  });

  it("costs nothing to open, and only spends when asked", async () => {
    render(<LeaguesHealth />);
    await screen.findByText("Liga Portugal");

    // Opening asks for what the server already holds.
    expect(fetchLeaguesHealth).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByRole("button", { name: /Verificar a 1 que falta|Verificar as 1 que faltam/ }));

    expect(fetchLeaguesHealth).toHaveBeenLastCalledWith(true);
  });

  it("offers nothing to check when everything has been read", async () => {
    fetchLeaguesHealth.mockResolvedValue([row({})]);

    render(<LeaguesHealth />);

    expect(
      await screen.findByText(/Todas as competições já foram lidas/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Verificar/ })).toBeNull();
  });

  it("says so when the engine itself does not answer", async () => {
    fetchLeaguesHealth.mockRejectedValue(new Error("nope"));

    render(<LeaguesHealth />);

    expect(await screen.findByText(/O motor não respondeu/)).toBeInTheDocument();
  });
});
