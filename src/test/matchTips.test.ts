import { describe, expect, it } from "vitest";
import { matchTips } from "@/lib/matchTips";
import type { ProbabilityMarket } from "@/components/ProbabilityBreakdown";
import type { LeagueRates } from "@/lib/leagueReport";

const market = (mercado: string, pct: number): ProbabilityMarket => ({
  mercado,
  grupo: "Golos",
  probabilidade_pct: pct,
  min_pct: pct - 5,
  max_pct: pct + 5,
});

const rates = (overrides: Partial<LeagueRates> = {}): LeagueRates => ({
  league: "Liga Portugal",
  played: 94,
  markets: [
    { mercado: "Casa", grupo: "Resultado", jogos: 42, pct: 45 },
    { mercado: "Empate", grupo: "Resultado", jogos: 24, pct: 26 },
    { mercado: "Mais de 2.5 Golos", grupo: "Golos", jogos: 48, pct: 51 },
    { mercado: "Ambas Marcam", grupo: "Ambas Marcam", jogos: 46, pct: 49 },
    { mercado: "1X", grupo: "Resultado", jogos: 66, pct: 70 },
  ],
  ...overrides,
});

describe("where a game differs from its own league", () => {
  it("points at the market this game has far more of than the competition", () => {
    // 62% de mais de 2.5 numa liga que dá 51% é o que faz este jogo diferente.
    const tips = matchTips(
      [market("Mais de 2.5 Golos", 62), market("Casa", 46)],
      rates(),
    );

    expect(tips).toEqual([
      { market: "Mais de 2.5 Golos", modelPct: 62, leaguePct: 51, gap: 11 },
    ]);
  });

  it("says nothing about a game that is an ordinary game of its league", () => {
    // 53 contra 51 não é notícia nenhuma.
    expect(matchTips([market("Mais de 2.5 Golos", 53)], rates())).toEqual([]);
  });

  it("leaves out a market that is unusual and still unlikely", () => {
    // Um empate a 36% numa liga de 26% continua a ser o resultado menos
    // provável dos três: apontar para ele seria apontar para uma aposta má.
    expect(matchTips([market("Empate", 36)], rates())).toEqual([]);
  });

  it("puts the biggest difference first, and keeps it short", () => {
    const tips = matchTips(
      [
        market("Mais de 2.5 Golos", 62),
        market("Ambas Marcam", 66),
        market("1X", 82),
      ],
      rates(),
    );

    // 17 pontos, 12 e 11: os dois maiores, e o terceiro fica de fora.
    expect(tips.map((tip) => tip.market)).toEqual(["Ambas Marcam", "1X"]);
  });

  it("refuses to be a scale with half a dozen games behind it", () => {
    // Uma época de três jornadas não diz o que a liga costuma dar.
    expect(
      matchTips([market("Mais de 2.5 Golos", 70)], rates({ played: 12 })),
    ).toEqual([]);
  });

  it("says nothing about a competition nobody has rates for", () => {
    expect(matchTips([market("Mais de 2.5 Golos", 70)], null)).toEqual([]);
    expect(
      matchTips([market("Mais de 2.5 Golos", 70)], rates({ markets: [] })),
    ).toEqual([]);
  });
});
