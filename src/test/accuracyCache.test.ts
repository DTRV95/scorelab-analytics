import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  measuredAgo,
  readCachedAccuracy,
  writeCachedAccuracy,
} from "@/lib/accuracyCache";
import { mergeAccuracy, type LeagueAccuracy } from "@/lib/modelAccuracy";

function report(leagues: string[]) {
  const base: LeagueAccuracy = {
    league: leagues[0],
    season: null,
    fixtures_scored: 100,
    fixtures_skipped: 10,
    predictions: 1000,
    markets_counted: 10,
    markets_forecast: 15,
    brier: 0.2,
    baseline_brier: 0.25,
    skill_pct: 20,
    headline: { predictions: 100, predicted_pct: 70, actual_pct: 68 },
    markets: [],
    calibration: [],
  };
  return mergeAccuracy(leagues.map((league) => ({ ...base, league })));
}

describe("keeping the last measurement", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("gives back the report saved for the same competitions", () => {
    writeCachedAccuracy(["Liga Portugal", "Premier League"], report(["A", "B"]));

    const cached = readCachedAccuracy(["Premier League", "Liga Portugal"]);

    expect(cached?.report.predictions).toBe(2000);
  });

  it("does not answer for a different set of competitions", () => {
    writeCachedAccuracy(["Liga Portugal"], report(["A"]));

    expect(readCachedAccuracy(["Liga Portugal", "La Liga"])).toBeNull();
    expect(readCachedAccuracy(["La Liga"])).toBeNull();
  });

  it("lets a stale measurement expire instead of serving it forever", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T10:00:00Z"));
    writeCachedAccuracy(["Liga Portugal"], report(["A"]));

    vi.setSystemTime(new Date("2026-09-25T15:30:00Z"));
    expect(readCachedAccuracy(["Liga Portugal"])).not.toBeNull();

    vi.setSystemTime(new Date("2026-09-25T16:30:00Z"));
    expect(readCachedAccuracy(["Liga Portugal"])).toBeNull();
  });

  it("survives junk in storage rather than breaking the page", () => {
    localStorage.setItem("scorelab_model_accuracy_cache", "{não é json");

    expect(readCachedAccuracy(["Liga Portugal"])).toBeNull();
  });

  it("says how old the measurement is in words", () => {
    const now = new Date("2026-09-25T12:00:00Z").getTime();

    expect(measuredAgo(now - 20 * 1000, now)).toBe("agora mesmo");
    expect(measuredAgo(now - 12 * 60 * 1000, now)).toBe("há 12 min");
    expect(measuredAgo(now - 65 * 60 * 1000, now)).toBe("há 1 hora");
    expect(measuredAgo(now - 5 * 60 * 60 * 1000, now)).toBe("há 5 horas");
  });
});
