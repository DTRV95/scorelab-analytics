import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david" }, signOut: vi.fn() }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const board = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("@/hooks/usePlanBoard", () => ({
  usePlanBoard: () => board.value,
}));

import Home from "@/pages/Home";
import { dayLabels } from "@/components/TodayMatches";
import { globalBalance } from "@/lib/globalBalance";
import { homeBoard } from "@/lib/homeBoard";

const RULES = {
  days: 30,
  stakeBands: [{ untilDay: 30, pct: 0.3 }],
  oddsMin: 1.4,
  oddsMax: null,
  onePerDay: true,
  stopAfterLosses: null,
};

function plan(id: string, name: string, ended: string | null): PlanRecord {
  return {
    id,
    name,
    starting_bankroll: 20,
    target: 1000,
    created_by: "david",
    start_date: null,
    days: 30,
    rules: RULES,
    visible: false,
    template_key: "mes",
    ended_at: ended,
    ended_by: ended ? "david" : null,
  };
}

const member = (planId: string): PlanMember => ({
  plan_id: planId,
  user_id: "david",
  display_name: "David",
  starting_bankroll: 20,
});

let counter = 0;
function bet(
  planId: string,
  status: "green" | "red" | "pending",
  market = "1X",
): PlanBet & { planId: string } {
  counter += 1;
  const day = counter;
  return {
    planId,
    id: `b${counter}`,
    userId: "david",
    legs: [
      {
        match: "FC Porto vs Rio Ave",
        homeTeam: "FC Porto",
        awayTeam: "Rio Ave",
        league: "Liga Portugal",
        market,
        odds: 1.45,
        modelProb: 72,
        fixtureId: counter,
        kickoff: null,
        status: status === "pending" ? "pending" : status,
      },
    ],
    odds: 1.9,
    stake: 5,
    day,
    status,
    profitLoss: status === "green" ? 4.5 : status === "red" ? -5 : 0,
    placedAt: `2026-09-${String(day).padStart(2, "0")}T10:00:00.000Z`,
    settledAt:
      status === "pending"
        ? null
        : `2026-09-${String(day).padStart(2, "0")}T20:00:00.000Z`,
  };
}

function setBoard(plans: PlanRecord[], bets: (PlanBet & { planId: string })[]) {
  const members = plans.map((entry) => member(entry.id));
  board.value = {
    board: homeBoard("david", plans, members, bets, []),
    bets,
    plans,
    members,
    allBets: bets,
    funds: [],
    invites: [],
    looseBets: [],
    started: members.reduce(
      (sum, entry) => sum + Number(entry.starting_bankroll),
      0,
    ),
    balance: globalBalance({ userId: "david", plans, members, bets }),
    reload: () => {},
  };
}

beforeEach(() => {
  counter = 0;
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ matches: [] }) })),
  );
});
afterEach(() => cleanup());

const renderHome = () =>
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );

describe("the record on the page the app opens on", () => {
  it("counts the bets of challenges already finished", async () => {
    // Everything these two have played is in challenges that are over, and a
    // home page that reads only the live ones showed a blank card to somebody
    // with a season behind them.
    const over = plan("p1", "Mil euros em 10", "2026-09-30T18:00:00.000Z");
    const running = plan("p2", "Um mês perfeito", null);

    setBoard(
      [over, running],
      [
        bet("p1", "green"),
        bet("p1", "green"),
        bet("p1", "red"),
        bet("p1", "green"),
        bet("p1", "red"),
        bet("p2", "green"),
        bet("p2", "pending"),
      ],
    );

    renderHome();

    expect(
      await screen.findByText("Ganhas os níveis que fechas"),
    ).toBeInTheDocument();
    expect(screen.getByText(/6 apostas fechadas/)).toBeInTheDocument();
  });

  it("sends somebody who wants the whole of it to the analyses", async () => {
    // These lines are the short form of that page: the same bets, by market,
    // by price, by day. Apostas is where a bet outside a challenge gets
    // registered, which is another job entirely.
    setBoard(
      [plan("p2", "Um mês perfeito", null)],
      [
        bet("p2", "green"),
        bet("p2", "red"),
        bet("p2", "green"),
        bet("p2", "green"),
        bet("p2", "red"),
      ],
    );

    renderHome();

    const link = await screen.findByRole("link", { name: /Ver tudo/ });
    expect(link).toHaveAttribute("href", "/dashboard/analises");
  });

  it("says why there is nothing to say, instead of showing nothing", async () => {
    setBoard([plan("p2", "Um mês perfeito", null)], [bet("p2", "green")]);

    renderHome();

    expect(
      await screen.findByText(/ainda não chegam para dizer nada/),
    ).toBeInTheDocument();
  });

  it("speaks to somebody who has not settled a bet yet", async () => {
    setBoard([plan("p2", "Um mês perfeito", null)], [bet("p2", "pending")]);

    renderHome();

    expect(
      await screen.findByText(/Ainda não fechaste nenhuma aposta/),
    ).toBeInTheDocument();
  });
});

describe("the games on the home page", () => {
  /** A fixture on a named day, at a daytime hour: never already kicked off. */
  const match = (
    id: number,
    home: string,
    pct: number,
    daysAhead = 1,
    hour = 12,
  ) => {
    const when = new Date();
    when.setDate(when.getDate() + Math.max(1, daysAhead));
    when.setHours(hour, 0, 0, 0);

    return {
      fixture_id: id,
      league: "Liga Portugal",
      home_name: home,
      away_name: "Rival",
      kickoff: when.toISOString(),
      headline_market: "1X",
      headline_pct: pct,
      lambda_casa: 1.6,
      lambda_fora: 1,
      total_golos_esperados: 2.6,
      amostra_pct: 80,
      amostra_label: "Alta",
      mercados: [],
    };
  };

  const served = (matches: unknown[]) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ matches, unavailable: [], skipped: 0 }),
      })),
    );

  it("shows the three the model is surest about, not the next three to kick off", async () => {
    served([
      match(1, "Quase certo", 91, 1, 18),
      match(2, "Daqui a pouco", 54, 1, 10),
      match(3, "Muito provável", 85, 1, 12),
      match(4, "Provável", 79, 1, 14),
    ]);

    setBoard([plan("p2", "Um mês perfeito", null)], [bet("p2", "green")]);
    renderHome();

    expect(await screen.findByText(/Quase certo/)).toBeInTheDocument();
    expect(screen.getByText(/Muito provável/)).toBeInTheDocument();
    expect(screen.getByText(/Provável/)).toBeInTheDocument();
    // Kicking off first is not the same as being worth backing.
    expect(screen.queryByText(/Daqui a pouco/)).toBeNull();
  });

  it("keeps each day's three behind that day, instead of one list for the week", async () => {
    // Three strongest of the whole week, on a Monday, is three games on
    // Saturday — and nothing at all about today.
    const later = new Date();
    later.setDate(later.getDate() + 2);

    served([
      match(1, "Amanhã", 70, 1, 12),
      match(2, "Noutro dia", 95, 2, 12),
    ]);

    setBoard([plan("p2", "Um mês perfeito", null)], [bet("p2", "green")]);
    renderHome();

    expect(await screen.findByText(/Amanhã vs Rival/)).toBeInTheDocument();
    expect(screen.queryByText(/Noutro dia/)).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: dayLabels(later).short }),
    );

    expect(await screen.findByText(/Noutro dia/)).toBeInTheDocument();
    expect(screen.queryByText(/Amanhã vs Rival/)).toBeNull();
  });

  it("asks for the board itself when nothing has stored one", async () => {
    // Somebody who opens the app and goes no further than Início never saw a
    // game: the stored copy is written by the pages they had not opened.
    const asked = vi.fn(async (input: RequestInfo | URL) => {
      void input;
      return {
        ok: true,
        json: async () => ({ matches: [], unavailable: [], skipped: 0 }),
      };
    });
    vi.stubGlobal("fetch", asked);

    setBoard([plan("p2", "Um mês perfeito", null)], [bet("p2", "green")]);
    renderHome();

    await waitFor(() => expect(asked).toHaveBeenCalled());
    expect(String(asked.mock.calls[0][0])).toContain("/data/probability-board");
  });

  it("leaves the provider alone when the board is already stored", async () => {
    localStorage.setItem(
      "scorelab_probability_board_cache",
      JSON.stringify({
        days: 7,
        fetchedAt: Date.now(),
        matches: [match(9, "Já guardado", 88, 10)],
        unavailable: [],
        skipped: 0,
      }),
    );

    const asked = vi.fn();
    vi.stubGlobal("fetch", asked);

    setBoard([plan("p2", "Um mês perfeito", null)], [bet("p2", "green")]);
    renderHome();

    expect(await screen.findByText(/Já guardado/)).toBeInTheDocument();
    expect(asked).not.toHaveBeenCalled();
  });
});
