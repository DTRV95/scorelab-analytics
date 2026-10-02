import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import { canonicalMarket } from "@/lib/marketNames";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "david", email: "david@example.com" } }),
}));

// Hoisted: vi.mock's factory runs before the module body, so the spies have to
// exist before it.
const {
  savePlanBet,
  updatePlanBet,
  deletePlanBet,
  addPlanFunds,
  invitePlayer,
  fetchPlanInvites,
  fetchMyPendingInvites,
  acceptInvite,
  createPlan,
  updatePlanTerms,
  deletePlan,
} = vi.hoisted(() => ({
  savePlanBet: vi.fn(async (_planId: string, userId: string, payload: unknown) => ({
    ...(payload as Record<string, unknown>),
    id: "new",
    userId,
  })),
  updatePlanBet: vi.fn(async (_planId: string, _betId: string, _payload: unknown) => undefined),
  deletePlanBet: vi.fn(async (_planId: string, _betId: string) => undefined),
  addPlanFunds: vi.fn(async (_planId: string, userId: string, amount: number, note: string | null) => ({
    id: "f1",
    userId,
    amount,
    note,
    at: "2026-09-29T10:00:00.000Z",
  })),
  invitePlayer: vi.fn(
    async (): Promise<"invited" | "already_member" | "no_account"> => "invited"
  ),
  fetchPlanInvites: vi.fn(async () => [] as unknown[]),
  fetchMyPendingInvites: vi.fn(async () => [] as unknown[]),
  acceptInvite: vi.fn(async () => undefined),
  createPlan: vi.fn(async () => "new-plan"),
  updatePlanTerms: vi.fn(async () => undefined),
  deletePlan: vi.fn(async (_planId: string) => undefined),
}));

function leg(overrides: Record<string, unknown> = {}) {
  return {
    match: "FC Porto vs SL Benfica",
    homeTeam: "FC Porto",
    awayTeam: "SL Benfica",
    league: "Liga Portugal",
    market: "Casa",
    odds: 2,
    modelProb: 60,
    fixtureId: 1,
    kickoff: null,
    status: "green" as const,
    ...overrides,
  };
}

vi.mock("@/lib/planStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore"
  );
  return {
    ...actual,
    fetchPlans: vi.fn(async () => [
      {
        id: "plan",
        name: "Plano Milhão",
        starting_bankroll: 10,
        target: 1000000,
        created_by: "david",
        start_date: null,
        days: 38,
        rules: MILLION_PLAN_RULES,
        visible: false,
        template_key: "milhao",
      },
    ]),
    fetchPlanBetCounts: vi.fn(async () => ({ plan: 4, empty: 0 })),
    fetchPlanFunds: vi.fn(async () => []),
    addPlanFunds,
    fetchPlanMembers: vi.fn(async () => [
      { plan_id: "plan", user_id: "david", display_name: "David", starting_bankroll: 10 },
      { plan_id: "plan", user_id: "irmao", display_name: "Irmão", starting_bankroll: 10 },
    ]),
    fetchPlanBets: vi.fn(async () => [
      {
        id: "b1",
        userId: "david",
        legs: [leg()],
        odds: 2,
        stake: 5,
        day: 1,
        status: "green" as const,
        profitLoss: 5,
        placedAt: "2026-09-21T10:00:00.000Z",
        settledAt: "2026-09-21T20:00:00.000Z",
      },
      {
        id: "b2",
        userId: "irmao",
        legs: [
          leg({
            match: "Sporting CP vs Arouca",
            homeTeam: "Sporting CP",
            awayTeam: "Arouca",
            odds: 1.8,
            modelProb: 71,
            fixtureId: 2,
            status: "red" as const,
          }),
        ],
        odds: 1.8,
        stake: 5,
        day: 1,
        status: "red" as const,
        profitLoss: -5,
        placedAt: "2026-09-21T10:00:00.000Z",
        settledAt: "2026-09-21T20:00:00.000Z",
      },
      {
        // A day of two games, still open: the one the picker works on.
        id: "b4",
        userId: "david",
        legs: [
          leg({
            match: "FC Porto vs Casa Pia",
            homeTeam: "FC Porto",
            awayTeam: "Casa Pia",
            odds: 1.5,
            fixtureId: null,
            status: "pending" as const,
          }),
          leg({
            match: "Sporting CP vs Arouca",
            homeTeam: "Sporting CP",
            awayTeam: "Arouca",
            odds: 1.6,
            fixtureId: null,
            status: "pending" as const,
          }),
        ],
        odds: 2.4,
        stake: 9,
        day: 3,
        status: "pending" as const,
        profitLoss: 0,
        placedAt: "2026-09-23T11:00:00.000Z",
        settledAt: null,
      },
      {
        // A game the site never heard of: nothing can close this but David.
        id: "b3",
        userId: "david",
        legs: [
          leg({
            match: "Torreense vs Mafra",
            homeTeam: "Torreense",
            awayTeam: "Mafra",
            league: "Adicionado à mão",
            market: "Casa",
            odds: 1.9,
            modelProb: 0,
            fixtureId: null,
            status: "pending" as const,
          }),
        ],
        odds: 1.9,
        stake: 7.5,
        day: 2,
        status: "pending" as const,
        profitLoss: 0,
        placedAt: "2026-09-23T10:00:00.000Z",
        settledAt: null,
      },
    ]),
    savePlanBet,
    updatePlanBet,
    deletePlanBet,
    invitePlayer,
    fetchPlanInvites,
    fetchMyPendingInvites,
    acceptInvite,
    createPlan,
    updatePlanTerms,
    deletePlan,
  };
});

import Challenges from "@/pages/Challenges";
import { Toaster } from "@/components/ui/toaster";
import {
  fetchPlanBets,
  fetchPlans,
  type PlanBetPayload,
} from "@/lib/planStore";
import { writeCachedBoard } from "@/lib/probabilityBoardCache";

function boardMatch(
  id: number,
  home: string,
  pct: number,
  league = "Liga Portugal",
  kickoff = "2026-09-26T18:00:00Z",
) {
  return {
    fixture_id: id,
    league,
    home_name: home,
    away_name: "Rival",
    kickoff,
    headline_market: "Casa",
    headline_pct: pct,
    amostra_pct: 80,
    amostra_label: "Alta",
    lambda_casa: 1.8,
    lambda_fora: 1.0,
    total_golos_esperados: 2.8,
    mercados: [
      { mercado: "Casa", grupo: "Resultado", probabilidade_pct: pct, min_pct: pct - 5, max_pct: pct + 5 },
      {
        mercado: "Mais de 1.5 Golos",
        grupo: "Golos",
        probabilidade_pct: 78,
        min_pct: 73,
        max_pct: 83,
      },
    ],
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  invitePlayer.mockResolvedValue("invited");
  fetchPlanInvites.mockResolvedValue([]);
  fetchMyPendingInvites.mockResolvedValue([]);
  writeCachedBoard({
    days: 7,
    matches: Array.from({ length: 12 }, (_, i) => boardMatch(100 + i, `Equipa ${i}`, 50 + i)),
    unavailable: [],
    skipped: 0,
  });
});

afterEach(() => {
  cleanup();
});

function renderPage() {
  // The app mounts the Toaster in App.tsx, so a page rendered without it can
  // fire a toast that nothing ever shows — which is the state this page was
  // in until now.
  return render(
    <MemoryRouter>
      <Challenges />
      <Toaster />
    </MemoryRouter>
  );
}

/**
 * Opens the pop-up the games are inserted from.
 *
 * Empty, the slip has no card of its own and the way in is the button on the
 * card at the top of the page; once a game is in, the slip has its own.
 */
async function openPicker() {
  fireEvent.click(
    await screen.findByRole("button", { name: /Inserir (os jogos do nível \d+|outro jogo)/ })
  );
}

/** Picks a board game and the market being backed, the way a person would. */
async function pickFromBoard(name: string, market = /Apostar em Vitória Casa/) {
  await openPicker();
  fireEvent.click(await screen.findByText(new RegExp(`${name} vs Rival`)));
  fireEvent.click(screen.getByRole("button", { name: market }));
  closePicker();
}

/** The pop-up now stays open after a game goes in, so leaving it is a step. */
function closePicker() {
  const done = screen.queryByRole("button", { name: /Concluído/ });
  if (done) fireEvent.click(done);
}

/** Types a game the site does not know into the pop-up. */
async function addByHand(home: string, away: string, market: string, odds: string) {
  await openPicker();
  fireEvent.click(await screen.findByRole("button", { name: /Adicionar um jogo à mão/ }));
  fireEvent.change(screen.getByPlaceholderText("Equipa casa"), { target: { value: home } });
  fireEvent.change(screen.getByPlaceholderText("Equipa fora"), { target: { value: away } });
  fireEvent.change(screen.getByLabelText("A tua aposta"), {
    target: { value: market },
  });
  fireEvent.change(screen.getByPlaceholderText("Odd"), { target: { value: odds } });
  fireEvent.click(screen.getByRole("button", { name: /Juntar ao boletim/ }));
  closePicker();
}

describe("a challenge's standings", () => {
  it("shows both players' bankrolls and the combined total", async () => {
    renderPage();

    // David won day 1: €10 + €5. His brother lost his: €10 - €5. The pending
    // bet has not moved anything yet.
    expect((await screen.findAllByText("David")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("15,00 €").length).toBeGreaterThan(0);
    expect(screen.getByText("20,00 €")).toBeInTheDocument();
  });

  it("puts each player on the day their money reaches", async () => {
    renderPage();

    // David won €5 onto €10: €15 is where day 2 opens. His open bet has not
    // moved anything, so it has not moved his day either. His brother lost his
    // first day and is back under the opening rung.
    // Both appear more than once now: on the player's own card, and again on
    // the head-to-head row that puts the two ladders side by side.
    expect((await screen.findAllByText("Nível 2")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Nível 1").length).toBeGreaterThan(0);
  });

  it("says what to do next, with the stake and the odd already worked out", async () => {
    renderPage();

    // The open day comes first: nothing else can be decided until it closes.
    expect(await screen.findByText("O que fazer agora")).toBeInTheDocument();
    expect(screen.getByText(/Fecha o nível que está aberto/)).toBeInTheDocument();
  });

  it("says out loud what the ladder actually requires", async () => {
    renderPage();

    // The odds of the whole run, beside the ladder itself rather than in a
    // card of their own: a schedule that is really a parlay has to say so.
    expect(await screen.findByText(/Chegar do nível \d+ ao fim/)).toBeInTheDocument();
    expect(screen.getByText(/1 em/)).toBeInTheDocument();
    expect(screen.getByText(/Perder hoje deixa-te em/)).toBeInTheDocument();
  });
});

describe("building the day's bet", () => {
  it("takes a game from the board and the market being backed", async () => {
    renderPage();
    await pickFromBoard("Equipa 11");

    expect(screen.getByLabelText("Odd de Equipa 11 vs Rival")).toBeInTheDocument();
    expect(screen.getByText(/modelo 61%/)).toBeInTheDocument();
  });

  it("backs a market other than the headline one", async () => {
    renderPage();
    await pickFromBoard("Equipa 11", /Apostar em Mais de 1.5 Golos/);

    // The line wraps instead of being cut, so the market and the model's
    // call are spans of their own.
    expect(screen.getByText("Mais de 1.5 Golos")).toBeInTheDocument();
    expect(screen.getByText("· modelo 78%")).toBeInTheDocument();
  });

  it("goes looking for new games when asked, without waiting for the cache", async () => {
    // A competition can go missing for a minute: the provider allows ten
    // requests a minute and the board asks for eight. Nobody should have to
    // wait out a cache to find out whether it came back.
    const fetched: string[] = [];
    const original = global.fetch;
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      fetched.push(String(url));
      return {
        ok: true,
        json: async () => ({ matches: [], unavailable: [], skipped: 0 }),
      } as Response;
    });

    try {
      renderPage();
      await openPicker();
      fireEvent.click(
        await screen.findByRole("button", { name: /Procurar jogos novos/ }),
      );

      expect(
        fetched.some((url) => url.includes("/data/probability-board")),
      ).toBe(true);
    } finally {
      global.fetch = original;
    }
  });

  it("shows every competition on the board, not just the best-ranked games", async () => {
    // Twelve Portuguese games score higher than the single Dutch one, which is
    // how a whole competition used to sit on the board and never once reach
    // the screen — indistinguishable from the provider not sending it.
    writeCachedBoard({
      days: 7,
      matches: [
        ...Array.from({ length: 12 }, (_, i) =>
          boardMatch(100 + i, `Equipa ${i}`, 70 + i),
        ),
        boardMatch(300, "Ajax", 41, "Eredivisie"),
      ],
      unavailable: [],
      skipped: 0,
    });

    renderPage();
    await openPicker();

    fireEvent.click(
      await screen.findByRole("button", { name: "Eredivisie, 1 jogo" }),
    );

    expect(screen.getByText(/Ajax vs Rival/)).toBeInTheDocument();
    expect(screen.queryByText(/Equipa 0 vs Rival/)).not.toBeInTheDocument();
  });

  it("names the national-team competitions the board now covers", async () => {
    // Every bet placed in this app so far was on a national side or a small
    // league, and the board was eight domestic club leagues — so nothing
    // anybody actually backed was ever on it.
    renderPage();
    await openPicker();

    for (const league of ["Campeonato da Europa", "Liga dos Campeões"]) {
      expect(
        await screen.findByRole("button", { name: `${league}, 0 jogos` }),
      ).toBeInTheDocument();
    }
  });

  it("says a competition has nothing rather than leaving it out", async () => {
    renderPage();
    await openPicker();

    expect(
      await screen.findByRole("button", { name: "Eredivisie, 0 jogos" }),
    ).toBeDisabled();
  });

  it("finds a game further down the board by name", async () => {
    renderPage();
    await openPicker();

    fireEvent.change(await screen.findByPlaceholderText("Procurar equipa ou liga..."), {
      target: { value: "Equipa 2" },
    });
    fireEvent.click(screen.getByText(/Equipa 2 vs Rival/));
    fireEvent.click(screen.getByRole("button", { name: /Apostar em Vitória Casa/ }));

    expect(screen.getByLabelText("Odd de Equipa 2 vs Rival")).toBeInTheDocument();
  });

  it("takes a game the site never heard of", async () => {
    renderPage();
    await addByHand("Torreense", "Mafra", "Casa", "1.85");

    expect(screen.getByLabelText("Odd de Torreense vs Mafra")).toBeInTheDocument();
    expect(screen.getAllByText(/· à mão/).length).toBeGreaterThan(0);
  });

  it("stays open after a game goes in, ready for the next one", async () => {
    // Every game these two have ever bet was typed in here by hand, two or
    // three at a time. Closing after each one meant reopening the pop-up for
    // every single game of every single bet.
    renderPage();
    await openPicker();
    fireEvent.click(
      await screen.findByRole("button", { name: /Adicionar um jogo à mão/ }),
    );
    fireEvent.change(screen.getByPlaceholderText("Equipa casa"), {
      target: { value: "Bélgica" },
    });
    fireEvent.change(screen.getByPlaceholderText("Equipa fora"), {
      target: { value: "França" },
    });
    fireEvent.change(screen.getByLabelText("A tua aposta"), {
      target: { value: "Mais de 2.5" },
    });
    fireEvent.change(screen.getByPlaceholderText("Odd"), {
      target: { value: "1.85" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Juntar ao boletim/ }));

    // Still open, the form empty and waiting, and the slip counted.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Equipa casa")).toHaveValue("");
    expect(screen.getByText("1 jogo no boletim")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Equipa casa"), {
      target: { value: "Noruega" },
    });
    fireEvent.change(screen.getByPlaceholderText("Equipa fora"), {
      target: { value: "Portugal" },
    });
    fireEvent.change(screen.getByLabelText("A tua aposta"), {
      target: { value: "Ambas Marcam" },
    });
    fireEvent.change(screen.getByPlaceholderText("Odd"), {
      target: { value: "1.38" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Juntar ao boletim/ }));

    expect(screen.getByText("2 jogos no boletim")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Concluído/ }));
    expect(screen.getByLabelText("Odd de Noruega vs Portugal")).toBeInTheDocument();
  });

  it("multiplies the odds of every game picked, whatever their source", async () => {
    renderPage();
    await pickFromBoard("Equipa 11");
    fireEvent.change(screen.getByLabelText("Odd de Equipa 11 vs Rival"), {
      target: { value: "1.30" },
    });

    await addByHand("Torreense", "Mafra", "Casa", "1.50");

    // 1.30 × 1.50: two short prices making the challenge's line between them.
    // Read from the slip, since 1.95 is also one of the table's own odds.
    const slip = screen.getByText("Odd total").closest("div")!.parentElement!;
    expect(within(slip).getByText("1.95")).toBeInTheDocument();
    expect(screen.getByText("2 jogos multiplicados")).toBeInTheDocument();
  });

  it("stakes the challenge's share of the real bankroll", async () => {
    renderPage();
    await pickFromBoard("Equipa 11");

    // Day 3 is a 50% day, and David has €15.
    expect((screen.getByLabelText("Valor a apostar") as HTMLInputElement).value).toBe(
      "7.50"
    );
  });

  it("warns when the combined odd falls outside what the challenge allows", async () => {
    renderPage();
    await pickFromBoard("Equipa 11");
    fireEvent.change(screen.getByLabelText("Odd de Equipa 11 vs Rival"), {
      target: { value: "3.40" },
    });

    expect(await screen.findByText(/acima do máximo de 2.10/)).toBeInTheDocument();
  });

  it("registers the day with the games, the odd and the stake", async () => {
    renderPage();
    await pickFromBoard("Equipa 11");
    fireEvent.change(screen.getByLabelText("Odd de Equipa 11 vs Rival"), {
      target: { value: "1.85" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registar o nível 2/ }));

    expect(savePlanBet).toHaveBeenCalledTimes(1);
    const [, userId, payload] = savePlanBet.mock.calls[0];
    expect(userId).toBe("david");
    expect(payload).toMatchObject({ stake: 7.5, odds: 1.85, day: 2, status: "pending" });
    expect((payload as { legs: { fixtureId: number | null }[] }).legs[0].fixtureId).toBe(111);
  });

  it("keeps a stake the person typed over the one the challenge suggests", async () => {
    renderPage();
    await pickFromBoard("Equipa 11");
    fireEvent.change(screen.getByLabelText("Odd de Equipa 11 vs Rival"), {
      target: { value: "1.85" },
    });
    fireEvent.change(screen.getByLabelText("Valor a apostar"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Registar o nível 2/ }));

    const [, , payload] = savePlanBet.mock.calls[0];
    expect(payload).toMatchObject({ stake: 5 });
    // Staking less than the challenge asks is a choice, not a breach.
    expect(screen.queryByText(/Acima do desafio/)).not.toBeInTheDocument();
  });
});

describe("the two of them side by side", () => {
  async function openDuel() {
    renderPage();
    // It lives behind a row of its own now, like the bettor analysis, instead
    // of taking up the page.
    fireEvent.click(
      await screen.findByRole("button", { name: /Frente a frente/ }),
    );
    return screen.findByRole("dialog");
  }

  it("puts the players against each other, measure by measure", async () => {
    const dialog = await openDuel();

    expect(within(dialog).getByText("Lucro das apostas")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Por cada euro apostado"),
    ).toBeInTheDocument();
  });

  it("refuses to crown anybody off a handful of days", async () => {
    // Two settled days can put somebody ahead on every row at once.
    const dialog = await openDuel();

    expect(
      within(dialog).getByText(/poucos níveis fechados para isto dizer/),
    ).toBeInTheDocument();
  });

  it("paints a loss red, whoever it belongs to", async () => {
    const dialog = await openDuel();

    // The brother lost his day 1: €5 gone. Leading a row where both are down
    // is not something to paint green.
    const loss = within(dialog).getByText("-5,00 €");
    expect(loss.className).toContain("text-destructive");
  });
});

describe("money put into the bankroll", () => {
  it("records it, and says it stays out of the profit", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Meti ou tirei dinheiro/ }),
    );
    fireEvent.change(screen.getByLabelText("Valor a meter ou tirar da banca"), {
      target: { value: "50" },
    });
    fireEvent.change(screen.getByLabelText("Nota sobre o movimento"), {
      target: { value: "depósito" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ }));

    await waitFor(() => expect(addPlanFunds).toHaveBeenCalledTimes(1));
    expect(addPlanFunds.mock.calls[0].slice(2)).toEqual([50, "depósito"]);
  });

  it("stores taking money out as a negative amount", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Meti ou tirei dinheiro/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Tirei dinheiro/ }));
    fireEvent.change(screen.getByLabelText("Valor a meter ou tirar da banca"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ }));

    await waitFor(() => expect(addPlanFunds).toHaveBeenCalledTimes(1));
    expect(addPlanFunds.mock.calls[0][2]).toBe(-4);
  });

  it("will not save nothing", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Meti ou tirei dinheiro/ }),
    );

    expect(screen.getByRole("button", { name: /^Guardar$/ })).toBeDisabled();
  });
});

describe("telling the person what happened", () => {
  it("confirms the day that was just registered", async () => {
    renderPage();
    await pickFromBoard("Equipa 0");
    fireEvent.change(screen.getByLabelText("Odd de Equipa 0 vs Rival"), {
      target: { value: "1.95" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registar o nível 2/ }));

    // The most consequential action in the app used to land in silence.
    //
    // Waiting on the content and not on the title: the toast store is a module
    // singleton that survives between tests, and an earlier test leaves one
    // with this very title behind — so matching the title alone resolves on
    // the stale toast before this one is even rendered.
    await waitFor(() => {
      const shown = [...document.querySelectorAll("li")].find((node) =>
        node.textContent?.includes("Nível 2 registado"),
      );
      expect(shown).toHaveTextContent("1 jogo @ 1.95");
    });
  });

  it("says a failed save failed, instead of a line under the whole page", async () => {
    savePlanBet.mockRejectedValueOnce(new Error("offline"));

    renderPage();
    await pickFromBoard("Equipa 0");
    fireEvent.change(screen.getByLabelText("Odd de Equipa 0 vs Rival"), {
      target: { value: "1.95" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Registar o nível 2/ }));

    expect(
      await screen.findByText("A aposta não ficou guardada. Tenta outra vez."),
    ).toBeInTheDocument();
  });
});

describe("what the person's own record says, while they build the bet", () => {
  it("brings the record of a market into the slip being built", async () => {
    // Four decided legs on "Casa", three of them landed. The app knew this
    // and only ever said it on a page nobody opens while deciding.
    const past = (id: string, status: "green" | "red") => ({
      id,
      userId: "david",
      legs: [
        leg({ market: "Casa", status }),
        leg({ market: "Casa", status }),
      ],
      odds: 1.9,
      stake: 5,
      day: 1,
      status,
      profitLoss: status === "green" ? 4.5 : -5,
      placedAt: "2026-09-20T10:00:00.000Z",
      settledAt: "2026-09-20T20:00:00.000Z",
    });
    vi.mocked(fetchPlanBets).mockResolvedValueOnce([
      past("p1", "green"),
      past("p2", "green"),
    ] as never);

    renderPage();
    await pickFromBoard("Equipa 0");

    expect(await screen.findByText("O teu registo")).toBeInTheDocument();
    expect(
      screen.getByText("Vitória Casa: entraram 4 de 4 que fizeste."),
    ).toBeInTheDocument();
  });

  it("says nothing before there is a record to speak from", async () => {
    vi.mocked(fetchPlanBets).mockResolvedValueOnce([]);

    renderPage();
    await pickFromBoard("Equipa 0");

    expect(screen.queryByText("O teu registo")).not.toBeInTheDocument();
  });
});

// Every market on every bet so far was typed into a blank box: "V1" and
// "Casa" for the same bet, "AM" and "Ambas Marcam", two spellings of "X2 e
// +1,5 golos". And the same side went in as "Gales" and "País de Gales".
// Every market on every bet so far was typed into a blank box, and it shows:
// "V1" and "Casa" for the same bet, "AM" and "Ambas Marcam", two spellings of
// "X2 e +1,5 golos". And the same side went in as "Gales" and "País de Gales".
// Ranked by the model's confidence, a game on Sunday sat above one kicking
// off in an hour, and nothing on screen said why.
describe("the order the games come in", () => {
  it("puts them in the order they are played, soonest first", async () => {
    const today = new Date();
    const at = (days: number, hour: number) => {
      const when = new Date(today);
      when.setDate(when.getDate() + days);
      when.setHours(hour, 0, 0, 0);
      return when.toISOString();
    };

    writeCachedBoard({
      days: 7,
      matches: [
        // Written worst-first on purpose: the model's number must not decide
        // this, and the most confident game here is the one furthest away.
        boardMatch(1, "Amanhã cedo", 60, "Liga Portugal", at(1, 11)),
        boardMatch(2, "Depois de amanhã", 95, "Liga Portugal", at(2, 15)),
        boardMatch(3, "Hoje tarde", 55, "Liga Portugal", at(0, 21)),
        boardMatch(4, "Hoje cedo", 50, "Liga Portugal", at(0, 14)),
      ],
      unavailable: [],
      skipped: 0,
    });

    renderPage();
    await openPicker();

    // The picker opens on the day being played, soonest kickoff first.
    const openingDay = (await screen.findAllByText(/vs Rival/)).map(
      (node) => node.textContent,
    );
    expect(openingDay).toEqual(["Hoje cedo vs Rival", "Hoje tarde vs Rival"]);

    // And every day at once is still in the order they are played.
    fireEvent.click(screen.getByRole("button", { name: /^Todos 4$/ }));

    const all = screen.getAllByText(/vs Rival/).map((node) => node.textContent);
    expect(all).toEqual([
      "Hoje cedo vs Rival",
      "Hoje tarde vs Rival",
      "Amanhã cedo vs Rival",
      "Depois de amanhã vs Rival",
    ]);
  });

  it("says which day each run of games belongs to", async () => {
    const today = new Date();
    const at = (days: number, hour: number) => {
      const when = new Date(today);
      when.setDate(when.getDate() + days);
      when.setHours(hour, 0, 0, 0);
      return when.toISOString();
    };

    writeCachedBoard({
      days: 7,
      matches: [
        boardMatch(1, "Hoje", 50, "Liga Portugal", at(0, 14)),
        boardMatch(2, "Amanhã", 50, "Liga Portugal", at(1, 14)),
      ],
      unavailable: [],
      skipped: 0,
    });

    renderPage();
    await openPicker();

    // One tab per day, each saying how many games it holds.
    expect(
      await screen.findByRole("button", { name: /^Hoje 1$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Amanhã 1$/ })).toBeInTheDocument();

    // A day chosen is grouped by competition instead; every day at once keeps
    // the day headings.
    expect(screen.getByText("Liga Portugal")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Todos 2$/ }));
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByText("Amanhã")).toBeInTheDocument();
  });
});

describe("writing the market and the teams", () => {
  it("offers names it has seen before, without a wall of buttons", async () => {
    // A row of buttons for every market lived here and was asked to go: above
    // a form somebody is filling in, it reads as a quiz. The list stays out of
    // the way until they start typing.
    renderPage();
    await openPicker();
    fireEvent.click(
      await screen.findByRole("button", { name: /Adicionar um jogo à mão/ }),
    );

    const market = screen.getByLabelText("A tua aposta");
    const listId = market.getAttribute("list");
    expect(listId).toBeTruthy();

    const offered = [
      ...document.querySelectorAll(`#${CSS.escape(listId as string)} option`),
    ].map((option) => option.getAttribute("value"));

    expect(offered).toContain("Casa");
    expect(offered).toContain("Mais de 2.5 Golos");
    expect(screen.queryByRole("button", { name: "Vitória Casa" })).toBeNull();
  });

  it("registers whatever was written, folded to the name the analysis counts", async () => {
    renderPage();
    await addByHand("Bélgica", "França", "V1", "1.85");

    fireEvent.click(
      await screen.findByRole("button", { name: /Registar o nível/ }),
    );

    const [, , payload] = savePlanBet.mock.calls[0] as [
      string,
      string,
      PlanBetPayload,
    ];
    // Stored exactly as typed — the record of what somebody wrote stays as it
    // is, and the folding happens on the way out, when it is counted.
    expect(payload.legs[0]).toMatchObject({ market: "V1" });
    expect(canonicalMarket(payload.legs[0].market)).toBe("Casa");
  });

  it("offers back the teams already written on these slips", async () => {
    renderPage();
    await openPicker();
    fireEvent.click(
      await screen.findByRole("button", { name: /Adicionar um jogo à mão/ }),
    );

    const home = screen.getByPlaceholderText("Equipa casa");
    expect(home).toHaveAttribute("list", "sl-equipas");

    const offered = [
      ...document.querySelectorAll("#sl-equipas option"),
    ].map((option) => option.getAttribute("value"));

    // Off the bets the page already loaded, both players' and both sides.
    expect(offered).toContain("Torreense");
    expect(offered).toContain("Mafra");
    expect(offered).toContain("Sporting CP");
  });
});

describe("saying whether the bet is worth making", () => {
  it("compares the model with the odd typed, before it is registered", async () => {
    renderPage();
    await pickFromBoard("Equipa 0");

    fireEvent.change(screen.getByLabelText("Odd de Equipa 0 vs Rival"), {
      target: { value: "1.50" },
    });

    // The board gives Equipa 0 a 50% headline; 1.50 pays for 66.7%.
    expect(await screen.findByText("Sem valor")).toBeInTheDocument();
    expect(screen.getByText(/só dá 50%/)).toBeInTheDocument();
  });

  it("says so when the price is better than the model's chance", async () => {
    renderPage();
    await pickFromBoard("Equipa 0");

    fireEvent.change(screen.getByLabelText("Odd de Equipa 0 vs Rival"), {
      target: { value: "2.50" },
    });

    expect(await screen.findByText("Tem valor")).toBeInTheDocument();
  });

  it("admits it cannot judge a game the model never saw", async () => {
    renderPage();
    await addByHand("Torreense", "Mafra", "Casa", "1.85");

    expect(
      await screen.findByText(/não tem previsão do modelo/),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sem valor")).not.toBeInTheDocument();
  });
});

describe("closing a bet nobody else can close", () => {
  it("offers the owner a way to say how a hand-added game went", async () => {
    renderPage();

    expect(await screen.findByText("Por fechar")).toBeInTheDocument();
    expect(screen.getAllByText("à espera de ti").length).toBeGreaterThan(0);
  });

  it("pays out the day when it is marked as won", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Entrou/ }));

    expect(updatePlanBet).toHaveBeenCalledTimes(1);
    const [planId, betId, payload] = updatePlanBet.mock.calls[0];
    expect(planId).toBe("plan");
    expect(betId).toBe("b3");
    // €7.50 at 1.90 returns €6.75 of profit.
    expect(payload).toMatchObject({ status: "green", profitLoss: 6.75 });
  });

  it("takes the stake when it is marked as lost", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Falhou/ }));

    const [, , payload] = updatePlanBet.mock.calls[0];
    expect(payload).toMatchObject({ status: "red", profitLoss: -7.5 });
  });

  it("asks which games fell on a day made of several, and settles the rest as landed", async () => {
    // A multiple goes down because a game fell; the others came in. Naming the
    // ones that failed is the whole of what is left to say.
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Perdi o nível/ }));
    expect(screen.getByText("Quais é que falharam?")).toBeInTheDocument();

    const save = screen.getByRole("button", { name: /Guardar o nível perdido/ });
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Sporting CP vs Arouca/ }));
    fireEvent.click(save);

    const [, betId, payload] = updatePlanBet.mock.calls[0];
    expect(betId).toBe("b4");
    expect(payload).toMatchObject({ status: "red", profitLoss: -9 });
    expect(
      (payload as { legs: { status: string }[] }).legs.map((leg) => leg.status),
    ).toEqual(["green", "red"]);
  });
});

describe("reading the other player's bet", () => {
  it("opens a bet in full from the list, whoever placed it", async () => {
    renderPage();

    // The brother's day 1, which the list can only show as one line.
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do nível 1 de Irmão/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Nível 1 · Irmão")).toBeInTheDocument();
    expect(within(dialog).getByText("Sporting CP vs Arouca")).toBeInTheDocument();
    expect(within(dialog).getByText(/o modelo dava 71%/)).toBeInTheDocument();
    expect(within(dialog).getByText("Perdeu")).toBeInTheDocument();
    expect(within(dialog).getByText("-5,00 €")).toBeInTheDocument();
  });

  it("says which games were typed by hand, since those carry no forecast", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do nível 2 de David/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Torreense vs Mafra")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/metido à mão, sem previsão do modelo/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/ainda aberta/)).toBeInTheDocument();
  });
});

describe("correcting a bet that was typed wrong", () => {
  async function openMine() {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do nível 2 de David/ }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Corrigir esta aposta/ }),
    );
    return dialog;
  }

  it("saves a fixed odd, and the day's money with it", async () => {
    const dialog = await openMine();

    fireEvent.change(
      within(dialog).getByLabelText("Odd de Torreense vs Mafra"),
      { target: { value: "2.10" } },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Guardar correção/ }),
    );

    const [planId, betId, payload] = updatePlanBet.mock.calls[0];
    expect(planId).toBe("plan");
    expect(betId).toBe("b3");
    expect(payload).toMatchObject({ odds: 2.1 });
  });

  it("saves a fixed stake", async () => {
    const dialog = await openMine();

    fireEvent.change(within(dialog).getByLabelText("Valor apostado"), {
      target: { value: "12" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Guardar correção/ }),
    );

    const [, , payload] = updatePlanBet.mock.calls[0];
    expect(payload).toMatchObject({ stake: 12 });
  });

  it("asks before taking a bet off both players' records", async () => {
    const dialog = await openMine();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Apagar esta aposta/ }),
    );
    expect(deletePlanBet).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: /Apagar mesmo/ }));

    expect(deletePlanBet).toHaveBeenCalledWith("plan", "b3");
  });

  it("leaves the other player's bet alone", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do nível 1 de Irmão/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /Corrigir esta aposta/ }),
    ).not.toBeInTheDocument();
  });

  it("turns a day closed the wrong way round", async () => {
    renderPage();
    // Day 1 is behind the fold: the list shows the last two days by default.
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver todos os níveis/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do nível 1 de David/ }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Afinal perdeu/ }));

    const [, betId, payload] = updatePlanBet.mock.calls[0];
    expect(betId).toBe("b1");
    expect(payload).toMatchObject({ status: "red", profitLoss: -5 });
  });

  // Taking a game out was possible from the start. Putting one in meant
  // deleting the bet and typing the whole slip again, for one forgotten game.
  it("puts another game into a day still open, and multiplies it in", async () => {
    const dialog = await openMine();

    fireEvent.click(
      within(dialog).getByRole("button", { name: /Adicionar jogo/ }),
    );

    const picker = await screen.findByRole("dialog", {
      name: /Juntar ao nível 2/,
    });
    fireEvent.click(
      within(picker).getByRole("button", { name: /Adicionar um jogo à mão/ }),
    );
    fireEvent.change(within(picker).getByPlaceholderText("Equipa casa"), {
      target: { value: "Braga" },
    });
    fireEvent.change(within(picker).getByPlaceholderText("Equipa fora"), {
      target: { value: "Estoril" },
    });
    fireEvent.change(within(picker).getByLabelText("A tua aposta"), {
      target: { value: "Casa" },
    });
    fireEvent.change(within(picker).getByPlaceholderText("Odd"), {
      target: { value: "1.50" },
    });
    fireEvent.click(
      within(picker).getByRole("button", { name: /Juntar ao boletim/ }),
    );
    fireEvent.click(within(picker).getByRole("button", { name: /Concluído/ }));

    fireEvent.click(
      await within(dialog).findByRole("button", { name: /Guardar correção/ }),
    );

    const [, betId, payload] = updatePlanBet.mock.calls[0] as [
      string,
      string,
      PlanBetPayload,
    ];
    expect(betId).toBe("b3");
    expect(payload.legs).toHaveLength(2);
    expect(payload.legs[1]).toMatchObject({
      homeTeam: "Braga",
      awayTeam: "Estoril",
      market: "Casa",
      odds: 1.5,
      status: "pending",
    });
    // 1.90 and 1.50, multiplied, as any bookmaker would.
    expect(payload.odds).toBeCloseTo(2.85, 5);
  });

  it("will not put a game into a day already closed", async () => {
    // The arithmetic is done and the games have results. A new one would
    // arrive undecided on a bet that is not, and there is no honest answer
    // to what that day then won.
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver todos os níveis/ }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do nível 1 de David/ }),
    );

    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Corrigir esta aposta/ }),
    );

    expect(
      within(dialog).queryByRole("button", { name: /Adicionar jogo/ }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByText(/enquanto o nível estiver em aberto/),
    ).toBeInTheDocument();
  });
});

describe("managing challenges", () => {
  it("tells two challenges of the same name apart by what is in them", async () => {
    // Two made from the same model are identical on screen — same name, same
    // bankroll, same target, same dates. Deleting the wrong one costs
    // somebody their history, so the chips say how many bets each holds.
    const twin = {
      id: "empty",
      name: "Plano Milhão",
      starting_bankroll: 10,
      target: 1000000,
      created_by: "david",
      start_date: null,
      days: 38,
      rules: MILLION_PLAN_RULES,
      visible: false,
      template_key: "milhao",
    };
    vi.mocked(fetchPlans).mockResolvedValueOnce([
      { ...twin, id: "plan" },
      twin,
    ]);

    renderPage();

    const chips = await screen.findAllByRole("button", { name: /Plano Milhão/ });
    expect(chips.map((chip) => chip.textContent)).toEqual([
      "Plano Milhão4",
      "Plano Milhão0",
    ]);
  });

  it("offers deleting the challenge from the top of the page", async () => {
    renderPage();

    // Rare and destructive, so it is a small control up in the header rather
    // than a card in everybody's way — but visible the moment the page opens,
    // which is the thing it was missing.
    expect(
      await screen.findByRole("button", { name: /Apagar este desafio/ }),
    ).toBeInTheDocument();
  });

  it("says how many bets go with the challenge before it is deleted", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Apagar este desafio/ }),
    );

    expect(
      within(await screen.findByRole("dialog")).getByText(/4 apostas/),
    ).toBeInTheDocument();
  });

  it("asks straight out, and takes no for an answer", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Apagar este desafio/ }),
    );
    const dialog = await screen.findByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: /^Não$/ }));
    expect(deletePlan).not.toHaveBeenCalled();
  });

  it("deletes on yes", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Apagar este desafio/ }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Sim$/ }));

    expect(deletePlan).toHaveBeenCalledWith("plan");
  });

  it("offers the way into this challenge's analysis, and no other's", async () => {
    // It used to point at a page that read whichever challenge the account
    // joined first, so opening it from a challenge nobody else is in showed
    // another one's bets, and the other player's with them.
    renderPage();

    const link = await screen.findByRole("link", {
      name: /Abrir análise de apostador/,
    });
    expect(link).toHaveAttribute("href", "/desafios/plan/analise");
  });

  it("starts another challenge from a ready-made model", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /Novo desafio/ }))[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Dobrar a banca$/ }));

    // The template carries its own verdict, computed from its stake and odds.
    expect(within(dialog).getByText(/Matematicamente viável/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Criar desafio$/ }));

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Dobrar a banca",
        days: 14,
        rules: expect.objectContaining({
          oddsMin: 1.85,
          stakeBands: [{ untilDay: null, pct: 0.08 }],
        }),
      })
    );
  });

  it("moves the target with the starting bankroll", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /Novo desafio/ }))[0]);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /^Dobrar a banca$/ }));

    // The model is 20 € → 40 €. Starting with 200 € has to mean 400 €, or the
    // challenge opens already finished.
    fireEvent.change(within(dialog).getByDisplayValue("20"), {
      target: { value: "200" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Criar desafio$/ }));

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({ startingBankroll: 200, target: 400 }),
    );
  });

  it("puts measured stars on each model", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /Novo desafio/ }))[0]);
    const dialog = await screen.findByRole("dialog");

    // The list opens on the Plano Milhão, which no simulation ever finishes.
    expect(
      within(dialog).getByText(/Nunca se acabou em nenhuma simulação/),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /^Sprint de 7$/ }));
    expect(
      within(dialog).getByText(/de cada 100 tentativas/),
    ).toBeInTheDocument();
  });

  it("changes the terms of a challenge it owns", async () => {
    renderPage();

    // The rules moved up beside the other rare actions, and open in a pop-up.
    fireEvent.click(
      await screen.findByRole("button", { name: /Regras deste desafio/ }),
    );

    const dialog = await screen.findByRole("dialog");
    const date = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(date, { target: { value: "2026-10-05" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Guardar$/ }));

    expect(updatePlanTerms).toHaveBeenCalledWith(
      "plan",
      expect.objectContaining({ name: "Plano Milhão", startDate: "2026-10-05", days: 38 })
    );
  });

  it("invites someone by email and reports what happened", async () => {
    renderPage();

    // Behind the small control at the top right now, not a card on the page.
    fireEvent.click(
      await screen.findByRole("button", { name: /Convidar alguém/ }),
    );

    // The form is folded away until someone wants it: inviting happens once.
    fireEvent.click(await screen.findByRole("button", { name: /Convidar alguém/ }));
    fireEvent.change(screen.getByPlaceholderText("irmao@exemplo.com"), {
      target: { value: " agenciacristina@hotmail.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Convidar$/ }));

    expect(invitePlayer).toHaveBeenCalledWith("plan", "agenciacristina@hotmail.com");
    expect(await screen.findByText(/Convite enviado/)).toBeInTheDocument();
  });

  it("offers an invitation to accept or refuse", async () => {
    fetchMyPendingInvites.mockResolvedValue([
      {
        plan_id: "outro-plano",
        plan_name: "Desafio dos amigos",
        invited_by_name: "David",
        created_at: "2026-09-25T10:00:00.000Z",
      },
    ]);
    renderPage();

    expect(
      await screen.findByText(/David convidou-te para o Desafio dos amigos/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Aceitar$/ }));
    expect(acceptInvite).toHaveBeenCalledWith("outro-plano");
  });
});
