import { getKellyPct } from "@/lib/calibrationEngine";
import type { MultipleLeg } from "@/lib/multipleStorage";
import type { BoardMatch } from "@/lib/probabilityBoardCache";
import type {
  AnalysisResult,
  BetTier,
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

export interface BoardSelection {
  match: BoardMatch;
  market: string;
  odds: number;
}

/**
 * The id a board selection stands under in a multiple.
 *
 * Two selections from the same game share it, which is what the correlation
 * check keys on — a multiple built from two markets of one match should be
 * flagged, not counted as two independent bets.
 */
export function boardLegId(fixtureId: number): string {
  return `board-${fixtureId}`;
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

/**
 * A board selection has no elite-system grading behind it, so it earns the
 * tier its edge justifies and nothing more — never "elite", which elsewhere
 * means a selection that cleared the full screen.
 */
function tierFor(edge: number): BetTier {
  if (edge >= 3) return "bet";
  if (edge > 0) return "watchlist";
  return "discard";
}

function riskFor(odds: number): RiskLevel {
  if (odds <= 1.8) return "Low";
  if (odds <= 3) return "Medium";
  return "High";
}

/**
 * Turns a forecast row plus a price into one leg of a multiple.
 *
 * It carries the fixture for the same reason a single does: that reference is
 * what lets the final score close the leg without anyone opening the app.
 */
export function buildLegFromBoard({
  match,
  market,
  odds,
}: BoardSelection): MultipleLeg {
  const forecast = match.mercados.find((m) => m.mercado === market);
  const modelProb = forecast?.probabilidade_pct ?? 0;
  const edge = edgeFor(modelProb, odds);

  return {
    analysisId: boardLegId(match.fixture_id),
    homeTeam: match.home_name,
    awayTeam: match.away_name,
    match: `${match.home_name} vs ${match.away_name}`,
    market,
    odds: roundTo(odds),
    modelProb: roundTo(modelProb),
    impliedProb: odds > 1 ? roundTo(100 / odds) : 0,
    valueBet: edge,
    confidence: roundTo((match.amostra_pct ?? 0) / 10, 1),
    risk: riskFor(odds),
    tier: tierFor(edge),
    resultStatus: "pending",
    fixture: {
      id: match.fixture_id,
      league: match.league,
      kickoff: match.kickoff,
    },
  };
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
    tier: tierFor(edge),
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
