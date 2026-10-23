import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ChallengeBets } from "@/components/ChallengeBets";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

/**
 * A coluna de cada jogador, quando o desafio já vai longe.
 *
 * Esta secção existe para comparar os dois lado a lado. Com trinta
 * níveis feitos, a coluna do primeiro empurrava a do segundo para um
 * ecrã e meio abaixo — e deixava de comparar coisa nenhuma.
 */

const plan: PlanRecord = {
  id: "p1",
  name: "Desafio",
  starting_bankroll: 100,
  target: 200,
  created_by: "eu",
  start_date: null,
  days: 30,
  rules: null,
  visible: false,
  template_key: null,
  ended_at: null,
  ended_by: null,
};

const members: PlanMember[] = [
  { plan_id: "p1", user_id: "eu", display_name: "David", starting_bankroll: 100 },
  { plan_id: "p1", user_id: "ele", display_name: "Valdemar", starting_bankroll: 100 },
];

const aposta = (userId: string, day: number): PlanBet => ({
  id: `${userId}-${day}`,
  userId,
  day,
  odds: 2,
  stake: 5,
  status: "green",
  profitLoss: 5,
  placedAt: new Date(2026, 0, day).toISOString(),
  settledAt: new Date(2026, 0, day).toISOString(),
  legs: [
    {
      match: `Jogo ${day}`,
      homeTeam: "A",
      awayTeam: "B",
      league: "Liga",
      market: "1X",
      odds: 2,
      modelProb: 0,
      fixtureId: null,
      kickoff: null,
      status: "green",
    },
  ],
});

const comNiveis = (quantos: number) =>
  Array.from({ length: quantos }, (_, i) => aposta("eu", i + 1));

function montar(bets: PlanBet[]) {
  render(
    <ChallengeBets
      plan={plan}
      members={members}
      bets={bets}
      me="eu"
      onOpen={vi.fn()}
    />,
  );
}

const linhas = () =>
  screen.queryAllByRole("button", { name: /Ver e corrigir a aposta/ });

afterEach(() => cleanup());

describe("ChallengeBets", () => {
  it("mostra só as quatro primeiras de cada um", () => {
    montar(comNiveis(9));

    expect(linhas()).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: /Mostrar mais 5 apostas/ }),
    ).toBeInTheDocument();
  });

  it("abre o resto a um toque, e volta a fechar", () => {
    montar(comNiveis(9));
    const mais = screen.getByRole("button", { name: /Mostrar mais 5/ });

    fireEvent.click(mais);
    expect(linhas()).toHaveLength(9);

    fireEvent.click(screen.getByRole("button", { name: /Mostrar menos/ }));
    expect(linhas()).toHaveLength(4);
  });

  it("não pede para mostrar mais quando não há mais", () => {
    montar(comNiveis(4));

    expect(linhas()).toHaveLength(4);
    expect(screen.queryByRole("button", { name: /Mostrar mais/ })).toBeNull();
  });

  it("conta no singular quando falta uma só", () => {
    montar(comNiveis(5));

    expect(
      screen.getByRole("button", { name: /Mostrar mais 1 aposta$/ }),
    ).toBeInTheDocument();
  });

  it("corta cada jogador por si, e não a lista toda", () => {
    // Seis de um e duas do outro: quem tem duas mostra as duas, e não
    // fica escondido por o outro ter enchido o limite.
    montar([
      ...comNiveis(6),
      aposta("ele", 1),
      aposta("ele", 2),
    ]);

    expect(linhas()).toHaveLength(6);
    expect(
      screen.getAllByRole("button", { name: /Mostrar mais/ }),
    ).toHaveLength(1);
  });
});
