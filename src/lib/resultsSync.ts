import { buildApiUrl } from "@/lib/apiConfig";
import { isGreenMarket } from "@/lib/modelAudit";
import { getAnalysisTrackingEntries } from "@/lib/analysisStorage";
import type { FixtureScoreUpdate } from "@/lib/analysisStorage";
import type { SavedAnalysis } from "@/types/analysis";

export interface FixtureResult {
  fixture_id: number;
  status: string;
  finished: boolean;
  home_goals: number | null;
  away_goals: number | null;
  kickoff: string | null;
  home_name: string | null;
  away_name: string | null;
}

export interface SettlementPreview {
  analysisId: string;
  betId: string;
  match: string;
  market: string;
  score: string;
  stake: number;
  odd: number;
  resultStatus: "green" | "red";
  profitLoss: number;
}

export interface ResultsPlan {
  /** Final scores to record against the analysis (no money changes hands). */
  scores: FixtureScoreUpdate[];
  /** Placed bets the final score settles, ready for the user to confirm. */
  settlements: SettlementPreview[];
  /** Placed bets on markets a final score cannot decide (corners, cards...). */
  manual: { match: string; market: string }[];
  /** Fixtures looked up that have already been played. */
  finished: number;
  /** Fixtures looked up that are still to be played. */
  pending: number;
}

const EMPTY_PLAN: ResultsPlan = {
  scores: [],
  settlements: [],
  manual: [],
  finished: 0,
  pending: 0,
};

function hasPlacedPendingBet(analysis: SavedAnalysis): boolean {
  return getAnalysisTrackingEntries(analysis).some(
    (entry) => entry.tracking.betPlaced && entry.tracking.resultStatus === "pending"
  );
}

/**
 * Analyses that are linked to a fixture and still waiting on something: the
 * final score, or the settlement of a bet that was actually placed.
 */
export function analysesAwaitingResults(analyses: SavedAnalysis[]): SavedAnalysis[] {
  return analyses.filter(
    (analysis) =>
      analysis.fixture?.id &&
      (!analysis.modelAudit || hasPlacedPendingBet(analysis))
  );
}

export async function fetchFixtureResults(
  analyses: SavedAnalysis[]
): Promise<{ results: Map<number, FixtureResult>; unavailable: string[] }> {
  const byLeague = new Map<string, Set<number>>();

  analyses.forEach((analysis) => {
    const fixture = analysis.fixture;
    if (!fixture?.id || !fixture.league) return;
    if (!byLeague.has(fixture.league)) byLeague.set(fixture.league, new Set());
    byLeague.get(fixture.league)!.add(fixture.id);
  });

  const results = new Map<number, FixtureResult>();
  const unavailable: string[] = [];

  // One request per competition, all of it answered from the backend's cached
  // season, so a full history costs at most eight lookups.
  await Promise.all(
    [...byLeague.entries()].map(async ([league, ids]) => {
      try {
        const response = await fetch(
          buildApiUrl(
            `/data/results?league=${encodeURIComponent(league)}&fixture_ids=${[
              ...ids,
            ].join(",")}`
          )
        );
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json();
        (data?.results ?? []).forEach((result: FixtureResult) => {
          results.set(result.fixture_id, result);
        });
      } catch {
        unavailable.push(league);
      }
    })
  );

  return { results, unavailable };
}

export function buildResultsPlan(
  analyses: SavedAnalysis[],
  results: Map<number, FixtureResult>
): ResultsPlan {
  if (results.size === 0) return EMPTY_PLAN;

  const plan: ResultsPlan = {
    scores: [],
    settlements: [],
    manual: [],
    finished: 0,
    pending: 0,
  };

  analyses.forEach((analysis) => {
    const fixtureId = analysis.fixture?.id;
    if (!fixtureId) return;

    const result = results.get(fixtureId);
    if (!result) return;

    if (
      !result.finished ||
      result.home_goals === null ||
      result.away_goals === null
    ) {
      plan.pending += 1;
      return;
    }

    plan.finished += 1;

    const homeGoals = result.home_goals;
    const awayGoals = result.away_goals;
    const score = `${homeGoals}-${awayGoals}`;
    const match = `${analysis.homeTeam} vs ${analysis.awayTeam}`;

    const storedScore = analysis.modelAudit;
    if (
      !storedScore ||
      storedScore.homeGoals !== homeGoals ||
      storedScore.awayGoals !== awayGoals
    ) {
      plan.scores.push({ analysisId: analysis.id, homeGoals, awayGoals });
    }

    getAnalysisTrackingEntries(analysis).forEach((entry) => {
      const { tracking } = entry;
      if (!tracking.betPlaced || tracking.resultStatus !== "pending") return;

      const market = tracking.selectedMarket;
      if (!market) return;

      const green = isGreenMarket(market, homeGoals, awayGoals);
      if (green === null) {
        plan.manual.push({ match, market });
        return;
      }

      const stake = tracking.stakeUsed ?? 0;
      const odd = tracking.oddUsed ?? 0;

      plan.settlements.push({
        analysisId: analysis.id,
        betId: entry.betId,
        match,
        market,
        score,
        stake,
        odd,
        resultStatus: green ? "green" : "red",
        profitLoss: green ? stake * (odd - 1) : -stake,
      });
    });
  });

  return plan;
}
