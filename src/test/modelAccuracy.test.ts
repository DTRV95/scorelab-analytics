import { describe, expect, it } from "vitest";
import {
  bandVerdict,
  mergeAccuracy,
  type LeagueAccuracy,
} from "@/lib/modelAccuracy";

function league(overrides: Partial<LeagueAccuracy> = {}): LeagueAccuracy {
  return {
    league: "Liga Portugal",
    season: null,
    fixtures_scored: 100,
    fixtures_skipped: 10,
    predictions: 1000,
    markets_counted: 10,
    markets_forecast: 15,
    brier: 0.2,
    baseline_brier: 0.25,
    skill_pct: 20,
    headline: { predictions: 100, predicted_pct: 70, actual_pct: 65 },
    markets: [
      {
        market: "Casa",
        grupo: "Resultado",
        samples: 100,
        predicted_pct: 45,
        actual_pct: 48,
        gap_pp: 3,
        brier: 0.24,
      },
    ],
    calibration: [
      {
        bucket: "40-50%",
        samples: 100,
        predicted_pct: 45,
        actual_pct: 48,
        gap_pp: 3,
      },
    ],
    ...overrides,
  };
}

describe("merging competitions", () => {
  it("weights each competition by how many matches it scored", () => {
    // 300 matches at 60% and 100 at 20%: the pooled rate is 50%, not the 40%
    // you get from averaging the two rates as if they carried equal weight.
    const merged = mergeAccuracy([
      league({
        league: "A",
        headline: { predictions: 300, predicted_pct: 60, actual_pct: 60 },
      }),
      league({
        league: "B",
        headline: { predictions: 100, predicted_pct: 20, actual_pct: 20 },
      }),
    ]);

    expect(merged.headline.predictions).toBe(400);
    expect(merged.headline.actual_pct).toBe(50);
  });

  it("pools a market across competitions instead of averaging its rates", () => {
    const merged = mergeAccuracy([
      league({
        league: "A",
        markets: [
          {
            market: "Casa",
            grupo: "Resultado",
            samples: 900,
            predicted_pct: 50,
            actual_pct: 50,
            gap_pp: 0,
            brier: 0.25,
          },
        ],
      }),
      league({
        league: "B",
        markets: [
          {
            market: "Casa",
            grupo: "Resultado",
            samples: 100,
            predicted_pct: 50,
            actual_pct: 0,
            gap_pp: -50,
            brier: 0.5,
          },
        ],
      }),
    ]);

    const [casa] = merged.markets;
    expect(casa.samples).toBe(1000);
    expect(casa.actual_pct).toBe(45);
    expect(casa.gap_pp).toBe(-5);
    // The Brier score is a mean over predictions, so it pools the same way.
    expect(casa.brier).toBeCloseTo(0.275, 3);
  });

  it("keeps every competition's bands in order", () => {
    const merged = mergeAccuracy([
      league({
        calibration: [
          { bucket: "80-90%", samples: 40, predicted_pct: 84, actual_pct: 80, gap_pp: -4 },
          { bucket: "0-10%", samples: 10, predicted_pct: 6, actual_pct: 10, gap_pp: 4 },
        ],
      }),
      league({
        calibration: [
          { bucket: "40-50%", samples: 90, predicted_pct: 45, actual_pct: 44, gap_pp: -1 },
        ],
      }),
    ]);

    expect(merged.calibration.map((band) => band.bucket)).toEqual([
      "0-10%",
      "40-50%",
      "80-90%",
    ]);
  });

  it("scores the combined view against the same baseline, weighted by predictions", () => {
    const merged = mergeAccuracy([
      league({ league: "A", predictions: 3000, brier: 0.18, baseline_brier: 0.2 }),
      league({ league: "B", predictions: 1000, brier: 0.26, baseline_brier: 0.2 }),
    ]);

    // (0.18 × 3000 + 0.26 × 1000) / 4000
    expect(merged.brier).toBeCloseTo(0.2, 4);
    expect(merged.baseline_brier).toBeCloseTo(0.2, 4);
    // Matching the baseline is no skill at all, whatever each league claimed.
    expect(merged.skill_pct).toBe(0);
  });

  it("never lets the skill figure disagree with the scores beside it", () => {
    const merged = mergeAccuracy([
      league({ predictions: 1000, brier: 0.15, baseline_brier: 0.25, skill_pct: 99 }),
    ]);

    expect(merged.skill_pct).toBe(40);
  });

  it("counts the markets a league forecasts, rather than adding them up", () => {
    // Eight competitions forecast the same board. The combined view scores the
    // same markets each one did; it does not score eighty.
    const merged = mergeAccuracy([league({ league: "A" }), league({ league: "B" })]);

    expect(merged.markets_counted).toBe(10);
    expect(merged.markets_forecast).toBe(15);
    expect(merged.predictions).toBe(2000);
  });

  it("names the combined view rather than claiming one league's name", () => {
    const merged = mergeAccuracy([league({ league: "A" }), league({ league: "B" })]);

    expect(merged.league).toBe("Todas as ligas");
    expect(merged.leagues).toEqual(["A", "B"]);
    expect(mergeAccuracy([league({ league: "A" })]).league).toBe("A");
  });
});

describe("reading a calibration band", () => {
  const band = (samples: number, gap: number) => ({
    bucket: "60-70%",
    samples,
    predicted_pct: 65,
    actual_pct: 65 + gap,
    gap_pp: gap,
  });

  it("will not call a thin band wrong", () => {
    // Eleven matches missing by 20pp is luck, not a flaw worth acting on.
    expect(bandVerdict(band(11, -20))).toBe("thin");
  });

  it("calls a band that promised more than it delivered overconfident", () => {
    expect(bandVerdict(band(200, -8))).toBe("over");
    expect(bandVerdict(band(200, 8))).toBe("under");
    expect(bandVerdict(band(200, -2))).toBe("sharp");
  });
});
