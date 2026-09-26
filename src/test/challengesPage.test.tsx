import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";

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
      },
    ]),
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
import { writeCachedBoard } from "@/lib/probabilityBoardCache";

function boardMatch(id: number, home: string, pct: number) {
  return {
    fixture_id: id,
    league: "Liga Portugal",
    home_name: home,
    away_name: "Rival",
    kickoff: "2026-09-26T18:00:00Z",
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
  return render(
    <MemoryRouter>
      <Challenges />
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
    await screen.findByRole("button", { name: /Inserir (os jogos do dia \d+|outro jogo)/ })
  );
}

/** Picks a board game and the market being backed, the way a person would. */
async function pickFromBoard(name: string, market = /Apostar em Vitória Casa/) {
  await openPicker();
  fireEvent.click(await screen.findByText(new RegExp(`${name} vs Rival`)));
  fireEvent.click(screen.getByRole("button", { name: market }));
}

/** Types a game the site does not know into the pop-up. */
async function addByHand(home: string, away: string, market: string, odds: string) {
  await openPicker();
  fireEvent.click(await screen.findByRole("button", { name: /Adicionar um jogo à mão/ }));
  fireEvent.change(screen.getByPlaceholderText("Equipa casa"), { target: { value: home } });
  fireEvent.change(screen.getByPlaceholderText("Equipa fora"), { target: { value: away } });
  fireEvent.change(screen.getByPlaceholderText("A tua aposta (ex: Casa, Mais de 1.5)"), {
    target: { value: market },
  });
  fireEvent.change(screen.getByPlaceholderText("Odd"), { target: { value: odds } });
  fireEvent.click(screen.getByRole("button", { name: /Juntar ao boletim/ }));
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
    expect((await screen.findAllByText("Dia 2")).length).toBeGreaterThan(0);
    expect(screen.getByText("Dia 1")).toBeInTheDocument();
  });

  it("says what to do next, with the stake and the odd already worked out", async () => {
    renderPage();

    // The open day comes first: nothing else can be decided until it closes.
    expect(await screen.findByText("O que fazer agora")).toBeInTheDocument();
    expect(screen.getByText(/Fecha o dia que está aberto/)).toBeInTheDocument();
  });

  it("says out loud what the ladder actually requires", async () => {
    renderPage();

    expect(await screen.findByText(/O que a escada exige/)).toBeInTheDocument();
    expect(screen.getByText(/sequência de vitórias seguidas/)).toBeInTheDocument();
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

    expect(screen.getByText(/Mais de 1.5 Golos · modelo 78%/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Registar o dia 2/ }));

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
    fireEvent.click(screen.getByRole("button", { name: /Registar o dia 2/ }));

    const [, , payload] = savePlanBet.mock.calls[0];
    expect(payload).toMatchObject({ stake: 5 });
    // Staking less than the challenge asks is a choice, not a breach.
    expect(screen.queryByText(/Acima do desafio/)).not.toBeInTheDocument();
  });
});

describe("closing a bet nobody else can close", () => {
  it("offers the owner a way to say how a hand-added game went", async () => {
    renderPage();

    expect(await screen.findByText("Por fechar")).toBeInTheDocument();
    expect(screen.getByText("à espera de ti")).toBeInTheDocument();
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
});

describe("reading the other player's bet", () => {
  it("opens a bet in full from the list, whoever placed it", async () => {
    renderPage();

    // The brother's day 1, which the list can only show as one line.
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do dia 1 de Irmão/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Dia 1 · Irmão")).toBeInTheDocument();
    expect(within(dialog).getByText("Sporting CP vs Arouca")).toBeInTheDocument();
    expect(within(dialog).getByText(/o modelo dava 71%/)).toBeInTheDocument();
    expect(within(dialog).getByText("Perdeu")).toBeInTheDocument();
    expect(within(dialog).getByText("-5,00 €")).toBeInTheDocument();
  });

  it("says which games were typed by hand, since those carry no forecast", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /Ver a aposta do dia 2 de David/ }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Torreense vs Mafra")).toBeInTheDocument();
    expect(
      within(dialog).getByText(/metido à mão, sem previsão do modelo/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/ainda aberta/)).toBeInTheDocument();
  });
});

describe("managing challenges", () => {
  it("asks for the name to be typed before deleting everyone's history", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Regras deste desafio/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apagar este desafio/ }));

    const confirm = screen.getByRole("button", { name: /Apagar de vez/ });
    expect(confirm).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText("Escrever o nome do desafio para confirmar"),
      { target: { value: "Plano Milhão" } }
    );
    fireEvent.click(screen.getByRole("button", { name: /Apagar de vez/ }));

    expect(deletePlan).toHaveBeenCalledWith("plan");
  });

  it("starts another challenge from a ready-made model", async () => {
    renderPage();

    fireEvent.click((await screen.findAllByRole("button", { name: /Criar um desafio/ }))[0]);
    fireEvent.click(screen.getByRole("button", { name: /^Escada de 10 dias$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Criar desafio$/ }));

    expect(createPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Escada de 10 dias",
        days: 10,
        rules: expect.objectContaining({ oddsMin: 1.5, oddsMax: 2.5 }),
      })
    );
  });

  it("changes the terms of a challenge it owns", async () => {
    renderPage();

    const toggle = await screen.findByRole("button", { name: /Regras deste desafio/ });
    fireEvent.click(toggle);

    const card = toggle.closest("section") as HTMLElement;
    const date = card.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(date, { target: { value: "2026-10-05" } });
    fireEvent.click(within(card).getByRole("button", { name: /^Guardar$/ }));

    expect(updatePlanTerms).toHaveBeenCalledWith(
      "plan",
      expect.objectContaining({ name: "Plano Milhão", startDate: "2026-10-05", days: 38 })
    );
  });

  it("invites someone by email and reports what happened", async () => {
    renderPage();

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
