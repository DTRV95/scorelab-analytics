export interface BankrollSimulationInput {
  currentBankroll: number;
  targetBankroll: number;
  daysRemaining: number;
  dailyStakeCap: number;
  dailyProfitTarget: number;
  hitRatePct: number;
  averageOdds: number;
  simulations?: number;
}

export interface BankrollSimulationResult {
  simulations: number;
  successRatePct: number;
  medianFinalBankroll: number;
  p10FinalBankroll: number;
  p90FinalBankroll: number;
  expectedFinalBankroll: number;
  medianMaxDrawdownPct: number;
  worstLikelyDrawdownPct: number;
  riskOfRuinPct: number;
  daysToTargetMedian: number | null;
  recommendation: {
    label: "Proceed" | "Reduce Risk" | "Extend Plan" | "No Edge";
    tone: "positive" | "neutral" | "negative";
    detail: string;
  };
}

const DEFAULT_SIMULATIONS = 1000;
const RISK_OF_RUIN_FLOOR_PCT = 55;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

function quantile(sortedValues: number[], percentile: number) {
  if (!sortedValues.length) return 0;
  const index = clamp(
    Math.floor((sortedValues.length - 1) * percentile),
    0,
    sortedValues.length - 1
  );
  return sortedValues[index];
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function getRecommendation({
  successRatePct,
  worstLikelyDrawdownPct,
  riskOfRuinPct,
  averageOdds,
  hitRatePct,
}: {
  successRatePct: number;
  worstLikelyDrawdownPct: number;
  riskOfRuinPct: number;
  averageOdds: number;
  hitRatePct: number;
}): BankrollSimulationResult["recommendation"] {
  const breakEvenHitRate = averageOdds > 1 ? (1 / averageOdds) * 100 : 100;

  if (hitRatePct <= breakEvenHitRate) {
    return {
      label: "No Edge",
      tone: "negative",
      detail: "The historical hit rate is not above the break-even rate for these odds.",
    };
  }

  if (successRatePct >= 70 && worstLikelyDrawdownPct <= 25 && riskOfRuinPct <= 12) {
    return {
      label: "Proceed",
      tone: "positive",
      detail: "The mission has a healthy simulated success profile at the current risk level.",
    };
  }

  if (successRatePct >= 45 && worstLikelyDrawdownPct <= 38) {
    return {
      label: "Reduce Risk",
      tone: "neutral",
      detail: "The path is possible, but the drawdown profile asks for tighter execution.",
    };
  }

  return {
    label: "Extend Plan",
    tone: "negative",
    detail: "The target is too compressed for the current edge and bankroll volatility.",
  };
}

export function simulateBankrollMission(
  input: BankrollSimulationInput
): BankrollSimulationResult {
  const currentBankroll = Math.max(0, input.currentBankroll);
  const targetBankroll = Math.max(0, input.targetBankroll);
  const daysRemaining = Math.max(1, Math.round(input.daysRemaining));
  const dailyStakeCap = Math.max(0, input.dailyStakeCap);
  const dailyProfitTarget = Math.max(0, input.dailyProfitTarget);
  const hitRate = clamp(input.hitRatePct / 100, 0.05, 0.95);
  const averageOdds = clamp(input.averageOdds, 1.2, 6);
  const simulations = Math.max(250, Math.round(input.simulations ?? DEFAULT_SIMULATIONS));

  if (currentBankroll <= 0 || targetBankroll <= currentBankroll || dailyStakeCap <= 0) {
    return {
      simulations,
      successRatePct: targetBankroll <= currentBankroll ? 100 : 0,
      medianFinalBankroll: roundTo(currentBankroll),
      p10FinalBankroll: roundTo(currentBankroll),
      p90FinalBankroll: roundTo(currentBankroll),
      expectedFinalBankroll: roundTo(currentBankroll),
      medianMaxDrawdownPct: 0,
      worstLikelyDrawdownPct: 0,
      riskOfRuinPct: currentBankroll <= 0 ? 100 : 0,
      daysToTargetMedian: targetBankroll <= currentBankroll ? 0 : null,
      recommendation: {
        label: targetBankroll <= currentBankroll ? "Proceed" : "No Edge",
        tone: targetBankroll <= currentBankroll ? "positive" : "negative",
        detail:
          targetBankroll <= currentBankroll
            ? "The target is already reached."
            : "Define bankroll and mission capacity before simulating the path.",
      },
    };
  }

  const rng = createSeededRandom(
    Math.round(currentBankroll * 100) ^
      Math.round(targetBankroll * 100) ^
      Math.round(hitRate * 10000) ^
      daysRemaining
  );
  const finals: number[] = [];
  const maxDrawdowns: number[] = [];
  const targetDays: number[] = [];
  let successes = 0;
  let ruinCount = 0;
  let finalBankrollSum = 0;

  for (let simulation = 0; simulation < simulations; simulation += 1) {
    let bankroll = currentBankroll;
    let peak = currentBankroll;
    let maxDrawdownPct = 0;
    let targetDay: number | null = null;

    for (let day = 1; day <= daysRemaining; day += 1) {
      const stake = Math.min(
        dailyStakeCap,
        bankroll,
        dailyProfitTarget > 0 ? dailyProfitTarget / Math.max(0.01, averageOdds - 1) : dailyStakeCap
      );

      if (stake <= 0) break;

      const won = rng() < hitRate;
      bankroll += won ? stake * (averageOdds - 1) : -stake;
      peak = Math.max(peak, bankroll);
      maxDrawdownPct = Math.min(
        maxDrawdownPct,
        peak > 0 ? ((bankroll - peak) / peak) * 100 : 0
      );

      if (targetDay === null && bankroll >= targetBankroll) {
        targetDay = day;
      }

      if (bankroll <= currentBankroll * (RISK_OF_RUIN_FLOOR_PCT / 100)) {
        ruinCount += 1;
        break;
      }
    }

    if (bankroll >= targetBankroll) {
      successes += 1;
      if (targetDay !== null) targetDays.push(targetDay);
    }

    finals.push(bankroll);
    maxDrawdowns.push(Math.abs(maxDrawdownPct));
    finalBankrollSum += bankroll;
  }

  finals.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);
  targetDays.sort((a, b) => a - b);

  const successRatePct = (successes / simulations) * 100;
  const riskOfRuinPct = (ruinCount / simulations) * 100;
  const worstLikelyDrawdownPct = quantile(maxDrawdowns, 0.9);
  const medianTargetDay =
    targetDays.length > 0 ? Math.round(quantile(targetDays, 0.5)) : null;

  return {
    simulations,
    successRatePct: roundTo(successRatePct),
    medianFinalBankroll: roundTo(quantile(finals, 0.5)),
    p10FinalBankroll: roundTo(quantile(finals, 0.1)),
    p90FinalBankroll: roundTo(quantile(finals, 0.9)),
    expectedFinalBankroll: roundTo(finalBankrollSum / simulations),
    medianMaxDrawdownPct: roundTo(quantile(maxDrawdowns, 0.5)),
    worstLikelyDrawdownPct: roundTo(worstLikelyDrawdownPct),
    riskOfRuinPct: roundTo(riskOfRuinPct),
    daysToTargetMedian: medianTargetDay,
    recommendation: getRecommendation({
      successRatePct,
      worstLikelyDrawdownPct,
      riskOfRuinPct,
      averageOdds,
      hitRatePct: hitRate * 100,
    }),
  };
}
