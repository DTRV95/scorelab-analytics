import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GamePicker, type PickedGame } from "@/components/GamePicker";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

vi.mock("@/hooks/useLeagueRates", () => ({
  useLeagueRates: () => new Map(),
}));

afterEach(cleanup);

/** Amanhã às 20:00, para a linha não entrar em "já começou". */
function amanha(): string {
  const quando = new Date();
  quando.setDate(quando.getDate() + 1);
  quando.setHours(20, 0, 0, 0);
  return quando.toISOString();
}

const jogo: BoardMatch = {
  fixture_id: 11,
  league: "Liga Portugal",
  home_name: "FC Porto",
  away_name: "Rio Ave",
  kickoff: amanha(),
  headline_market: "Casa",
  headline_pct: 71,
  lambda_casa: 1.8,
  lambda_fora: 0.9,
  total_golos_esperados: 2.7,
  amostra_pct: 80,
  amostra_label: "Alta",
  mercados: [
    {
      mercado: "Casa",
      grupo: "Resultado",
      probabilidade_pct: 71,
      min_pct: 65,
      max_pct: 77,
    },
  ],
};

function abrir({
  usedFixtures = new Set<number>(),
  chosenIds = new Set<number>(),
  onPick = () => undefined,
}: {
  usedFixtures?: Set<number>;
  chosenIds?: Set<number>;
  onPick?: (game: PickedGame) => void;
} = {}) {
  return render(
    <GamePicker
      open
      onOpenChange={() => undefined}
      access={{
        board: [jogo],
        boardAt: Date.now(),
        boardLoading: false,
        skipped: 0,
        unavailable: [],
        usedFixtures,
        onRefreshBoard: () => undefined,
      }}
      memory={{ markets: [], teams: [] }}
      chosenIds={chosenIds}
      onPick={onPick}
    />,
  );
}

const linhaDoJogo = () =>
  screen.getByRole("button", { name: /Juntar FC Porto vs Rio Ave/ });

describe("um jogo em que já se apostou", () => {
  it("continua a poder ser escolhido, e diz que já lá houve uma", () => {
    // Apostar outra vez no mesmo jogo — noutro dia, noutro mercado — é uma
    // escolha legítima. A lista dizia-o fechando a porta: o jogo aparecia
    // apagado, com um visto, e não havia como lá voltar.
    const escolhido = vi.fn();
    abrir({ usedFixtures: new Set([11]), onPick: escolhido });

    expect(screen.getByText("Já apostaste neste")).toBeInTheDocument();
    expect(linhaDoJogo()).not.toBeDisabled();

    fireEvent.click(linhaDoJogo());

    expect(escolhido).toHaveBeenCalledWith(
      expect.objectContaining({ fixtureId: 11, market: "Casa" }),
    );
  });

  it("mantém os outros mercados abertos", () => {
    abrir({ usedFixtures: new Set([11]) });

    expect(
      screen.getByRole("button", { name: /Outros mercados de FC Porto/ }),
    ).toBeInTheDocument();
  });

  it("mas o mesmo jogo duas vezes no mesmo boletim continua fechado", () => {
    // Isto é outra coisa: duas pernas do mesmo jogo no mesmo boletim não é
    // uma aposta que exista, e as duas partilhariam a mesma chave na lista.
    abrir({ chosenIds: new Set([11]) });

    expect(linhaDoJogo()).toBeDisabled();
    expect(screen.queryByText("Já apostaste neste")).toBeNull();
  });
});
