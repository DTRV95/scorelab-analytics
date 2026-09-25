/**
 * The rules a challenge runs by.
 *
 * The Plano Milhão is one shape: stake half the bankroll for fifteen days, then
 * less, at odds between 1.75 and 2.10, one bet a day. Nothing about that is
 * universal, so the rules are data the challenge carries rather than constants
 * the app assumes. A challenge with no rules at all is also a challenge — the
 * bands are then advice and nothing is ever "broken".
 */

export interface StakeBand {
  /** Last day this share applies to. Null means "from here to the end". */
  untilDay: number | null;
  /** Share of the bankroll to stake, 0.5 for half. */
  pct: number;
}

export interface ChallengeRules {
  days: number;
  /** In order. The first band whose untilDay covers the day wins. */
  stakeBands: StakeBand[];
  /** The combined odd the challenge asks for. Null on either side = no limit. */
  oddsMin: number | null;
  oddsMax: number | null;
  /** One bet per day, or as many as you like. */
  onePerDay: boolean;
  /** Losses in a row after which the challenge says to stop. Null = never. */
  lossStreakPause: number | null;
  /**
   * The odds the ladder pencils in when it projects the days ahead. The first
   * day is separate because a plan that opens at even money and then settles
   * into a cycle cannot be written as one repeating list.
   */
  oddsPlan: { first: number; cycle: number[] };
}

/** The document's plan: €10 to a million in 38 days, one bet a day. */
export const MILLION_PLAN_RULES: ChallengeRules = {
  days: 38,
  stakeBands: [
    { untilDay: 15, pct: 0.5 },
    { untilDay: 29, pct: 0.4 },
    { untilDay: null, pct: 0.3 },
  ],
  oddsMin: 1.75,
  oddsMax: 2.1,
  onePerDay: true,
  lossStreakPause: 3,
  oddsPlan: { first: 2, cycle: [1.85, 1.9, 1.95, 1.75, 1.8] },
};

export interface ChallengeTemplate {
  key: string;
  name: string;
  blurb: string;
  startingBankroll: number;
  target: number;
  rules: ChallengeRules;
}

/**
 * Ready-made challenges.
 *
 * Every one of these is a run of wins with no second chances, and the shorter
 * ones are not safer for being short — they are just a smaller bet on the same
 * thing. The blurbs say so rather than selling the ladder.
 */
export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    key: "milhao",
    name: "Plano Milhão",
    blurb: "38 dias, 50% da banca a descer até 30%, odds 1.75–2.10.",
    startingBankroll: 10,
    target: 1_000_000,
    rules: MILLION_PLAN_RULES,
  },
  {
    key: "escada-10",
    name: "Escada de 10 dias",
    blurb: "10 dias a 50% da banca, odds 1.50–2.50. Dobra a banca 3 vezes.",
    startingBankroll: 20,
    target: 200,
    rules: {
      days: 10,
      stakeBands: [{ untilDay: null, pct: 0.5 }],
      oddsMin: 1.5,
      oddsMax: 2.5,
      onePerDay: true,
      lossStreakPause: 2,
      oddsPlan: { first: 1.9, cycle: [1.9] },
    },
  },
  {
    key: "conservador",
    name: "Crescer devagar",
    blurb: "30 dias a 10% da banca, sem limite de odd. Um erro não mata.",
    startingBankroll: 50,
    target: 200,
    rules: {
      days: 30,
      stakeBands: [{ untilDay: null, pct: 0.1 }],
      oddsMin: null,
      oddsMax: null,
      onePerDay: true,
      lossStreakPause: 4,
      oddsPlan: { first: 1.9, cycle: [1.9] },
    },
  },
  {
    key: "livre",
    name: "Desafio livre",
    blurb: "Sem limites: apostas quando quiseres, ao que quiseres.",
    startingBankroll: 50,
    target: 500,
    rules: {
      days: 30,
      stakeBands: [{ untilDay: null, pct: 0.1 }],
      oddsMin: null,
      oddsMax: null,
      onePerDay: false,
      lossStreakPause: null,
      oddsPlan: { first: 1.9, cycle: [1.9] },
    },
  },
];

function toNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toNumber(value, Number.NaN);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Rules as stored, made safe to use.
 *
 * A challenge saved before rules existed has none, and a hand-edited row can
 * hold anything at all. Either way the page has to render, so every field falls
 * back to the Plano Milhão's and a challenge with no bands at all gets one flat
 * band instead of a division by zero.
 */
export function parseRules(raw: unknown, days?: number): ChallengeRules {
  const source = (raw ?? {}) as Partial<ChallengeRules>;

  const bands = Array.isArray(source.stakeBands)
    ? source.stakeBands
        .map((band) => ({
          untilDay:
            band?.untilDay === null || band?.untilDay === undefined
              ? null
              : Math.max(1, Math.round(toNumber(band.untilDay, 1))),
          pct: Math.min(1, Math.max(0.01, toNumber(band?.pct, 0.1))),
        }))
        .sort((a, b) => (a.untilDay ?? Infinity) - (b.untilDay ?? Infinity))
    : [];

  const cycle = Array.isArray(source.oddsPlan?.cycle)
    ? source.oddsPlan!.cycle.map((odd) => toNumber(odd, 1.9)).filter((odd) => odd > 1)
    : [];

  return {
    days: Math.min(365, Math.max(1, Math.round(toNumber(source.days ?? days, MILLION_PLAN_RULES.days)))),
    stakeBands: bands.length > 0 ? bands : [{ untilDay: null, pct: 0.1 }],
    oddsMin: toLimit(source.oddsMin),
    oddsMax: toLimit(source.oddsMax),
    onePerDay: source.onePerDay !== false,
    lossStreakPause:
      source.lossStreakPause === null || source.lossStreakPause === undefined
        ? null
        : Math.max(1, Math.round(toNumber(source.lossStreakPause, 3))),
    oddsPlan: {
      first: toNumber(source.oddsPlan?.first, cycle[0] ?? 1.9),
      cycle: cycle.length > 0 ? cycle : [1.9],
    },
  };
}

/** True when the stored rules are empty, so the challenge predates them. */
export function hasStoredRules(raw: unknown): boolean {
  return Boolean(raw && typeof raw === "object" && Object.keys(raw).length > 0);
}

export function stakePctForDay(rules: ChallengeRules, day: number): number {
  const band =
    rules.stakeBands.find((entry) => entry.untilDay === null || day <= entry.untilDay) ??
    rules.stakeBands[rules.stakeBands.length - 1];
  return band?.pct ?? 0.1;
}

function round(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

/** The stake the rules call for, as a share of what is actually in the bankroll. */
export function plannedStake(rules: ChallengeRules, bankroll: number, day: number): number {
  if (bankroll <= 0) return 0;
  return round(bankroll * stakePctForDay(rules, day));
}

export function plannedOddsForDay(rules: ChallengeRules, day: number): number {
  if (day <= 1) return rules.oddsPlan.first;
  const cycle = rules.oddsPlan.cycle;
  return cycle[(day - 2) % cycle.length];
}

export interface Rung {
  day: number;
  stakePct: number;
  odds: number;
  bankrollStart: number;
  stake: number;
  profit: number;
  bankrollEnd: number;
}

export function buildLadder(rules: ChallengeRules, start: number): Rung[] {
  const ladder: Rung[] = [];
  let bankroll = start;

  for (let day = 1; day <= rules.days; day += 1) {
    const stakePct = stakePctForDay(rules, day);
    const odds = plannedOddsForDay(rules, day);
    const stake = round(bankroll * stakePct);
    const profit = round(stake * (odds - 1));
    const bankrollEnd = round(bankroll + profit);

    ladder.push({ day, stakePct, odds, bankrollStart: bankroll, stake, profit, bankrollEnd });
    bankroll = bankrollEnd;
  }

  return ladder;
}

/**
 * Which rung the bankroll has actually reached.
 *
 * Deliberately not the day count: losing a day does not send you back in time,
 * it sends you back down the ladder, and the gap between the two is the honest
 * answer to "where are we?".
 */
export function rungForBankroll(bankroll: number, ladder: Rung[]): number {
  if (ladder.length === 0 || bankroll < ladder[0].bankrollStart) return 0;
  let rung = 0;
  ladder.forEach((step) => {
    if (bankroll >= step.bankrollStart) rung = step.day;
  });
  return rung;
}

export type ViolationSeverity = "breach" | "note";

export interface Violation {
  code: string;
  severity: ViolationSeverity;
  message: string;
}

export interface BetCheckInput {
  odds: number;
  stake: number;
  bankroll: number;
  day: number;
  betsPlacedToday: number;
  lossStreak: number;
}

/**
 * Everything about a proposed bet the challenge would object to.
 *
 * A breach is the rule being broken; a note is the rule being followed
 * cautiously. Both are shown, neither blocks the bet — these are rules the
 * players agreed to keep, not something the app gets to enforce over them.
 */
export function checkBet(rules: ChallengeRules, input: BetCheckInput): Violation[] {
  const { odds, stake, bankroll, day, betsPlacedToday, lossStreak } = input;
  const violations: Violation[] = [];
  const planned = plannedStake(rules, bankroll, day);

  if (rules.lossStreakPause !== null && lossStreak >= rules.lossStreakPause) {
    violations.push({
      code: "loss-streak",
      severity: "breach",
      message: `${lossStreak} perdas seguidas. O desafio manda parar um dia e reavaliar antes da próxima aposta.`,
    });
  }

  if (rules.onePerDay && betsPlacedToday > 0) {
    violations.push({
      code: "daily-limit",
      severity: "breach",
      message: "Este desafio é uma aposta por dia. Já há uma registada hoje.",
    });
  }

  if (odds > 0 && rules.oddsMin !== null && odds < rules.oddsMin) {
    violations.push({
      code: "odds-low",
      severity: "breach",
      message: `A odd combinada está em ${odds.toFixed(2)}, abaixo do mínimo de ${rules.oddsMin.toFixed(
        2
      )} que o desafio pede.`,
    });
  }

  if (odds > 0 && rules.oddsMax !== null && odds > rules.oddsMax) {
    violations.push({
      code: "odds-high",
      severity: "breach",
      message: `A odd combinada está em ${odds.toFixed(2)}, acima do máximo de ${rules.oddsMax.toFixed(
        2
      )}. Juntar jogos multiplica as odds depressa: para ficar na faixa, cada jogo tem de ser curto.`,
    });
  }

  if (stake > planned + 0.01) {
    violations.push({
      code: "stake-over",
      severity: "breach",
      message: `Acima do desafio: hoje são ${planned.toFixed(2)} € (${(
        stakePctForDay(rules, day) * 100
      ).toFixed(0)}% da banca), não ${stake.toFixed(2)} €.`,
    });
  } else if (stake > 0 && stake < planned - 0.01) {
    violations.push({
      code: "stake-under",
      severity: "note",
      message: `Abaixo do desafio: hoje seriam ${planned.toFixed(
        2
      )} €. Ficas mais atrás na escada, mas arriscas menos.`,
    });
  }

  return violations;
}

/**
 * The chance of the ladder actually being climbed to the end.
 *
 * Every rung needs the bet to land, so the whole thing is one long run of wins
 * and the odds multiply. This is the number a bankroll tool exists to show: the
 * table looks like a schedule, and it is really a parlay.
 */
export function chanceOfCompleting(
  rules: ChallengeRules,
  fromDay: number,
  toDay = rules.days
): number {
  let chance = 1;
  for (let day = Math.max(1, fromDay); day <= toDay; day += 1) {
    chance *= 1 / plannedOddsForDay(rules, day);
  }
  return chance;
}

/** How far down the ladder a single lost day puts you. */
export function costOfOneLoss(
  rules: ChallengeRules,
  bankroll: number,
  day: number,
  ladder: Rung[]
) {
  const stake = plannedStake(rules, bankroll, day);
  const after = round(Math.max(0, bankroll - stake));
  return {
    stake,
    bankrollAfter: after,
    rungBefore: rungForBankroll(bankroll, ladder),
    rungAfter: rungForBankroll(after, ladder),
  };
}

/** The rules in one line, for a card that has no room for a table. */
export function describeRules(rules: ChallengeRules): string {
  const parts: string[] = [`${rules.days} dias`];

  const pcts = [...new Set(rules.stakeBands.map((band) => Math.round(band.pct * 100)))];
  parts.push(
    pcts.length === 1
      ? `${pcts[0]}% da banca`
      : `${pcts[0]}% a descer até ${pcts[pcts.length - 1]}%`
  );

  if (rules.oddsMin !== null || rules.oddsMax !== null) {
    parts.push(
      rules.oddsMin !== null && rules.oddsMax !== null
        ? `odds ${rules.oddsMin.toFixed(2)}–${rules.oddsMax.toFixed(2)}`
        : rules.oddsMin !== null
        ? `odd mínima ${rules.oddsMin.toFixed(2)}`
        : `odd máxima ${rules.oddsMax!.toFixed(2)}`
    );
  } else {
    parts.push("sem limite de odd");
  }

  parts.push(rules.onePerDay ? "uma aposta por dia" : "apostas sem limite diário");

  return parts.join(" · ");
}
