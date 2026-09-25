import { describe, expect, it } from "vitest";
import {
  MILLION_PLAN_END,
  MILLION_PLAN_TABLE,
} from "@/lib/millionPlanTable";
import { ladderFor, parseRules } from "@/lib/challengeRules";

/**
 * Rows copied from the PDF, spread across the three stake bands and both ends
 * of the table. They are here to catch a transcription slip, which no amount of
 * internal consistency would reveal.
 */
const FROM_THE_DOCUMENT = [
  { day: 1, bankrollStart: 10, stake: 5, odds: 2, profit: 5, bankrollEnd: 15 },
  { day: 2, bankrollStart: 15, stake: 7.5, odds: 1.85, profit: 6.38, bankrollEnd: 21.38 },
  { day: 5, bankrollStart: 45.72, stake: 22.86, odds: 1.75, profit: 17.14, bankrollEnd: 62.86 },
  { day: 15, bankrollStart: 1573.54, stake: 786.77, odds: 1.75, profit: 590.08, bankrollEnd: 2163.62 },
  { day: 16, bankrollStart: 2163.62, stake: 865.45, odds: 1.8, profit: 692.36, bankrollEnd: 2855.97 },
  { day: 29, bankrollStart: 96934.39, stake: 38773.76, odds: 1.95, profit: 36835.07, bankrollEnd: 133769.46 },
  { day: 30, bankrollStart: 133769.46, stake: 40130.84, odds: 1.75, profit: 30098.13, bankrollEnd: 163867.58 },
  { day: 38, bankrollStart: 793353.63, stake: 238006.09, odds: 1.9, profit: 214205.48, bankrollEnd: 1007559.11 },
];

describe("the document's table", () => {
  it("has the 38 days the plan is written for", () => {
    expect(MILLION_PLAN_TABLE).toHaveLength(38);
    expect(MILLION_PLAN_TABLE.map((row) => row.day)).toEqual(
      Array.from({ length: 38 }, (_, i) => i + 1)
    );
  });

  it("matches the rows written in the document", () => {
    FROM_THE_DOCUMENT.forEach((expected) => {
      expect(MILLION_PLAN_TABLE[expected.day - 1]).toMatchObject(expected);
    });
  });

  it("ends where the document ends", () => {
    expect(MILLION_PLAN_TABLE[37].bankrollEnd).toBe(MILLION_PLAN_END);
    expect(MILLION_PLAN_END).toBe(1007559.11);
  });

  it("carries each day's total into the next day's bankroll", () => {
    MILLION_PLAN_TABLE.slice(0, -1).forEach((row, index) => {
      expect(MILLION_PLAN_TABLE[index + 1].bankrollStart).toBe(row.bankrollEnd);
    });
  });

  it("steps the stake down through the document's three bands", () => {
    expect(MILLION_PLAN_TABLE[0].stakePct).toBe(0.5);
    expect(MILLION_PLAN_TABLE[14].stakePct).toBe(0.5);
    expect(MILLION_PLAN_TABLE[15].stakePct).toBe(0.4);
    expect(MILLION_PLAN_TABLE[28].stakePct).toBe(0.4);
    expect(MILLION_PLAN_TABLE[29].stakePct).toBe(0.3);
  });

  it("is what a challenge with nothing stored actually runs on", () => {
    // Every challenge created before the rules column has rules of {}. Reading
    // those as a generic percentage is what put a ladder nobody agreed to on
    // the screen, so this is the case that has to keep working.
    const ladder = ladderFor(parseRules({}, 38), 10);

    expect(ladder).toEqual(MILLION_PLAN_TABLE);
  });
});
