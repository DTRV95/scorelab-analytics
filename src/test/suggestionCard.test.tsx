import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SuggestionCard } from "@/components/SuggestionCard";

/**
 * O cartão a meio de carregar.
 *
 * Antes disto ele desenhava com o que tinha, que era só o número do
 * modelo, e dois ou três segundos depois mudava de ideias à frente de
 * quem estava a ler. A primeira coisa que se via não era a sugestão —
 * era o modelo em bruto, que é o contrário do que ele existe para ser.
 */

const jogo = {
  markets: [{ mercado: "1X", probabilidade_pct: 82.3 }],
  amostraPct: 33,
  record: new Map(),
  adjustments: {},
  sample: { label: "Baixa", pct: 33 },
};

// Sem isto, o segundo render encontra o primeiro ainda no documento e
// a procura por texto acha dois.
afterEach(() => cleanup());

describe("SuggestionCard a carregar", () => {
  it("não arrisca uma resposta antes de os dados chegarem", () => {
    render(<SuggestionCard {...jogo} loading prices={null} implied={null} />);

    expect(screen.getByText(/A ver os preços/)).toBeInTheDocument();
    // E sobretudo: nada que se leia como uma decisão.
    expect(screen.queryByText(/Sem preço ainda/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Casa ou Empate/)).not.toBeInTheDocument();
  });

  it("não guarda no registo uma decisão que ainda não tomou", () => {
    // Guardar aqui era escrever para sempre um palpite feito sem
    // preço, e a tabela não aceita correcções.
    const guardou = vi.fn();
    render(
      <SuggestionCard
        {...jogo}
        loading
        prices={{ "1X": 1.5 }}
        implied={{ "1X": 70 }}
        onDecided={guardou}
      />,
    );

    expect(guardou).not.toHaveBeenCalled();
  });

  it("decide assim que tudo chegou", () => {
    const guardou = vi.fn();
    render(
      <SuggestionCard
        {...jogo}
        loading={false}
        prices={{ "1X": 1.5 }}
        implied={{ "1X": 70 }}
        onDecided={guardou}
      />,
    );

    expect(screen.queryByText(/A ver os preços/)).not.toBeInTheDocument();
    expect(screen.getByText("Casa ou Empate (1X)")).toBeInTheDocument();
    expect(guardou).toHaveBeenCalledTimes(1);
  });

  it("mostra o histórico enquanto espera, que é o que já sabe", () => {
    render(<SuggestionCard {...jogo} loading prices={null} implied={null} />);

    expect(screen.getByText(/Histórico: Baixa \(33%\)/)).toBeInTheDocument();
  });
});
