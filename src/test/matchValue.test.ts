import { describe, expect, it } from "vitest";
import {
  buildValueRows,
  fairOdds,
  recordVerdict,
  valuePicks,
  type MarketForecast,
} from "@/lib/matchValue";
import type { AccuracyMarket } from "@/lib/modelAccuracy";

const markets: MarketForecast[] = [
  {
    mercado: "Casa",
    grupo: "Resultado",
    probabilidade_pct: 60,
    min_pct: 54,
    max_pct: 66,
  },
  {
    mercado: "Empate",
    grupo: "Resultado",
    probabilidade_pct: 25,
    min_pct: 21,
    max_pct: 29,
  },
];

describe("pricing a market", () => {
  it("turns a probability into the price it is worth", () => {
    expect(fairOdds(50)).toBe(2);
    expect(fairOdds(25)).toBe(4);
    expect(fairOdds(0)).toBe(0);
  });

  it("quotes the edge twice: central estimate and pessimistic floor", () => {
    const [casa] = buildValueRows(markets, { Casa: "1.90" }, 1000);

    // 60% against 52.6% implied.
    expect(casa.edge).toBe(7.37);
    // The same price against the bottom of the model's own interval, 54%.
    expect(casa.edgeFloor).toBe(1.37);
    expect(casa.fairOdds).toBeCloseTo(1.67, 2);
    expect(casa.cautiousFairOdds).toBeCloseTo(1.85, 2);
    expect(casa.stake).toBeGreaterThan(0);
  });

  it("leaves an unpriced market empty rather than inventing a price", () => {
    const [, empate] = buildValueRows(markets, { Casa: "1.90" }, 1000);

    expect(empate.odds).toBeNull();
    expect(empate.edge).toBeNull();
    expect(empate.stake).toBeNull();
    // The forecast still stands on its own without a bookmaker.
    expect(empate.fairOdds).toBe(4);
  });

  it("ignores a price that is not a price", () => {
    const rows = buildValueRows(markets, { Casa: "", Empate: "0.8" }, 1000);

    expect(rows[0].odds).toBeNull();
    expect(rows[1].odds).toBeNull();
  });
});

describe("picking the value", () => {
  it("only backs an edge that survives the model being wrong", () => {
    // 1.75 beats the central 60% but not the 54% floor: not a pick.
    const thin = buildValueRows(markets, { Casa: "1.75" }, 1000);
    expect(valuePicks(thin)).toHaveLength(0);

    const real = buildValueRows(markets, { Casa: "2.10" }, 1000);
    expect(valuePicks(real).map((row) => row.market)).toEqual(["Casa"]);
  });

  it("orders picks by the floor, not the flattering number", () => {
    const rows = buildValueRows(
      markets,
      { Casa: "2.00", Empate: "6.00" },
      1000
    );
    const picks = valuePicks(rows);

    // Empate at 6.00 is worth more against its own floor than Casa at 2.00.
    expect(picks[0].market).toBe("Empate");
    expect(picks).toHaveLength(2);
  });
});

describe("reading a market's track record", () => {
  const record = (samples: number, gap: number): AccuracyMarket => ({
    market: "Casa",
    grupo: "Resultado",
    samples,
    predicted_pct: 45,
    actual_pct: 45 + gap,
    gap_pp: gap,
    brier: 0.24,
  });

  it("says nothing when there is not enough history to say it", () => {
    expect(recordVerdict(null)).toBe("unknown");
    expect(recordVerdict(record(12, -20))).toBe("unknown");
  });

  it("flags a market the model has been promising too much on", () => {
    expect(recordVerdict(record(400, -8))).toBe("over");
    expect(recordVerdict(record(400, 8))).toBe("under");
    expect(recordVerdict(record(400, -1))).toBe("sharp");
  });

  it("carries the record onto the row it belongs to", () => {
    const [casa, empate] = buildValueRows(
      markets,
      {},
      1000,
      new Map([["Casa", record(400, -8)]])
    );

    expect(casa.record?.gap_pp).toBe(-8);
    expect(empate.record).toBeNull();
  });
});
