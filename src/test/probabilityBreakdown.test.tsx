import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProbabilityBreakdown } from "@/components/ProbabilityBreakdown";

const data = {
  lambda_casa: 1.42,
  lambda_fora: 1.21,
  total_golos_esperados: 2.63,
  amostra_pct: 60,
  amostra_label: "Média",
  mercados: [
    { mercado: "Casa", grupo: "Resultado", probabilidade_pct: 40.7, min_pct: 34.7, max_pct: 46.9 },
    { mercado: "Empate", grupo: "Resultado", probabilidade_pct: 28.0, min_pct: 26.4, max_pct: 29.6 },
    { mercado: "Fora", grupo: "Resultado", probabilidade_pct: 31.3, min_pct: 25.6, max_pct: 37.2 },
    { mercado: "1X", grupo: "Resultado", probabilidade_pct: 68.7, min_pct: 62.8, max_pct: 74.4 },
    { mercado: "2X", grupo: "Resultado", probabilidade_pct: 59.3, min_pct: 53.1, max_pct: 65.3 },
    { mercado: "Mais de 2.5 Golos", grupo: "Golos", probabilidade_pct: 51.0, min_pct: 43.4, max_pct: 58.4 },
    { mercado: "Menos de 2.5 Golos", grupo: "Golos", probabilidade_pct: 49.0, min_pct: 41.6, max_pct: 56.6 },
    { mercado: "Mais de 3.5 Golos", grupo: "Golos", probabilidade_pct: 27.4, min_pct: 22.1, max_pct: 33.2 },
    { mercado: "Menos de 3.5 Golos", grupo: "Golos", probabilidade_pct: 72.6, min_pct: 66.8, max_pct: 77.9 },
    { mercado: "Ambas Marcam", grupo: "Ambas Marcam", probabilidade_pct: 55.7, min_pct: 49.3, max_pct: 62.2 },
    { mercado: "BTTS No", grupo: "Ambas Marcam", probabilidade_pct: 44.3, min_pct: 37.8, max_pct: 50.7 },
    { mercado: "1X e Menos de 3.5 Golos", grupo: "Combinados", probabilidade_pct: 50.2, min_pct: 43.1, max_pct: 57.3 },
    { mercado: "2X e Menos de 3.5 Golos", grupo: "Combinados", probabilidade_pct: 44.2, min_pct: 37.4, max_pct: 51.0 },
    { mercado: "1X e Mais de 1.5 Golos", grupo: "Combinados", probabilidade_pct: 51.2, min_pct: 44.0, max_pct: 58.4 },
    { mercado: "2X e Mais de 1.5 Golos", grupo: "Combinados", probabilidade_pct: 43.2, min_pct: 36.5, max_pct: 50.0 },
  ],
};

afterEach(() => {
  cleanup();
});

describe("ProbabilityBreakdown", () => {
  it("renders expected goals and every market's probability", () => {
    render(<ProbabilityBreakdown data={data} />);

    expect(screen.getByText("2.63")).toBeInTheDocument();
    expect(screen.getByText("40.7%")).toBeInTheDocument();
    expect(screen.getByText("Ambas Não Marcam")).toBeInTheDocument();
    expect(screen.getByText(/Confiança da amostra: Média/)).toBeInTheDocument();
  });

  it("never renders odds, edge, value or a betting decision", () => {
    render(<ProbabilityBreakdown data={data} />);

    const forbidden = [/odd/i, /edge/i, /valor/i, /kelly/i, /apostar/i, /stake/i];
    const text = document.body.textContent ?? "";
    forbidden.forEach((pattern) => {
      expect(text).not.toMatch(pattern);
    });
  });

  it("groups markets under Resultado, Golos, Ambas Marcam and Combinados", () => {
    render(<ProbabilityBreakdown data={data} />);

    expect(screen.getByText("Resultado")).toBeInTheDocument();
    expect(screen.getByText("Golos")).toBeInTheDocument();
    // Appears twice: once as the group heading, once as the market row itself.
    expect(screen.getAllByText("Ambas Marcam")).toHaveLength(2);
    expect(screen.getByText("Combinados")).toBeInTheDocument();
  });

  it("shows the double-chance and goals combos", () => {
    render(<ProbabilityBreakdown data={data} />);

    expect(screen.getByText("1X e Menos de 3.5 Golos")).toBeInTheDocument();
    expect(screen.getByText("2X e Menos de 3.5 Golos")).toBeInTheDocument();
    expect(screen.getByText("1X e Mais de 1.5 Golos")).toBeInTheDocument();
    expect(screen.getByText("2X e Mais de 1.5 Golos")).toBeInTheDocument();
    expect(screen.getByText("50.2%")).toBeInTheDocument();
  });

  it("skips a group entirely when the backend sends no markets for it", () => {
    render(
      <ProbabilityBreakdown
        data={{ ...data, mercados: data.mercados.filter((m) => m.grupo !== "Ambas Marcam") }}
      />
    );

    expect(screen.queryByText("Ambas Marcam")).not.toBeInTheDocument();
  });
});
