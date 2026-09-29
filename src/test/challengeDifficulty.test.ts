import { describe, expect, it } from "vitest";
import {
  completionChance,
  describeDifficulty,
  difficultyOf,
  difficultyStars,
} from "@/lib/challengeDifficulty";
import { CHALLENGE_TEMPLATES } from "@/lib/challengeRules";

describe("measuring how hard a challenge is", () => {
  it("gives the same answer every time it is asked", () => {
    const template = CHALLENGE_TEMPLATES[1];

    expect(completionChance(template)).toBe(completionChance(template));
  });

  it("gets easier as the bettor gets better", () => {
    const template = CHALLENGE_TEMPLATES.find((t) => t.key === "dobrar")!;

    expect(completionChance(template, { winRate: 0.6 })).toBeGreaterThan(
      completionChance(template, { winRate: 0.5 })
    );
  });

  it("puts one star on what you expect to finish and five on a lottery", () => {
    expect(difficultyStars(0.5)).toBe(1);
    expect(difficultyStars(0.3)).toBe(2);
    expect(difficultyStars(0.15)).toBe(3);
    expect(difficultyStars(0.05)).toBe(4);
    expect(difficultyStars(0.0001)).toBe(5);
  });

  it("keeps every long shot in the top two bands", () => {
    for (const template of CHALLENGE_TEMPLATES.filter((t) => t.longShot)) {
      expect(difficultyOf(template).stars).toBeGreaterThanOrEqual(4);
    }
  });

  it("will not call the Plano Milhão finishable", () => {
    // Counting the last day rather than the money once put this at 7 in 100,
    // with a bankroll nowhere near a million. Finishing is the money.
    const milhao = CHALLENGE_TEMPLATES.find((t) => t.key === "milhao")!;

    expect(difficultyOf(milhao).chance).toBeLessThan(0.001);
  });

  it("never calls a planned challenge as hard as a lottery", () => {
    // If one did, it would mean the arithmetic stopped matching the promise.
    for (const template of CHALLENGE_TEMPLATES.filter((t) => !t.longShot)) {
      expect(difficultyOf(template).stars).toBeLessThanOrEqual(3);
    }
  });

  it("orders the planned challenges by how likely they are to be finished", () => {
    const sprint = difficultyOf(
      CHALLENGE_TEMPLATES.find((t) => t.key === "sprint-7")!
    );
    const maratona = difficultyOf(
      CHALLENGE_TEMPLATES.find((t) => t.key === "maratona-60")!
    );

    // Seven days at 8% is finished far more often than sixty at 5%, even
    // though the long one is the better bet per euro.
    expect(sprint.chance).toBeGreaterThan(maratona.chance);
  });

  it("says it in words a person would use", () => {
    expect(describeDifficulty(0.54)).toBe("Acaba-se em 54 de cada 100 tentativas.");
    expect(describeDifficulty(0.001)).toContain("1 vez em cada");
    expect(describeDifficulty(0)).toContain("Nunca");
  });
});
