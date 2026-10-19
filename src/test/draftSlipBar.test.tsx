import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type { PlanBet, PlanMember, PlanRecord } from "@/lib/planStore";

vi.mock("@/contexts/AuthContext", () => ({
  useMaybeAuth: () => ({ user: { id: "david" } }),
}));

const guardada = vi.hoisted(() => vi.fn());
vi.mock("@/lib/planStore", async () => {
  const real = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore",
  );
  return { ...real, savePlanBet: guardada };
});

const quadro = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/hooks/usePlanBoard", () => ({
  useMaybePlanBoard: () => quadro.value,
}));

import { DraftSlipBar } from "@/components/DraftSlipBar";
import { draftSlip, resetDraftSlip } from "@/hooks/useDraftSlip";
import { homeBoard } from "@/lib/homeBoard";

const plan: PlanRecord = {
  id: "p1",
  name: "Plano Milhão",
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
};

const member: PlanMember = {
  plan_id: "p1",
  user_id: "david",
  display_name: "David",
  starting_bankroll: 10,
};

/** Uma banca de 15 €, que no Plano Milhão é o nível 2 e pede 7,50 €. */
const ganho: PlanBet & { planId: string } = {
  planId: "p1",
  id: "b1",
  userId: "david",
  legs: [],
  odds: 2,
  stake: 5,
  day: 1,
  status: "green",
  profitLoss: 5,
  placedAt: "2026-10-17T10:00:00.000Z",
  settledAt: "2026-10-17T20:00:00.000Z",
};

const jogo = (fixtureId: number, homeTeam: string, awayTeam: string) => ({
  fixtureId,
  homeTeam,
  awayTeam,
  league: "Liga Portugal",
  market: "Casa",
  modelProb: 71,
  kickoff: "2026-10-20T19:00:00Z",
  odds: "",
});

beforeEach(() => {
  guardada.mockReset();
  guardada.mockResolvedValue({});
  resetDraftSlip();
  quadro.value = {
    board: homeBoard("david", [plan], [member], [ganho], []),
  };
});

afterEach(cleanup);

describe("o boletim que anda com a pessoa", () => {
  it("não ocupa espaço nenhum enquanto estiver vazio", () => {
    const { container } = render(<DraftSlipBar />);

    expect(container).toBeEmptyDOMElement();
  });

  it("diz de que desafio é e em que nível está", () => {
    draftSlip.add("p1", jogo(1, "FC Porto", "Rio Ave"));
    render(<DraftSlipBar />);

    expect(screen.getByText("Plano Milhão · Nível 2")).toBeInTheDocument();
  });

  it("não deixa registar enquanto faltar um preço", () => {
    // Um boletim sem odd não é uma aposta, e o botão não pode fingir que é.
    draftSlip.add("p1", jogo(1, "FC Porto", "Rio Ave"));
    render(<DraftSlipBar />);

    expect(screen.getByRole("button", { name: "Registar" })).toBeDisabled();
    expect(screen.getByText(/falta o preço/)).toBeInTheDocument();
  });

  it("regista a aposta sem sair da página, com o nível e o valor do nível", () => {
    // O que isto substitui: carregar no mercado levava para a página do
    // desafio e deixava a pessoa lá, a meio de uma lista que já não via.
    draftSlip.add("p1", jogo(1, "FC Porto", "Rio Ave"));
    draftSlip.add("p1", jogo(2, "Benfica", "Braga"));
    render(<DraftSlipBar />);

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.change(screen.getByLabelText("Odd de FC Porto vs Rio Ave"), {
      target: { value: "1,85" },
    });
    fireEvent.change(screen.getByLabelText("Odd de Benfica vs Braga"), {
      target: { value: "2,00" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Registar" }));

    return waitFor(() => {
      expect(guardada).toHaveBeenCalledTimes(1);
      const [planId, userId, payload] = guardada.mock.calls[0];
      expect(planId).toBe("p1");
      expect(userId).toBe("david");
      expect(payload.odds).toBe(3.7);
      // O nível 2 pede 7,50 €, e é esse o valor até alguém escrever outro.
      expect(payload.stake).toBe(7.5);
      expect(payload.day).toBe(2);
      expect(payload.status).toBe("pending");
      expect(payload.legs.map((leg: { odds: number }) => leg.odds)).toEqual([
        1.85, 2,
      ]);
    });
  });

  it("fica vazio depois de a aposta ficar guardada", async () => {
    draftSlip.add("p1", jogo(1, "FC Porto", "Rio Ave"));
    render(<DraftSlipBar />);

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.change(screen.getByLabelText("Odd de FC Porto vs Rio Ave"), {
      target: { value: "1,85" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registar" }));

    await waitFor(() => expect(guardada).toHaveBeenCalled());
    await waitFor(() => expect(draftSlip.read().legs).toHaveLength(0));
  });

  it("deixa tirar um jogo sem desfazer o resto", () => {
    draftSlip.add("p1", jogo(1, "FC Porto", "Rio Ave"));
    draftSlip.add("p1", jogo(2, "Benfica", "Braga"));
    render(<DraftSlipBar />);

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tirar FC Porto vs Rio Ave do boletim",
      }),
    );

    expect(screen.queryByText("FC Porto vs Rio Ave")).toBeNull();
    expect(screen.getByText("Benfica vs Braga")).toBeInTheDocument();
  });

  it("não guarda nada quando a aposta falha", async () => {
    // O boletim não pode desaparecer a prometer uma aposta que não ficou:
    // o trabalho de a montar tem de continuar lá para se tentar outra vez.
    guardada.mockRejectedValue(new Error("rede"));
    draftSlip.add("p1", jogo(1, "FC Porto", "Rio Ave"));
    render(<DraftSlipBar />);

    fireEvent.click(screen.getByRole("button", { expanded: false }));
    fireEvent.change(screen.getByLabelText("Odd de FC Porto vs Rio Ave"), {
      target: { value: "1,85" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Registar" }));

    await waitFor(() => expect(guardada).toHaveBeenCalled());
    expect(draftSlip.read().legs).toHaveLength(1);
  });
});
