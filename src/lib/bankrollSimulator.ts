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
  hitRatePct: number;
  averageOdds: number;
  breakEvenHitRatePct: number;
  edgeGapPct: number;
  successRatePct: number;
  rawSuccessRatePct: number;
  planFeasibilityPct: number;
  dailyProfitCoveragePct: number;
  targetGapCoveragePct: number;
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
    explanation: string;
    actions: string[];
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
      explanation:
        "At this average odd, the system needs a higher hit rate just to avoid losing money over time.",
      actions: [
        "Only take picks with stronger odds or stronger calibrated probability.",
        "Lower today's profit target or extend the mission deadline.",
        "Do not force volume until the simulator shows a positive edge.",
      ],
    };
  }

  if (successRatePct >= 70 && worstLikelyDrawdownPct <= 25 && riskOfRuinPct <= 12) {
    return {
      label: "Proceed",
      tone: "positive",
      detail: "The mission has a healthy simulated success profile at the current risk level.",
      explanation:
        "The current hit rate is above break-even and most simulated paths can reach the target without excessive drawdown.",
      actions: [
        "Execute only the best radar picks that fit today's stake needed.",
        "Keep exposure inside the daily cap.",
        "Stop once the daily profit target is reached.",
      ],
    };
  }

  if (successRatePct >= 45 && worstLikelyDrawdownPct <= 38) {
    return {
      label: "Reduce Risk",
      tone: "neutral",
      detail: "The path is possible, but the drawdown profile asks for tighter execution.",
      explanation:
        "The edge exists, but the mission is sensitive to variance and can become unstable after a short losing run.",
      actions: [
        "Use smaller stake than the daily cap unless the pick is premium.",
        "Prefer higher-confidence singles over multiples.",
        "Skip the day if no radar pick clears the probability filter.",
      ],
    };
  }

  return {
    label: "Extend Plan",
    tone: "negative",
    detail: "The target is too compressed for the current edge and bankroll volatility.",
    explanation:
      "The simulated paths need more time or less daily pressure to avoid forcing bad bets.",
    actions: [
      "Increase the number of mission days.",
      "Reduce the target amount for this mission.",
      "Wait for stronger value radar opportunities before staking.",
    ],
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
  const breakEvenHitRatePct = averageOdds > 1 ? (1 / averageOdds) * 100 : 100;
  const edgeGapPct = hitRate * 100 - breakEvenHitRatePct;
  const targetGap = Math.max(0, targetBankroll - currentBankroll);
  const maxDailyProfit = dailyStakeCap * Math.max(0, averageOdds - 1);
  const dailyProfitCoveragePct =
    dailyProfitTarget <= 0
      ? 100
      : clamp((maxDailyProfit / dailyProfitTarget) * 100, 0, 100);
  const targetGapCoveragePct =
    targetGap <= 0
      ? 100
      : clamp(((maxDailyProfit * daysRemaining) / targetGap) * 100, 0, 100);
  const edgeFeasibilityPct =
    edgeGapPct >= 0
      ? clamp(55 + edgeGapPct * 8, 0, 100)
      : clamp(45 + edgeGapPct * 4, 0, 100);
  const planFeasibilityPct = Math.min(
    dailyProfitCoveragePct,
    targetGapCoveragePct,
    edgeFeasibilityPct
  );

  if (currentBankroll <= 0 || targetBankroll <= currentBankroll || dailyStakeCap <= 0) {
    const baseSuccessRatePct = targetBankroll <= currentBankroll ? 100 : 0;
    return {
      simulations,
      hitRatePct: roundTo(hitRate * 100),
      averageOdds: roundTo(averageOdds),
      breakEvenHitRatePct: roundTo(breakEvenHitRatePct),
      edgeGapPct: roundTo(edgeGapPct),
      successRatePct: baseSuccessRatePct,
      rawSuccessRatePct: baseSuccessRatePct,
      planFeasibilityPct: roundTo(planFeasibilityPct),
      dailyProfitCoveragePct: roundTo(dailyProfitCoveragePct),
      targetGapCoveragePct: roundTo(targetGapCoveragePct),
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
        explanation:
          targetBankroll <= currentBankroll
            ? "No extra execution is needed for this mission."
            : "The simulator needs a valid bankroll and stake cap to produce useful guidance.",
        actions:
          targetBankroll <= currentBankroll
            ? ["Protect the bankroll.", "Close or archive the mission.", "Start a new mission only if the edge is clear."]
            : ["Set a bankroll baseline.", "Define the target and deadline.", "Run the simulator again before staking."],
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
  const calibratedSuccessRatePct = Math.min(successRatePct, planFeasibilityPct);
  const medianTargetDay =
    targetDays.length > 0 ? Math.round(quantile(targetDays, 0.5)) : null;

  return {
    simulations,
    hitRatePct: roundTo(hitRate * 100),
    averageOdds: roundTo(averageOdds),
    breakEvenHitRatePct: roundTo(breakEvenHitRatePct),
    edgeGapPct: roundTo(edgeGapPct),
    successRatePct: roundTo(calibratedSuccessRatePct),
    rawSuccessRatePct: roundTo(successRatePct),
    planFeasibilityPct: roundTo(planFeasibilityPct),
    dailyProfitCoveragePct: roundTo(dailyProfitCoveragePct),
    targetGapCoveragePct: roundTo(targetGapCoveragePct),
    medianFinalBankroll: roundTo(quantile(finals, 0.5)),
    p10FinalBankroll: roundTo(quantile(finals, 0.1)),
    p90FinalBankroll: roundTo(quantile(finals, 0.9)),
    expectedFinalBankroll: roundTo(finalBankrollSum / simulations),
    medianMaxDrawdownPct: roundTo(quantile(maxDrawdowns, 0.5)),
    worstLikelyDrawdownPct: roundTo(worstLikelyDrawdownPct),
    riskOfRuinPct: roundTo(riskOfRuinPct),
    daysToTargetMedian: medianTargetDay,
    recommendation: getRecommendation({
      successRatePct: calibratedSuccessRatePct,
      worstLikelyDrawdownPct,
      riskOfRuinPct,
      averageOdds,
      hitRatePct: hitRate * 100,
    }),
  };
}
