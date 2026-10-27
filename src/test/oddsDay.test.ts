import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetAsked } from "@/lib/askOnce";

/**
 * Uma chamada por liga e por dia, partilhada pelos dois.
 *
 * A fonte cobra por listagem de liga e dá quinhentas chamadas por mês.
 * O motor dorme entre visitas e acorda sem memória, por isso cada
 * visita recomeçava do zero e o mês acabou a meio de Outubro. A
 * memória passa a viver fora do motor.
 */

const upsert = vi.fn(async (_linha: { league: string; day: string }) => ({
  error: null,
}));
const guardado: { payload: unknown | null } = { payload: null };

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () =>
              guardado.payload
                ? { data: { payload: guardado.payload }, error: null }
                : { data: null, error: null },
          }),
        }),
      }),
      upsert,
    }),
  },
}));

const engine = vi.fn();
vi.stubGlobal("fetch", engine);

const resposta = (body: unknown) => ({
  ok: true,
  json: async () => body,
});

const umaLiga = {
  matches: {
    "564719": {
      odds: { Casa: 1.67, Empate: 3.75, Fora: 5.5 },
      implied_pct: { Casa: 57.2, Empate: 25.5, Fora: 17.4 },
      derived: ["1X"],
      home_away_disagrees: false,
    },
    "558567": {
      odds: { Casa: 2.1 },
      implied_pct: { Casa: 45 },
      derived: [],
      home_away_disagrees: true,
    },
  },
  blocked: false,
};

beforeEach(() => {
  forgetAsked();
  guardado.payload = null;
  upsert.mockClear();
  engine.mockReset();
});

afterEach(() => vi.resetModules());

describe("fetchLeagueOdds", () => {
  it("pede a liga uma vez só, por mais jogos que a abram", async () => {
    const { fetchLeagueOdds } = await import("@/lib/oddsDay");
    engine.mockResolvedValue(resposta(umaLiga));

    const [a, b, c] = await Promise.all([
      fetchLeagueOdds("La Liga"),
      fetchLeagueOdds("La Liga"),
      fetchLeagueOdds("La Liga"),
    ]);

    expect(engine).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("guarda o que trouxe, para amanhã não voltar a pagar", async () => {
    const { fetchLeagueOdds } = await import("@/lib/oddsDay");
    engine.mockResolvedValue(resposta(umaLiga));

    await fetchLeagueOdds("La Liga");

    expect(upsert).toHaveBeenCalledTimes(1);
    const [linha] = upsert.mock.calls[0];
    expect(linha.league).toBe("La Liga");
    expect(linha.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("usa o que está guardado em vez de pagar outra vez", async () => {
    const { fetchLeagueOdds, priceOf } = await import("@/lib/oddsDay");
    guardado.payload = {
      matches: { "564719": { odds: { Casa: 1.7 }, implied: {}, derived: [], homeAwayDisagrees: false } },
      at: Date.now(),
      blocked: false,
    };

    const found = await fetchLeagueOdds("La Liga");

    expect(engine).not.toHaveBeenCalled();
    expect(priceOf(found, 564719)?.odds.Casa).toBe(1.7);
  });

  it("não guarda uma recusa, que amanhã pode já não ser recusa", async () => {
    const { fetchLeagueOdds } = await import("@/lib/oddsDay");
    engine.mockResolvedValue(resposta({ matches: {}, blocked: true }));

    const found = await fetchLeagueOdds("Serie A");

    expect(found.blocked).toBe(true);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("traz cada jogo da liga pelo seu número", async () => {
    const { fetchLeagueOdds, priceOf } = await import("@/lib/oddsDay");
    engine.mockResolvedValue(resposta(umaLiga));

    const found = await fetchLeagueOdds("La Liga");

    expect(priceOf(found, 564719)?.odds.Casa).toBe(1.67);
    expect(priceOf(found, 564719)?.derived).toEqual(["1X"]);
    expect(priceOf(found, 558567)?.homeAwayDisagrees).toBe(true);
    // Um jogo que a liga não trouxe não é um preço errado, é nenhum.
    expect(priceOf(found, 999999)).toBeNull();
  });
});
