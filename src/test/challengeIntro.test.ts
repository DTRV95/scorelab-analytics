import { describe, expect, it } from "vitest";
import { challengeIntro } from "@/lib/challengePitch";
import { CHALLENGE_TEMPLATES, parseRules } from "@/lib/challengeRules";

const dobrar = CHALLENGE_TEMPLATES.find((entry) => entry.key === "dobrar")!;
const milhao = CHALLENGE_TEMPLATES.find((entry) => entry.key === "milhao")!;

describe("saying what a challenge is, on the way in", () => {
  it("names the money, the levels, the stake and the odds", () => {
    const intro = challengeIntro({
      startingBankroll: dobrar.startingBankroll,
      target: dobrar.target,
      rules: dobrar.rules,
      templateKey: dobrar.key,
    });

    expect(intro.terms).toContain("€");
    expect(intro.terms).toContain(`${dobrar.rules.days} níveis`);
    expect(intro.terms).toMatch(/% da banca|a descer até/);
    expect(intro.terms).toMatch(/odd/);
  });

  it("describes the challenge as it stands, not the model it came from", () => {
    // The bankroll and the target can be changed after it starts; a
    // description that kept advertising the model would be describing a
    // challenge nobody is playing.
    const intro = challengeIntro({
      startingBankroll: 200,
      target: 400,
      rules: dobrar.rules,
      templateKey: dobrar.key,
    });

    expect(intro.terms).toContain("200");
    expect(intro.terms).toContain("400");
    expect(intro.sentence).toContain("Multiplicar por 2");
  });

  it("calls a chase a chase, and a plan a plan", () => {
    const chase = challengeIntro({
      startingBankroll: milhao.startingBankroll,
      target: milhao.target,
      rules: milhao.rules,
      templateKey: milhao.key,
    });
    expect(chase.sentence).toContain("Não é um plano");

    const plan = challengeIntro({
      startingBankroll: dobrar.startingBankroll,
      target: dobrar.target,
      rules: dobrar.rules,
      templateKey: dobrar.key,
    });
    expect(plan.sentence).not.toContain("Não é um plano");
  });

  it("calls a band of one price a price", () => {
    // "odds 1.50–1.50" is the kind of line a machine writes.
    const intro = challengeIntro({
      startingBankroll: 20,
      target: 2500,
      rules: { ...dobrar.rules, oddsMin: 1.5, oddsMax: 1.5 },
      templateKey: null,
    });

    expect(intro.terms).toContain("odd 1.50");
    expect(intro.terms).not.toContain("1.50–1.50");
  });

  it("still says something about a challenge made from no model at all", () => {
    const intro = challengeIntro({
      startingBankroll: 50,
      target: 150,
      rules: parseRules({}, 20),
      templateKey: null,
    });

    expect(intro.sentence.length).toBeGreaterThan(10);
    expect(intro.terms).toContain("20 níveis");
  });
});
