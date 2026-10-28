import {
  ASSUMED_WIN_RATE,
  CHALLENGE_TEMPLATES,
  describeRules,
  expectedGrowth,
  ladderFor,
  type ChallengeRules,
  type ChallengeTemplate,
} from "@/lib/challengeRules";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/**
 * Quantas vezes a banca, escrito como quem o diz.
 *
 * 100000× é um número que ninguém lê de relance e 100 000× é. E abaixo
 * de dez a casa decimal faz falta: um desafio de 50 € para 75 € não
 * multiplica por 2, e arredondá-lo para lá é prometer vinte e cinco
 * euros que não estão no plano.
 */
function multiple(times: number): string {
  if (times < 10) {
    return times
      .toFixed(1)
      .replace(/[.,]0$/, "")
      .replace(".", ",");
  }
  return Math.round(times).toLocaleString("pt-PT");
}

export interface ChallengeLine {
  label: string;
  value: string;
  /**
   * A phrase rather than a figure, so it needs the whole row.
   *
   * Measured on a 360px phone: in half a row these were the two that got cut
   * off mid-word, and they are the two somebody most needs to read.
   */
  wide?: boolean;
}

/**
 * The numbers somebody wants before starting, worked out from the rules.
 *
 * Written rather than stored, so a challenge whose rules change cannot keep
 * advertising the old ones. Everything here comes out of the same ladder the
 * challenge is actually played on.
 */
export function challengeLines(template: ChallengeTemplate): ChallengeLine[] {
  const { rules, startingBankroll, target } = template;
  const ladder = ladderFor(rules, startingBankroll);
  const first = ladder[0];
  const pcts = [...new Set(rules.stakeBands.map((band) => band.pct))];

  return [
    {
      label: "Objetivo",
      value: `${eur.format(startingBankroll)} → ${eur.format(target)}`,
    },
    {
      label: "Quanto multiplica",
      value: `${multiple(target / startingBankroll)}× a banca`,
    },
    { label: "Níveis", value: `${rules.days}` },
    {
      label: "Aposta por nível",
      wide: true,
      value:
        pcts.length === 1
          ? `${Math.round(pcts[0] * 100)}% da banca`
          : `${Math.round(pcts[0] * 100)}% a descer até ${Math.round(
              pcts[pcts.length - 1] * 100
            )}%`,
    },
    {
      label: "Odd pedida",
      value:
        rules.oddsMin && rules.oddsMax
          ? `${rules.oddsMin.toFixed(2)} a ${rules.oddsMax.toFixed(2)}`
          : rules.oddsMin
            ? `${rules.oddsMin.toFixed(2)} ou mais`
            : "a que quiseres",
    },
    {
      label: "Jogos por boletim",
      value:
        rules.maxLegs === 1
          ? "um só"
          : rules.maxLegs
            ? `até ${rules.maxLegs}`
            : "sem limite",
    },
    {
      label: "Primeira aposta",
      value: first ? eur.format(first.stake) : "—",
    },
    {
      label: "O que custa um nível mau",
      wide: true,
      value: first
        ? `${eur.format(first.stake)} e um degrau abaixo`
        : "um degrau abaixo",
    },
  ];
}

/**
 * Why somebody would want to do this one, in a sentence.
 *
 * Honest on both sides: the planned challenges are sold on compounding, the
 * long shots on the chase, and neither pretends to be the other.
 */
export function challengePitch(template: ChallengeTemplate): string {
  const times = multiple(template.target / template.startingBankroll);
  const growth = expectedGrowth(template.rules, ASSUMED_WIN_RATE);

  if (template.longShot) {
    return `Não é um plano, é uma perseguição: ${template.rules.days} níveis sem falhar um único. Se sair, conta-se durante anos. Quase sempre não sai.`;
  }

  if (Number.isFinite(growth) && growth > 0) {
    return `Multiplicar por ${times} sem nunca arriscar o suficiente para uma má semana acabar com tudo. É o tipo de desafio que se pode perder e recomeçar na mesma banca.`;
  }

  return `Multiplicar por ${times} em ${template.rules.days} níveis.`;
}

export interface ChallengeIntro {
  /** What this challenge is, in a sentence. */
  sentence: string;
  /** Its terms in one line: the money, the levels, the stake, the odds. */
  terms: string;
}

/**
 * What somebody is getting into, said on the way in.
 *
 * Read off the challenge as it actually stands and not off the model it was
 * copied from: the bankroll, the target and the rules can all be changed
 * after it starts, and a description that kept advertising the model would be
 * describing a challenge nobody is playing.
 *
 * The model is still asked one thing — whether it is a chase rather than a
 * plan — because that is a judgement about the shape of the thing, not a
 * figure that can be read off it.
 */
export function challengeIntro({
  startingBankroll,
  target,
  rules,
  templateKey,
}: {
  startingBankroll: number;
  target: number;
  rules: ChallengeRules;
  templateKey?: string | null;
}): ChallengeIntro {
  const template = CHALLENGE_TEMPLATES.find((entry) => entry.key === templateKey);

  return {
    sentence: challengePitch({
      key: templateKey ?? "proprio",
      name: "",
      blurb: "",
      startingBankroll,
      target,
      rules,
      longShot: template?.longShot,
    }),
    terms: `${eur.format(startingBankroll)} → ${eur.format(target)} · ${describeRules(rules)}`,
  };
}
