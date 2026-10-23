import { describe, expect, it } from "vitest";
import { tally, type SuggestionRow } from "@/lib/suggestionRecord";

const row = (
  call: string,
  landed: boolean | null,
  price: number,
): SuggestionRow => ({
  fixture_id: Math.random(),
  mercado: "1X",
  league: "Premier League",
  kickoff: null,
  call,
  fair_pct: 63,
  price,
  edge_pp: 5,
  required_pp: 3,
  derived: false,
  because: "",
  decided_at: "",
  landed,
});

describe("tally", () => {
  it("conta só as sugestões daquela resposta, e só as conferidas", () => {
    const got = tally(
      [
        row("apostar", true, 2.0),
        row("apostar", false, 2.0),
        row("passar", true, 2.0),
        row("apostar", null, 2.0),
      ],
      "apostar",
    );

    expect(got.settled).toBe(2);
    expect(got.landed).toBe(1);
    expect(got.winPct).toBe(50);
  });

  it("mede o lucro ao preço registado, não ao acerto", () => {
    // Acertar metade a 2,00 fica exactamente em zero. É este o número
    // que interessa: acertar muito a preços maus não é ganhar.
    const equilibrio = tally(
      [row("apostar", true, 2.0), row("apostar", false, 2.0)],
      "apostar",
    );
    expect(equilibrio.unitsProfit).toBe(0);
    expect(equilibrio.roi).toBe(0);

    // E acertar metade a 1,50 é perder, por muito que 50% pareça bom.
    const perda = tally(
      [row("apostar", true, 1.5), row("apostar", false, 1.5)],
      "apostar",
    );
    expect(perda.unitsProfit).toBe(-0.5);
    expect(perda.roi).toBe(-25);
  });

  it("conta o 'não punha' ao contrário, que é como ele acerta", () => {
    // Metade do trabalho desta casa é dizer que não, e ali acertar é o
    // mercado não entrar. Contá-lo como os outros era dar por errado
    // exactamente o que correu bem.
    const got = tally(
      [
        row("passar", false, 1.2),
        row("passar", false, 1.2),
        row("passar", true, 1.2),
      ],
      "passar",
    );

    expect(got.landed).toBe(2);
    expect(got.winPct).toBeCloseTo(66.7, 1);
  });

  it("não inventa números sem nada conferido", () => {
    const got = tally([row("apostar", null, 2.0)], "apostar");

    expect(got.settled).toBe(0);
    expect(got.winPct).toBeNull();
    expect(got.roi).toBeNull();
  });
});
