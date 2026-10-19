import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";

vi.mock("@/components/GamePicker", () => ({
  GamePicker: ({ open }: { open: boolean }) =>
    open ? <div>pop-up dos jogos</div> : null,
}));

vi.mock("@/hooks/useLeagueRates", () => ({
  useLeagueRates: () => new Map(),
}));

import { BetComposer } from "@/components/BetComposer";

const composer = (openSignal: number) => (
  <BetComposer
    access={{
      board: [],
      boardAt: null,
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
    onPlace={() => {}}
  />
);

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("when the games pop-up is allowed to open by itself", () => {
  it("stays shut on a card that has just appeared", () => {
    // Changing challenge takes this card down and puts a new one up, with a
    // signal that was already bumped in the challenge left behind. The pop-up
    // used to open on its own in front of somebody who asked for nothing.
    render(composer(4));

    expect(screen.queryByText("pop-up dos jogos")).toBeNull();
  });

  it("opens when the card at the top of the page asks for it", () => {
    const view = render(composer(4));

    view.rerender(composer(5));

    expect(screen.getByText("pop-up dos jogos")).toBeInTheDocument();
  });

  it("opens again on the next ask", () => {
    const view = render(composer(0));
    view.rerender(composer(1));
    expect(screen.getByText("pop-up dos jogos")).toBeInTheDocument();

    view.rerender(composer(2));
    expect(screen.getByText("pop-up dos jogos")).toBeInTheDocument();
  });
});
