import { buildApiUrl } from "@/lib/apiConfig";
import { isGreenMarket } from "@/lib/modelAudit";
import { getAnalysisTrackingEntries } from "@/lib/analysisStorage";
import type { FixtureScoreUpdate } from "@/lib/analysisStorage";
import type { MultipleBet } from "@/lib/multipleStorage";
import type { SavedAnalysis } from "@/types/analysis";

/** A fixture to look up: the competition is what the lookup is keyed by. */
export interface FixtureRef {
  id: number;
  league: string;
}

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

export interface MultipleLegSettlement {
  analysisId: string;
  market: string;
  resultStatus: "green" | "red";
}

export interface MultipleSettlementPreview {
  multipleId: string;
  /** "FC Porto vs SL Benfica + 2 jogos", for naming it in one line. */
  label: string;
  legCount: number;
  legs: MultipleLegSettlement[];
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
  /** Placed multiples every leg of which the final scores decide. */
  multiples: MultipleSettlementPreview[];
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
  multiples: [],
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

/**
 * Multiples still waiting on a result: placed, unsettled, and with at least one
 * leg that knows which fixture it came from. A multiple whose legs were built
 * from saved analyses carries no fixture and is settled by hand as before.
 */
export function multiplesAwaitingResults(multiples: MultipleBet[]): MultipleBet[] {
  return multiples.filter(
    (bet) =>
      bet.tracking.betPlaced &&
      bet.tracking.resultStatus === "pending" &&
      bet.legs.some((leg) => leg.fixture?.id && leg.fixture.league)
  );
}

export function fixtureRefs(
  analyses: SavedAnalysis[],
  multiples: MultipleBet[] = []
): FixtureRef[] {
  const refs = new Map<number, FixtureRef>();

  const add = (fixture?: { id: number; league: string } | null) => {
    if (!fixture?.id || !fixture.league) return;
    refs.set(fixture.id, { id: fixture.id, league: fixture.league });
  };

  analyses.forEach((analysis) => add(analysis.fixture));
  multiples.forEach((bet) => bet.legs.forEach((leg) => add(leg.fixture)));

  return [...refs.values()];
}

export async function fetchFixtureResults(
  refs: FixtureRef[]
): Promise<{ results: Map<number, FixtureResult>; unavailable: string[] }> {
  const byLeague = new Map<string, Set<number>>();

  refs.forEach((fixture) => {
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

function finalScore(
  results: Map<number, FixtureResult>,
  fixtureId?: number | null
): { homeGoals: number; awayGoals: number } | null {
  if (!fixtureId) return null;
  const result = results.get(fixtureId);
  if (!result?.finished) return null;
  if (result.home_goals === null || result.away_goals === null) return null;
  return { homeGoals: result.home_goals, awayGoals: result.away_goals };
}

/**
 * Multiples the final scores close, whole.
 *
 * A multiple is all-or-nothing, so it is only offered for settlement once
 * every leg is decided: one leg still to be played, or on a market a score
 * cannot decide, leaves the whole bet pending. A single red leg is enough to
 * lose it, but the losing leg is recorded alongside the rest rather than on
 * its own, so the bet reads as what happened.
 */
export function buildMultipleSettlements(
  multiples: MultipleBet[],
  results: Map<number, FixtureResult>
): MultipleSettlementPreview[] {
  const previews: MultipleSettlementPreview[] = [];

  multiplesAwaitingResults(multiples).forEach((bet) => {
    const legs: MultipleLegSettlement[] = [];

    for (const leg of bet.legs) {
      if (leg.resultStatus === "green" || leg.resultStatus === "red") {
        legs.push({
          analysisId: leg.analysisId,
          market: leg.market,
          resultStatus: leg.resultStatus,
        });
        continue;
      }

      const score = finalScore(results, leg.fixture?.id);
      if (!score) return;

      const green = isGreenMarket(leg.market, score.homeGoals, score.awayGoals);
      if (green === null) return;

      legs.push({
        analysisId: leg.analysisId,
        market: leg.market,
        resultStatus: green ? "green" : "red",
      });
    }

    if (legs.length !== bet.legs.length) return;

    const won = legs.every((leg) => leg.resultStatus === "green");
    const stake = bet.tracking.stakeUsed ?? 0;
    const odd = bet.tracking.oddUsed ?? bet.combinedOdds;

    previews.push({
      multipleId: bet.id,
      label:
        bet.legs.length > 1
          ? `${bet.legs[0].match} + ${bet.legs.length - 1} ${
              bet.legs.length === 2 ? "jogo" : "jogos"
            }`
          : bet.legs[0]?.match ?? "Múltipla",
      legCount: bet.legs.length,
      legs,
      stake,
      odd,
      resultStatus: won ? "green" : "red",
      profitLoss: won ? stake * (odd - 1) : -stake,
    });
  });

  return previews;
}

export function buildResultsPlan(
  analyses: SavedAnalysis[],
  results: Map<number, FixtureResult>,
  multiples: MultipleBet[] = []
): ResultsPlan {
  if (results.size === 0) return EMPTY_PLAN;

  const plan: ResultsPlan = {
    scores: [],
    settlements: [],
    multiples: buildMultipleSettlements(multiples, results),
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
