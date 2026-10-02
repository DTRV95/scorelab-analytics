import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { buildPlayerStyle } from "@/lib/bettingStyle";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { LeagueRates } from "@/lib/leagueReport";
import type { PlanBet, PlanLeg } from "@/lib/planStore";
import type { PickedGame } from "@/components/GamePicker";

const { fetchLeagueRates } = vi.hoisted(() => ({
  fetchLeagueRates: vi.fn(async () => [] as unknown[]),
}));

vi.mock("@/lib/leagueReport", async () => {
  const actual = await vi.importActual<typeof import("@/lib/leagueReport")>(
    "@/lib/leagueReport",
  );
  return { ...actual, fetchLeagueRates };
});

// The picker is a pop-up of its own with a board behind it; here it only has
// to hand the slip the game somebody chose.
let pick: ((game: PickedGame) => void) | null = null;
vi.mock("@/components/GamePicker", () => ({
  GamePicker: ({ onPick }: { onPick: (game: PickedGame) => void }) => {
    pick = onPick;
    return null;
  },
}));

import { BetComposer } from "@/components/BetComposer";
import { forgetLeagueRates } from "@/hooks/useLeagueRates";

const rates: LeagueRates[] = [
  {
    league: "Liga Portugal",
    played: 94,
    markets: [
      { mercado: "Casa", grupo: "Resultado", jogos: 42, pct: 44.7 },
      { mercado: "Mais de 2.5 Golos", grupo: "Golos", jogos: 48, pct: 51.1 },
    ],
  },
];

const leg = (market: string): PlanLeg => ({
  match: "Casa vs Fora",
  homeTeam: "Casa",
  awayTeam: "Fora",
  league: "Adicionado à mão",
  market,
  odds: 1.5,
  modelProb: 0,
  fixtureId: null,
  kickoff: null,
  status: "green",
});

const won = (market: string): PlanBet => ({
  id: `b${Math.random()}`,
  userId: "david",
  legs: [leg(market)],
  odds: 1.5,
  stake: 5,
  day: 1,
  status: "green",
  profitLoss: 2.5,
  placedAt: "2026-09-20T10:00:00.000Z",
  settledAt: "2026-09-20T20:00:00.000Z",
});

const game = (overrides: Partial<PickedGame> = {}): PickedGame => ({
  fixtureId: 1,
  homeTeam: "FC Porto",
  awayTeam: "Rio Ave",
  league: "Liga Portugal",
  market: "Mais de 2.5 Golos",
  modelProb: 0,
  kickoff: null,
  odds: "",
  ...overrides,
});

const renderComposer = (style = null as ReturnType<typeof buildPlayerStyle> | null) =>
  render(
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
      day={1}
      bankroll={10}
      betsToday={0}
      lossStreak={0}
      openBets={0}
      style={style}
      targetOdds={1.5}
      plannedStake={5}
      saving={false}
      onPlace={() => {}}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  forgetLeagueRates();
  pick = null;
  fetchLeagueRates.mockResolvedValue(rates);
});
afterEach(() => cleanup());

describe("what the slip says about the price being taken", () => {
  it("puts the competition's rate next to what the odd demands", async () => {
    renderComposer();
    act(() => pick!(game()));

    fireEvent.change(screen.getByLabelText("Odd de FC Porto vs Rio Ave"), {
      target: { value: "1.47" },
    });

    // 1.47 has to come in 68 times in 100; the league gives 51.
    expect(await screen.findByText("51%")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("48 de 94")).toBeInTheDocument();
  });

  it("asks for the competitions once, not once per game", async () => {
    renderComposer();
    act(() => pick!(game()));
    act(() => pick!(game({ fixtureId: 2, homeTeam: "Sporting CP" })));

    expect(fetchLeagueRates).toHaveBeenCalledTimes(1);
  });

  it("says nothing about a competition nobody covers", async () => {
    renderComposer();
    act(() =>
      pick!(game({ fixtureId: null, league: "Adicionado à mão", homeTeam: "Kerry" })),
    );

    fireEvent.change(screen.getByLabelText("Odd de Kerry vs Rio Ave"), {
      target: { value: "1.47" },
    });

    expect(screen.queryByText("a liga dá")).toBeNull();
  });

  it("falls back to this person's own record on the market", async () => {
    // Six of six on the market, and the game is one the provider never saw —
    // which is every game these two have ever bet.
    const style = buildPlayerStyle(
      "david",
      "David",
      Array.from({ length: 6 }, () => won("Mais de 2.5 Golos")),
    );

    renderComposer(style);
    act(() =>
      pick!(game({ fixtureId: null, league: "Adicionado à mão", homeTeam: "KTP" })),
    );

    fireEvent.change(screen.getByLabelText("Odd de KTP vs Rio Ave"), {
      target: { value: "1.47" },
    });

    expect(await screen.findByText("tu acertas")).toBeInTheDocument();
    expect(screen.getByText("6 de 6")).toBeInTheDocument();
  });

  it("says nothing at all until there is a price to judge", () => {
    renderComposer();
    act(() => pick!(game()));

    expect(screen.queryByText("a odd pede")).toBeNull();
  });
});
