import { getKellyPct } from "@/lib/calibrationEngine";
import type { BoardMatch } from "@/lib/probabilityBoardCache";
import type {
  AnalysisResult,
  DecisionType,
  RiskLevel,
  SavedAnalysis,
} from "@/types/analysis";

export interface BoardBetInput {
  match: BoardMatch;
  market: string;
  odds: number;
  stake: number;
  bankroll: number | null;
}

function roundTo(value: number, decimals = 2) {
  return Number(value.toFixed(decimals));
}

/** Edge: how much more likely the model thinks this is than the price says. */
export function edgeFor(modelProb: number, odds: number): number {
  if (odds <= 1) return 0;
  return roundTo(modelProb - 100 / odds);
}

/**
 * A stake the bankroll can absorb: quarter Kelly, which is what every other
 * suggestion in the app uses. Returns 0 when there is no edge to back.
 */
export function suggestStake(
  modelProb: number,
  odds: number,
  bankroll: number | null
): number {
  if (!bankroll || bankroll <= 0) return 0;
  const kellyPct = getKellyPct(modelProb, odds);
  return roundTo((bankroll * kellyPct) / 100);
}

function decisionFor(edge: number): DecisionType {
  if (edge >= 3) return "Bet";
  if (edge > 0) return "Caution";
  return "No Bet";
}

function riskFor(odds: number): RiskLevel {
  if (odds <= 1.8) return "Low";
  if (odds <= 3) return "Medium";
  return "High";
}

/**
 * Turns a forecast row plus a bookmaker price into a tracked bet.
 *
 * The fixture reference is the point of this: with `fixture.id` and
 * `fixture.league` set, the existing results sync finds the final score and
 * settles the bet green or red on its own. Without it the bet would sit
 * pending forever and need settling by hand.
 *
 * Edge and Kelly are computed rather than left at zero, because the radar and
 * the performance breakdowns read those fields — storing zeros would quietly
 * drag every average toward nothing.
 */
export function buildBetFromBoard({
  match,
  market,
  odds,
  stake,
  bankroll,
}: BoardBetInput): SavedAnalysis {
  const forecast = match.mercados.find((m) => m.mercado === market);
  const modelProb = forecast?.probabilidade_pct ?? 0;
  const impliedProb = odds > 1 ? roundTo(100 / odds) : 0;
  const edge = edgeFor(modelProb, odds);
  // The sample confidence the board already carries, on the app's 0-10 scale.
  const confidence = roundTo((match.amostra_pct ?? 0) / 10, 1);
  const placedAt = new Date().toISOString();

  const result: AnalysisResult = {
    market,
    odds: roundTo(odds),
    modelProb: roundTo(modelProb, 1),
    impliedProb,
    valueBet: edge,
    kelly: getKellyPct(modelProb, odds),
    stake: roundTo(stake),
    risk: riskFor(odds),
    confidence,
    decision: decisionFor(edge),
  };

  return {
    id: `board-${match.fixture_id}-${Date.now()}`,
    createdAt: placedAt,
    homeTeam: match.home_name,
    awayTeam: match.away_name,
    league: match.league,
    fixture: {
      id: match.fixture_id,
      league: match.league,
      kickoff: match.kickoff,
    },
    summary: {
      homeXg: match.lambda_casa,
      awayXg: match.lambda_fora,
      totalXg: match.total_golos_esperados,
      confidence,
    },
    results: [result],
    modelAudit: null,
    tracking: {
      id: "primary",
      betPlaced: true,
      selectedMarket: market,
      stakeUsed: roundTo(stake),
      oddUsed: roundTo(odds),
      resultStatus: "pending",
      placedAt,
      settledAt: null,
      profitLoss: 0,
      bankrollBefore: bankroll,
      bankrollAfter: null,
      qualityScore: null,
      qualityLabel: null,
      qualityTone: null,
      qualitySummary: null,
      qualitySnapshotAt: null,
      decisionMemory: null,
      postBetTruth: null,
      notes: "",
    },
    extraBets: [],
  };
}
