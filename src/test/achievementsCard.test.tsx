import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Achievements } from "@/components/Achievements";
import { seenAchievements } from "@/lib/achievementsSeen";
import type { PlanBet } from "@/lib/planStore";

function bet(id: string): PlanBet {
  return {
    id,
    userId: "me",
    legs: [
      {
        match: "FC Porto vs Casa Pia",
        homeTeam: "FC Porto",
        awayTeam: "Casa Pia",
        league: "Liga Portugal",
        market: "1X",
        odds: 1.35,
        modelProb: 82,
        fixtureId: 1,
        kickoff: null,
        status: "green",
      },
    ],
    odds: 1.35,
    stake: 5,
    day: 1,
    status: "green",
    profitLoss: 1.75,
    placedAt: "2026-10-01T18:00:00.000Z",
    settledAt: "2026-10-01T22:00:00.000Z",
  } as PlanBet;
}

const dozen = Array.from({ length: 12 }, (_, i) => bet(`b${i}`));

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("o cartão das conquistas", () => {
  it("brilha uma vez e depois cala-se", async () => {
    const view = render(
      <Achievements bets={dozen} level={0} userId="me" />,
    );

    // Primeira vez: diz o que foi ganho, e marca-o como visto.
    expect(screen.getAllByText("novo").length).toBeGreaterThan(0);
    // O brilho fica um instante antes de ser dado como visto, para não se
    // apagar no mesmo frame em que aparece.
    await waitFor(
      () => expect(seenAchievements("me")).toContain("dez-decididas"),
      { timeout: 3000 },
    );

    // Segunda: é uma medalha como as outras.
    view.unmount();
    render(<Achievements bets={dozen} level={0} userId="me" />);
    expect(screen.queryByText("novo")).toBeNull();
    expect(screen.getByText("Dez decididas")).toBeInTheDocument();
  });

  it("não aparece a quem ainda não ganhou nada", () => {
    render(<Achievements bets={[]} level={0} userId="me" />);

    expect(screen.queryByText(/Conquistas/i)).toBeNull();
  });

  it("aponta a seguinte com o que falta", () => {
    render(<Achievements bets={dozen} level={11} userId="me" />);

    expect(screen.getByText(/A seguir: Nível vinte/)).toBeInTheDocument();
    expect(screen.getByText("11/20")).toBeInTheDocument();
  });

  it("a marca de visto é de cada conta, não do browser", async () => {
    render(<Achievements bets={dozen} level={0} userId="david" />);
    await waitFor(
      () => expect(seenAchievements("david").length).toBeGreaterThan(0),
      { timeout: 3000 },
    );

    expect(seenAchievements("vilagreen")).toEqual([]);
  });
});
