import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { PlanMember, PlanRecord } from "@/lib/planStore";

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const navegou = vi.hoisted(() => vi.fn());
vi.mock("react-router-dom", async () => {
  const real =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...real, useNavigate: () => navegou };
});

vi.mock("@/lib/boardResults", async () => {
  const real =
    await vi.importActual<typeof import("@/lib/boardResults")>(
      "@/lib/boardResults",
    );
  return { ...real, fetchResultsSnapshot: vi.fn(async () => null) };
});

const quadro = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/hooks/usePlanBoard", () => ({
  useMaybePlanBoard: () => quadro.value,
}));

import ProbabilityRadar from "@/pages/ProbabilityRadar";
import { draftSlip, resetDraftSlip } from "@/hooks/useDraftSlip";
import { forgetLeagueRates } from "@/hooks/useLeagueRates";
import { forgetPrefill } from "@/components/MatchForm";
import { homeBoard } from "@/lib/homeBoard";

function amanha(hora: number) {
  const quando = new Date();
  quando.setDate(quando.getDate() + 1);
  quando.setHours(hora, 0, 0, 0);
  return quando.toISOString();
}

const jogo = {
  fixture_id: 1,
  league: "Liga Portugal",
  home_name: "Porto",
  away_name: "Nacional",
  kickoff: amanha(18),
  headline_market: "Casa",
  headline_pct: 78.4,
  amostra_pct: 90,
  amostra_label: "Alta",
  lambda_casa: 2.4,
  lambda_fora: 0.6,
  total_golos_esperados: 3,
  mercados: [
    {
      mercado: "Casa",
      grupo: "Resultado",
      probabilidade_pct: 78.4,
      min_pct: 70,
      max_pct: 85,
    },
  ],
};

const plan = (id: string, name: string): PlanRecord => ({
  id,
  name,
  starting_bankroll: 10,
  target: 1000000,
  created_by: "david",
  start_date: null,
  days: 38,
  rules: MILLION_PLAN_RULES,
  visible: false,
  template_key: "milhao",
  ended_at: null,
  ended_by: null,
});

const member = (planId: string): PlanMember => ({
  plan_id: planId,
  user_id: "david",
  display_name: "David",
  starting_bankroll: 10,
});

function comDesafios(...plans: PlanRecord[]) {
  quadro.value = {
    board: homeBoard(
      "david",
      plans,
      plans.map((entry) => member(entry.id)),
      [],
      [],
    ),
  };
}

/** Abre a linha do jogo e carrega no mercado. */
async function escolherOMercado() {
  const linha = await screen.findByText("Porto vs Nacional");
  fireEvent.click(linha.closest("button")!);
  fireEvent.click(
    await screen.findByRole("button", { name: "Juntar Vitória Casa ao boletim" }),
  );
}

beforeEach(() => {
  localStorage.clear();
  resetDraftSlip();
  navegou.mockReset();
  forgetLeagueRates();
  forgetPrefill();
  vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/data/status")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response);
    }
    if (url.includes("/data/probability-board")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ matches: [jogo], unavailable: [], skipped: 0 }),
      } as Response);
    }
    if (url.includes("/data/league-rates")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ leagues: [] }),
      } as Response);
    }
    return Promise.reject(new Error(`pedido inesperado: ${url}`));
  });
  comDesafios(plan("p1", "Plano Milhão"));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("juntar um jogo do quadro ao desafio", () => {
  it("põe o jogo no boletim sem sair da página", async () => {
    // Isto levava para a página do desafio. Levar para lá resolve um jogo
    // e estraga dois: para pôr o segundo era preciso voltar atrás e
    // reencontrar o sítio na lista.
    render(
      <MemoryRouter>
        <ProbabilityRadar />
      </MemoryRouter>,
    );

    await escolherOMercado();

    expect(draftSlip.read().planId).toBe("p1");
    expect(draftSlip.read().legs).toHaveLength(1);
    expect(draftSlip.read().legs[0]).toMatchObject({
      fixtureId: 1,
      market: "Casa",
      modelProb: 78.4,
      homeTeam: "Porto",
    });
    expect(navegou).not.toHaveBeenCalled();
  });

  it("com um desafio só, não faz uma pergunta de resposta única", async () => {
    render(
      <MemoryRouter>
        <ProbabilityRadar />
      </MemoryRouter>,
    );

    await escolherOMercado();

    expect(screen.queryByText("Para que desafio?")).toBeNull();
  });

  it("com mais do que um, pergunta qual antes de pôr", async () => {
    comDesafios(plan("p1", "Plano Milhão"), plan("p2", "Dez mil em 20"));
    render(
      <MemoryRouter>
        <ProbabilityRadar />
      </MemoryRouter>,
    );

    await escolherOMercado();

    // Nada foi decidido ainda: pôr dinheiro no desafio errado é pior do
    // que uma pergunta a mais.
    expect(draftSlip.read().legs).toHaveLength(0);
    expect(screen.getByText("Para que desafio?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Dez mil em 20"));

    expect(draftSlip.read().planId).toBe("p2");
    expect(draftSlip.read().legs).toHaveLength(1);
  });

  it("depois do primeiro jogo já não pergunta: o boletim tem dono", async () => {
    comDesafios(plan("p1", "Plano Milhão"), plan("p2", "Dez mil em 20"));
    draftSlip.add("p2", {
      fixtureId: 99,
      homeTeam: "Benfica",
      awayTeam: "Braga",
      league: "Liga Portugal",
      market: "Casa",
      modelProb: 60,
      kickoff: null,
      odds: "",
    });

    render(
      <MemoryRouter>
        <ProbabilityRadar />
      </MemoryRouter>,
    );

    await escolherOMercado();

    expect(screen.queryByText("Para que desafio?")).toBeNull();
    expect(draftSlip.read().legs.map((leg) => leg.fixtureId)).toEqual([99, 1]);
  });
});
