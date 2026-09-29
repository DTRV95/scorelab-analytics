import {
  ASSUMED_WIN_RATE,
  ladderFor,
  stakePctForDay,
  type ChallengeTemplate,
} from "@/lib/challengeRules";

/**
 * How hard a challenge actually is, measured rather than felt.
 *
 * The obvious measure — multiply the odds of every day together — orders them
 * wrongly, because it ignores the rule that makes a challenge finishable: a
 * lost day steps back down instead of ending the run. Under that measure the
 * Maratona dos 60 looks the hardest of all when it is in fact the one most
 * likely to be finished.
 *
 * So the challenge is played out instead: a bankroll, a day counter, a coin
 * weighted to the win rate a decent bettor gets, and a walk up and down the
 * ladder until it finishes or the money is gone.
 */

/** A small deterministic generator, so a difficulty never changes by itself. */
function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export interface SimOptions {
  winRate?: number;
  trials?: number;
  seed?: number;
  /** Days to play before giving up on a run that is going nowhere. */
  horizon?: number;
}

/** How often the challenge gets finished, played out many times over. */
export function completionChance(
  template: ChallengeTemplate,
  {
    winRate = ASSUMED_WIN_RATE,
    trials = 4000,
    seed = 20260929,
    horizon,
  }: SimOptions = {}
): number {
  const { rules, startingBankroll, target } = template;
  const ladder = ladderFor(rules, startingBankroll);
  const limit = horizon ?? rules.days * 6;
  const random = rng(seed);

  let finished = 0;

  for (let run = 0; run < trials; run += 1) {
    let bankroll = startingBankroll;
    let day = 1;

    for (let step = 0; step < limit; step += 1) {
      const stake = bankroll * stakePctForDay(rules, day);
      // Nothing left worth staking: this run is over whatever the rules say.
      if (stake < 0.01) break;

      const odds = ladder[Math.min(day, ladder.length) - 1]?.odds ?? 1.9;

      if (random() < winRate) {
        bankroll += stake * (odds - 1);
        // Finishing is reaching the money, never merely reaching the last day.
        // The day counter and the bankroll are separate things — the ladder
        // walks up on a win whatever the money is doing — so counting the day
        // would have called the Plano Milhão finished seven times in a
        // hundred, with a bankroll nowhere near a million.
        if (bankroll >= target) {
          finished += 1;
          break;
        }
        if (day < rules.days) day += 1;
      } else {
        bankroll -= stake;
        day = Math.max(1, day - 1);
      }
    }
  }

  return finished / trials;
}

/**
 * One to five, where one is the one you expect to finish.
 *
 * The bands are wide on purpose: the difference between 54% and 58% is noise,
 * the difference between 54% and one in a thousand is the whole story.
 */
export function difficultyStars(chance: number): 1 | 2 | 3 | 4 | 5 {
  if (chance >= 0.4) return 1;
  if (chance >= 0.25) return 2;
  if (chance >= 0.1) return 3;
  if (chance >= 0.01) return 4;
  return 5;
}

const cache = new Map<string, { chance: number; stars: 1 | 2 | 3 | 4 | 5 }>();

/** The measured difficulty of a ready-made challenge, worked out once. */
export function difficultyOf(template: ChallengeTemplate): {
  chance: number;
  stars: 1 | 2 | 3 | 4 | 5;
} {
  const cached = cache.get(template.key);
  if (cached) return cached;

  const chance = completionChance(template);
  const measured = { chance, stars: difficultyStars(chance) };
  cache.set(template.key, measured);
  return measured;
}

/** The difficulty in words, for the line under the stars. */
export function describeDifficulty(chance: number): string {
  if (chance >= 0.01) {
    return `Acaba-se em ${Math.round(chance * 100)} de cada 100 tentativas.`;
  }
  if (chance <= 0) return "Nunca se acabou em nenhuma simulação.";
  return `Acaba-se 1 vez em cada ${Math.round(1 / chance).toLocaleString("pt-PT")}.`;
}
