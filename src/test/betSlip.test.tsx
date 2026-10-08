import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { BoardMatch } from "@/lib/probabilityBoardCache";
import { BetComposer } from "@/components/BetComposer";

vi.mock("@/hooks/useLeagueRates", () => ({
  useLeagueRates: () => new Map(),
}));

function match(overrides: Partial<BoardMatch> = {}): BoardMatch {
  return {
    fixture_id: 11,
    league: "Liga Portugal",
    home_name: "FC Porto",
    away_name: "Rio Ave",
    kickoff: new Date(Date.now() + 3600_000).toISOString(),
    headline_market: "1X",
    headline_pct: 88,
    lambda_casa: 1.8,
    lambda_fora: 0.9,
    total_golos_esperados: 2.7,
    amostra_pct: 80,
    amostra_label: "Alta",
    mercados: [
      { mercado: "1X", probabilidade_pct: 88 },
      { mercado: "Mais de 1.5 Golos", probabilidade_pct: 74 },
    ],
    ...overrides,
  } as BoardMatch;
}

function composer({
  board,
  openSignal,
  onPlace = () => {},
}: {
  board: BoardMatch[];
  openSignal: number;
  onPlace?: (legs: unknown[], odds: number, stake: number) => void;
}) {
  return (
    <BetComposer
      access={{
        board,
        boardAt: Date.now(),
        boardLoading: false,
        skipped: 0,
        unavailable: [],
        usedFixtures: new Set<number>(),
        onRefreshBoard: () => {},
      }}
      memory={{ markets: [], teams: [] }}
      rules={MILLION_PLAN_RULES}
      day={3}
      bankroll={10}
      betsToday={0}
      lossStreak={0}
      openBets={0}
      style={null}
      openSignal={openSignal}
      targetOdds={1.9}
      plannedStake={5}
      saving={false}
      onPlace={onPlace}
    />
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("registering a bet from the games pop-up", () => {
  it("puts the game on the slip with one tap, on the market the model likes", async () => {
    const view = render(composer({ board: [match()], openSignal: 0 }));
    view.rerender(composer({ board: [match()], openSignal: 1 }));

    fireEvent.click(
      screen.getByLabelText("Juntar FC Porto vs Rio Ave em Casa ou Empate (1X)"),
    );

    // On the slip, inside the pop-up, with its price waiting to be typed.
    expect(
      await screen.findByLabelText("Odd de FC Porto vs Rio Ave"),
    ).toBeInTheDocument();
  });

  it("registers the bet without the pop-up being closed first", async () => {
    const onPlace = vi.fn();
    const view = render(
      composer({ board: [match()], openSignal: 0, onPlace }),
    );
    view.rerender(composer({ board: [match()], openSignal: 1, onPlace }));

    fireEvent.click(
      screen.getByLabelText("Juntar FC Porto vs Rio Ave em Casa ou Empate (1X)"),
    );
    fireEvent.change(await screen.findByLabelText("Odd de FC Porto vs Rio Ave"), {
      target: { value: "1.85" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registar o nível 3/ }));

    expect(onPlace).toHaveBeenCalledTimes(1);
    const [legs, odds, stake] = onPlace.mock.calls[0];
    expect(legs).toHaveLength(1);
    expect(legs[0]).toMatchObject({
      match: "FC Porto vs Rio Ave",
      market: "1X",
      odds: 1.85,
      modelProb: 88,
      status: "pending",
    });
    expect(odds).toBeCloseTo(1.85);
    // The amount the table asks for, which is what the field started on.
    expect(stake).toBe(5);
  });

  it("shuts the pop-up once the bet is in, instead of leaving it over the page", async () => {
    const view = render(composer({ board: [match()], openSignal: 0 }));
    view.rerender(composer({ board: [match()], openSignal: 1 }));

    fireEvent.click(
      screen.getByLabelText("Juntar FC Porto vs Rio Ave em Casa ou Empate (1X)"),
    );
    fireEvent.change(await screen.findByLabelText("Odd de FC Porto vs Rio Ave"), {
      target: { value: "1.85" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registar o nível 3/ }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the other markets one tap away, without repeating the one on the row", async () => {
    const view = render(composer({ board: [match()], openSignal: 0 }));
    view.rerender(composer({ board: [match()], openSignal: 1 }));

    fireEvent.click(
      screen.getByLabelText("Outros mercados de FC Porto vs Rio Ave"),
    );

    expect(
      await screen.findByLabelText("Apostar em Mais de 1.5 Golos"),
    ).toBeInTheDocument();
    // The headline market is already the tap on the game itself.
    expect(screen.queryByLabelText("Apostar em Casa ou Empate (1X)")).toBeNull();
  });

  it("does not show the slip twice while the pop-up is holding it", async () => {
    const view = render(composer({ board: [match()], openSignal: 0 }));
    view.rerender(composer({ board: [match()], openSignal: 1 }));

    fireEvent.click(
      screen.getByLabelText("Juntar FC Porto vs Rio Ave em Casa ou Empate (1X)"),
    );

    // One odd field and one amount field, not one of each in both places.
    expect(
      await screen.findAllByLabelText("Odd de FC Porto vs Rio Ave"),
    ).toHaveLength(1);
    expect(screen.getAllByLabelText("Valor a apostar")).toHaveLength(1);
  });
});
