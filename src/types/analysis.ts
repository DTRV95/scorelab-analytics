export type RiskLevel = "Low" | "Medium" | "High";
export type DecisionType = "Bet" | "No Bet" | "Caution";
export type BetStatus = "pending" | "green" | "red" | "void";
export type BetTier = "discard" | "watchlist" | "bet" | "elite" | "premium";

export interface AnalysisResult {
  market: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  valueBet: number;
  kelly: number;
  stake: number;
  risk: RiskLevel;
  confidence: number;
  decision: DecisionType;
  tier?: BetTier;
  eliteScore?: number;
  expectedValue?: number;
  oddsBand?: string;
  marketFamily?: string;
  baseConfidence?: number;
  adjustedConfidence?: number;
  historicalAdjustment?: number;
  historicalSample?: number;
  historicalRoi?: number;
  historicalHitRate?: number;
}

export interface AnalysisSummary {
  homeXg: number;
  awayXg: number;
  totalXg: number;
  confidence: number;
}

export interface TrackedBet {
  id?: string;
  betPlaced: boolean;
  selectedMarket: string | null;
  stakeUsed: number | null;
  oddUsed: number | null;
  resultStatus: BetStatus;
  placedAt?: string | null;
  settledAt?: string | null;
  profitLoss: number;
  bankrollBefore: number | null;
  bankrollAfter: number | null;
  qualityScore?: number | null;
  qualityLabel?: "Premium" | "Approved" | "Caution" | "Avoid" | "Incomplete" | null;
  qualityTone?: "positive" | "neutral" | "negative" | null;
  qualitySummary?: string | null;
  qualitySnapshotAt?: string | null;
  decisionMemory?: {
    market: string;
    modelProb: number;
    impliedProb: number;
    edge: number;
    confidence: number;
    odds: number;
    risk: RiskLevel;
    decision: DecisionType;
    tier?: BetTier;
    qualityScore: number;
    qualityLabel: NonNullable<TrackedBet["qualityLabel"]>;
    capturedAt: string;
  } | null;
  postBetTruth?: {
    verdict:
      | "Good Decision"
      | "Bad Win"
      | "Bad Decision"
      | "Validated Edge"
      | "Neutral Outcome"
      | "Pending";
    tone: "positive" | "neutral" | "negative";
    summary: string;
    lesson: string;
    generatedAt: string;
  } | null;
  notes: string;
}

export interface TrackedAnalysisBet extends TrackedBet {
  id: string;
}

export interface SavedAnalysis {
  id: string;
  createdAt: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  summary: AnalysisSummary;
  results: AnalysisResult[];
  tracking: TrackedBet;
  extraBets?: TrackedAnalysisBet[];
}

export interface MultipleLeg {
  analysisId: string;
  homeTeam: string;
  awayTeam: string;
  match: string;
  market: string;
  odds: number;
  modelProb: number;
  impliedProb: number;
  valueBet: number;
  confidence: number;
  risk: RiskLevel;
  tier: BetTier;
}

export interface MultipleTracking {
  betPlaced: boolean;
  stakeUsed: number | null;
  oddUsed: number | null;
  resultStatus: BetStatus;
  placedAt?: string | null;
  settledAt?: string | null;
  profitLoss: number;
  bankrollBefore: number | null;
  bankrollAfter: number | null;
  notes: string;
}

export interface MultipleBet {
  id: string;
  createdAt: string;
  legs: MultipleLeg[];
  combinedOdds: number;
  combinedModelProb: number;
  combinedImpliedProb: number;
  combinedEdge: number;
  adjustedConfidence: number;
  correlationScore: number;
  correlationLevel: "Low" | "Medium" | "High";
  correlationReasons: string[];
  recommendedStakePct: number;
  recommendedStakeAmount: number;
  tracking: MultipleTracking;
}
