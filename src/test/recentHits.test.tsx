import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { BoardResults, ScoredMatch } from "@/lib/boardResults";

const api = vi.hoisted(() => ({
  snapshot: vi.fn(async () => null as BoardResults | null),
  load: vi.fn(async () => ({}) as BoardResults),
}));

vi.mock("@/lib/boardResults", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/boardResults")>(
      "@/lib/boardResults",
    );
  return {
    ...actual,
    fetchResultsSnapshot: api.snapshot,
    loadBoardResults: api.load,
  };
});

import { RecentHits } from "@/components/RecentHits";
import { useBoardResults } from "@/hooks/useBoardResults";

/** The card as the page mounts it: the hook above, the panel below. */
function Hits() {
  return <RecentHits state={useBoardResults()} />;
}

let id = 0;
function scored(
  landed: boolean,
  {
    daysAgo = 1,
    hour = 20,
    pct = 78,
    home = "Benfica",
    away = "Rio Ave",
  }: {
    daysAgo?: number;
    hour?: number;
    pct?: number;
    home?: string;
    away?: string;
  } = {},
): ScoredMatch {
  id += 1;
  const when = new Date();
  when.setDate(when.getDate() - daysAgo);
  when.setHours(hour, 0, 0, 0);

  return {
    fixture_id: id,
    league: "Liga Portugal",
    home_name: home,
    away_name: away,
    kickoff: when.toISOString(),
    home_goals: landed ? 2 : 0,
    away_goals: landed ? 0 : 1,
    headline_market: "1X",
    headline_pct: pct,
    landed,
  };
}

function results(
  matches: ScoredMatch[],
  unavailable: string[] = [],
): BoardResults {
  const hits = matches.filter((match) => match.landed).length;
  return {
    matches,
    played: matches.length,
    hits,
    hit_pct: matches.length ? (hits / matches.length) * 100 : 0,
    predicted_pct: 78,
    unavailable,
    skipped: 0,
    at: Date.now(),
    source: "snapshot",
  };
}

/**
 * A conta grande, lá em cima.
 *
 * Um dia sozinho repete-a na linha dele — "1 de 1" no topo e "1 de 1" na
 * quinta-feira são o mesmo número duas vezes e as duas verdadeiras. O
 * topo é o primeiro.
 */
const total = (texto: string) => screen.getAllByText(texto)[0];

beforeEach(() => {
  vi.clearAllMocks();
  api.snapshot.mockResolvedValue(null);
});
afterEach(() => cleanup());

describe("how the board did", () => {
  it("abre nos últimos cinco dias, com a média de acerto à cabeça", async () => {
    // Era ontem e mais nada, e um dia de futebol não chega para uma
    // média: três jogos certos de uma terça-feira davam 100%.
    api.snapshot.mockResolvedValue(
      results([
        scored(true, { pct: 80 }),
        scored(true, { pct: 70, daysAgo: 3, home: "Porto" }),
        scored(false, { pct: 60, daysAgo: 5, home: "Sporting" }),
        // Há seis dias: está na semana, não está nestes cinco.
        scored(false, { daysAgo: 6, home: "Braga" }),
      ]),
    );

    render(<Hits />);

    expect(await screen.findByText("2 de 3")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText(/nos últimos 5 dias/)).toBeInTheDocument();
    expect(screen.getByText(/Dizia, em média, 70%/)).toBeInTheDocument();
    expect(screen.queryByText(/Braga/)).toBeNull();
  });

  it("dá a conta de cada dia por baixo da conta de todos", async () => {
    // Dois dias com a mesma percentagem geral de 50% e nada em comum: um
    // sábado de quatro jogos a 75% e uma terça de dois a zero. A conta de
    // cima não distingue os dois, e é essa a pergunta a seguir.
    api.snapshot.mockResolvedValue(
      results([
        scored(true, { daysAgo: 1 }),
        scored(true, { daysAgo: 1, home: "Porto" }),
        scored(true, { daysAgo: 1, home: "Sporting" }),
        scored(false, { daysAgo: 1, home: "Braga" }),
        scored(false, { daysAgo: 4, home: "Vitória" }),
        scored(false, { daysAgo: 4, home: "Chaves" }),
      ]),
    );

    render(<Hits />);

    // No topo, os seis jogos de todos os dias.
    expect(await screen.findByText("3 de 6")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    // E depois, um dia de cada vez, do mais recente para o mais antigo.
    const dias = screen.getAllByRole("button", { expanded: false });
    expect(dias).toHaveLength(2);
    expect(dias[0]).toHaveTextContent("3 de 4");
    expect(dias[0]).toHaveTextContent("75%");
    expect(dias[1]).toHaveTextContent("0 de 2");
    expect(dias[1]).toHaveTextContent("0%");
  });

  it("abre um dia nos jogos dele, e só nos dele", async () => {
    api.snapshot.mockResolvedValue(
      results([
        scored(true, { daysAgo: 1, home: "Benfica" }),
        scored(false, { daysAgo: 4, home: "Chaves" }),
      ]),
    );

    render(<Hits />);
    await screen.findByText(/nos últimos 5 dias/);

    // Fechados à entrada: a conta vem primeiro, os jogos vêm a um toque.
    expect(screen.queryByText(/Benfica/)).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { expanded: false })[0]);

    expect(screen.getByText(/Benfica/)).toBeInTheDocument();
    expect(screen.queryByText(/Chaves/)).toBeNull();
  });

  it("não conta os jogos de hoje, que são do lado das previsões", async () => {
    const hoje = new Date();
    hoje.setHours(Math.max(1, hoje.getHours() - 1), 0, 0, 0);

    api.snapshot.mockResolvedValue(
      results([
        { ...scored(false, { home: "Chaves" }), kickoff: hoje.toISOString() },
        scored(true),
      ]),
    );

    render(<Hits />);

    await screen.findByText(/nos últimos 5 dias/);
    expect(total("1 de 1")).toBeInTheDocument();
    expect(screen.queryByText(/Chaves/)).toBeNull();
  });

  it("opens the whole week behind the five days, without asking anybody again", async () => {
    api.snapshot.mockResolvedValue(
      results([scored(true), scored(false, { daysAgo: 6, home: "Braga" })]),
    );

    render(<Hits />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver os últimos sete dias/ }),
    );

    await screen.findByText(/nos últimos sete dias/);
    expect(total("1 de 2")).toBeInTheDocument();
    // Os jogos vivem dentro do dia deles.
    expect(screen.queryByText(/Braga/)).toBeNull();
    // O Braga é de há seis dias, logo é o dia mais antigo: o último.
    const dias = screen.getAllByRole("button", { expanded: false });
    fireEvent.click(dias[dias.length - 1]);
    expect(screen.getByText(/Braga/)).toBeInTheDocument();
    expect(api.load).not.toHaveBeenCalled();
  });

  it("says so when nothing was played, instead of showing 0%", async () => {
    api.snapshot.mockResolvedValue(
      results([scored(true, { daysAgo: 6, home: "Braga" })]),
    );

    render(<Hits />);

    expect(
      await screen.findByText(/Não se jogou nada nos últimos 5 dias/),
    ).toBeInTheDocument();
  });

  it("não diz que não se jogou nada quando o que faltou foi perguntar", async () => {
    // 27 de Outubro: a Serie A não respondeu à marcação da noite e foi a
    // única competição que jogou nesse dia — três jogos, os três
    // acertados. O cartão escreveu "ontem não se jogou nada", que não é
    // uma versão cautelosa da verdade, é o contrário dela.
    api.snapshot.mockResolvedValue(
      results([scored(true, { daysAgo: 6, home: "Braga" })], ["Serie A"]),
    );

    render(<Hits />);

    expect(await screen.findByText(/faltou contar Serie A/)).toBeInTheDocument();
    expect(screen.queryByText(/não se jogou nada/)).not.toBeInTheDocument();
  });

  it("diz que a conta está incompleta quando até há jogos marcados", async () => {
    api.snapshot.mockResolvedValue(
      results([scored(true), scored(false, { home: "Porto" })], ["Serie A"]),
    );

    render(<Hits />);

    await screen.findByText(/nos últimos 5 dias/);
    expect(total("1 de 2")).toBeInTheDocument();
    expect(
      screen.getByText(/Sem Serie A, que não respondeu/),
    ).toBeInTheDocument();
  });

  it("junta as competições em falta numa frase só", async () => {
    api.snapshot.mockResolvedValue(
      results([], ["Serie A", "Bundesliga", "Eredivisie"]),
    );

    render(<Hits />);

    expect(
      await screen.findByText(/Serie A, Bundesliga e Eredivisie/),
    ).toBeInTheDocument();
  });

  it("never wakes the engine on its own", async () => {
    // Scoring a week means simulating every game in it again, and the engine
    // takes most of a minute to get up. Nobody opens this page into that.
    api.snapshot.mockResolvedValue(null);

    render(<Hits />);

    expect(
      await screen.findByRole("button", { name: /Ver como correram/ }),
    ).toBeInTheDocument();
    expect(api.load).not.toHaveBeenCalled();
  });

  it("asks the engine when somebody presses the button", async () => {
    api.snapshot.mockResolvedValue(null);
    api.load.mockResolvedValue(results([scored(true), scored(true)]));

    render(<Hits />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver como correram/ }),
    );

    await screen.findByText(/nos últimos 5 dias/);
    expect(total("2 de 2")).toBeInTheDocument();
    expect(api.load).toHaveBeenCalledWith(7, { force: true });
  });

  it("says a failed request failed", async () => {
    api.snapshot.mockResolvedValue(null);
    api.load.mockRejectedValue(new Error("Fonte de dados não configurada."));

    render(<Hits />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Ver como correram/ }),
    );

    expect(
      await screen.findByText("Fonte de dados não configurada."),
    ).toBeInTheDocument();
  });
});
