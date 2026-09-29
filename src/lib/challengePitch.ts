import {
  ASSUMED_WIN_RATE,
  expectedGrowth,
  ladderFor,
  type ChallengeTemplate,
} from "@/lib/challengeRules";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export interface ChallengeLine {
  label: string;
  value: string;
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
      value: `${Math.round(target / startingBankroll)}× a banca`,
    },
    { label: "Dias", value: `${rules.days}` },
    {
      label: "Aposta por dia",
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
      label: "Primeira aposta",
      value: first ? eur.format(first.stake) : "—",
    },
    {
      label: "O que custa um dia mau",
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
  const multiple = Math.round(template.target / template.startingBankroll);
  const growth = expectedGrowth(template.rules, ASSUMED_WIN_RATE);

  if (template.longShot) {
    return `Não é um plano, é uma perseguição: ${template.rules.days} dias sem falhar um único. Se sair, conta-se durante anos. Quase sempre não sai.`;
  }

  if (Number.isFinite(growth) && growth > 0) {
    return `Multiplicar por ${multiple} sem nunca arriscar o suficiente para uma má semana acabar com tudo. É o tipo de desafio que se pode perder e recomeçar na mesma banca.`;
  }

  return `Multiplicar por ${multiple} em ${template.rules.days} dias.`;
}
