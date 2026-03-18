export type RiskLevel = "Low" | "Medium" | "High";
export type DecisionType = "Bet" | "No Bet" | "Caution";
export type BetStatus = "pending" | "green" | "red" | "void";

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
}

export interface AnalysisSummary {
  homeXg: number;
  awayXg: number;
  totalXg: number;
  confidence: number;
}

export interface TrackedBet {
  betPlaced: boolean;
  selectedMarket: string | null;
  stakeUsed: number | null;
  oddUsed: number | null;
  resultStatus: BetStatus;
  profitLoss: number;
  bankrollBefore: number | null;
  bankrollAfter: number | null;
  notes: string;
}

export interface SavedAnalysis {
  id: string;
  createdAt: string;
  homeTeam: string;
  awayTeam: string;
  summary: AnalysisSummary;
  results: AnalysisResult[];
  tracking: TrackedBet;
}