import { supabase } from "@/lib/supabaseClient";
import type { ChallengeRules } from "@/lib/challengeRules";
import { isGreenMarket } from "@/lib/modelAudit";
import type { BetStatus } from "@/types/analysis";

export interface PlanRecord {
  id: string;
  name: string;
  starting_bankroll: number;
  target: number;
  created_by: string;
  /** The day the challenge begins, as YYYY-MM-DD. Null when it was never set. */
  start_date: string | null;
  days: number;
  /** The challenge's own rules, as stored. Parsed by challengeRules.ts. */
  rules: unknown;
}

export interface PlanTerms {
  name: string;
  startDate: string | null;
  startingBankroll: number;
  target: number;
  days?: number;
  rules?: unknown;
}

const PLAN_COLUMNS =
  "id, name, starting_bankroll, target, created_by, start_date, days, rules";

export interface PlanMember {
  plan_id: string;
  user_id: string;
  display_name: string;
  starting_bankroll: number;
}

/** One game inside a day's bet. A day can be a single game or several. */
export interface PlanLeg {
  match: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  odds: number;
  /**
   * The model's chance of this leg landing, or 0 for a game typed by hand —
   * there is no forecast for a game the app has never heard of, and inventing
   * one would be worse than admitting it.
   */
  modelProb: number;
  /** Null for a game added by hand: there is no fixture to follow. */
  fixtureId: number | null;
  kickoff: string | null;
  /** Set once the final score decides this game. */
  status: BetStatus;
}

/** A game typed by hand has no fixture behind it, so no result can be fetched. */
export function isManualLeg(leg: PlanLeg): boolean {
  return leg.fixtureId === null;
}

/**
 * A day's bet. One per player per day, by the plan's rules, but a day's bet
 * can combine several games: three games at 1.25 each is the same 1.95 the
 * plan asks for, reached a different way.
 */
export interface PlanBetPayload {
  legs: PlanLeg[];
  /** The legs multiplied together — what the day is actually staked at. */
  odds: number;
  stake: number;
  day: number;
  status: BetStatus;
  profitLoss: number;
  placedAt: string;
  settledAt: string | null;
}

export interface PlanBet extends PlanBetPayload {
  id: string;
  userId: string;
}

interface PlanBetRow {
  id: string;
  user_id: string;
  payload: PlanBetPayload;
}

function client() {
  if (!supabase) throw new Error("Supabase não está configurado.");
  return supabase;
}

export async function fetchPlan(): Promise<{
  plan: PlanRecord;
  members: PlanMember[];
} | null> {
  const db = client();

  const { data: plans, error } = await db
    .from("plans")
    .select(PLAN_COLUMNS)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  const plan = plans?.[0] as PlanRecord | undefined;
  if (!plan) return null;

  const { data: members, error: membersError } = await db
    .from("plan_members")
    .select("plan_id, user_id, display_name, starting_bankroll")
    .eq("plan_id", plan.id);

  if (membersError) throw membersError;

  return { plan, members: (members ?? []) as PlanMember[] };
}

export type InviteOutcome =
  | "invited"
  | "already_member"
  | "no_account";

export interface PlanInvite {
  invited_user_id: string;
  email: string;
  display_name: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  invited_by_me: boolean;
}

export interface PendingInvite {
  plan_id: string;
  plan_name: string;
  invited_by_name: string;
  created_at: string;
}

/**
 * Invites someone who already has an account, by email.
 *
 * The address is resolved on the server: a browser cannot read the list of
 * accounts, and the lookup is gated on the caller already being in the plan,
 * so this is not a way to probe which addresses are registered.
 */
export async function invitePlayer(
  planId: string,
  email: string
): Promise<InviteOutcome> {
  const { data, error } = await client().rpc("invite_to_plan", {
    target_plan: planId,
    target_email: email,
  });

  if (error) throw error;
  return data as InviteOutcome;
}

export async function fetchPlanInvites(planId: string): Promise<PlanInvite[]> {
  const { data, error } = await client().rpc("list_plan_invites", {
    target_plan: planId,
  });

  if (error) throw error;
  return (data ?? []) as PlanInvite[];
}

/** Plans this account has been asked to join and has not answered yet. */
export async function fetchMyPendingInvites(): Promise<PendingInvite[]> {
  const { data, error } = await client().rpc("my_pending_plan_invites");

  if (error) throw error;
  return (data ?? []) as PendingInvite[];
}

export async function acceptInvite(planId: string): Promise<void> {
  const { error } = await client().rpc("accept_plan_invite", {
    target_plan: planId,
  });
  if (error) throw error;
}

export async function declineInvite(planId: string): Promise<void> {
  const { error } = await client().rpc("decline_plan_invite", {
    target_plan: planId,
  });
  if (error) throw error;
}

/** Every plan this account belongs to, oldest first. */
export async function fetchPlans(): Promise<PlanRecord[]> {
  const { data, error } = await client()
    .from("plans")
    .select(PLAN_COLUMNS)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PlanRecord[];
}

export async function fetchPlanMembers(planId: string): Promise<PlanMember[]> {
  const { data, error } = await client()
    .from("plan_members")
    .select("plan_id, user_id, display_name, starting_bankroll")
    .eq("plan_id", planId);

  if (error) throw error;
  return (data ?? []) as PlanMember[];
}

export async function createPlan(terms: PlanTerms): Promise<string> {
  const { data, error } = await client().rpc("create_plan", {
    plan_name: terms.name,
    plan_start: terms.startDate,
    plan_starting_bankroll: terms.startingBankroll,
    plan_target: terms.target,
    plan_days: terms.days ?? 38,
    plan_rules: terms.rules ?? {},
  });

  if (error) throw error;
  return data as string;
}

export async function updatePlanTerms(
  planId: string,
  terms: PlanTerms
): Promise<void> {
  const { error } = await client().rpc("update_plan_terms", {
    target_plan: planId,
    plan_name: terms.name,
    plan_start: terms.startDate,
    plan_starting_bankroll: terms.startingBankroll,
    plan_target: terms.target,
    plan_days: terms.days ?? null,
    plan_rules: terms.rules ?? null,
  });

  if (error) throw error;
}

/**
 * Deletes a challenge and everything in it.
 *
 * This takes the other players' bets with it and cannot be undone, which is why
 * the server only lets whoever created it do this, and why the page asks for
 * the name to be typed before calling.
 */
export async function deletePlan(planId: string): Promise<void> {
  const { error } = await client().rpc("delete_plan", { target_plan: planId });
  if (error) throw error;
}

/** Leaves a challenge someone else created, taking only your own bets. */
export async function leavePlan(planId: string): Promise<void> {
  const { error } = await client().rpc("leave_plan", { target_plan: planId });
  if (error) throw error;
}

export async function fetchPlanBets(planId: string): Promise<PlanBet[]> {
  const { data, error } = await client()
    .from("plan_bets")
    .select("id, user_id, payload")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as PlanBetRow[]).map((row) => ({
    ...row.payload,
    id: row.id,
    userId: row.user_id,
  }));
}

export async function savePlanBet(
  planId: string,
  userId: string,
  bet: PlanBetPayload
): Promise<PlanBet> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const { error } = await client()
    .from("plan_bets")
    .insert({ plan_id: planId, id, user_id: userId, payload: bet });

  if (error) throw error;
  return { ...bet, id, userId };
}

export async function updatePlanBet(
  planId: string,
  betId: string,
  payload: PlanBetPayload
): Promise<void> {
  const { error } = await client()
    .from("plan_bets")
    .update({ payload, updated_at: new Date().toISOString() })
    .eq("plan_id", planId)
    .eq("id", betId);

  if (error) throw error;
}

export async function deletePlanBet(planId: string, betId: string): Promise<void> {
  const { error } = await client()
    .from("plan_bets")
    .delete()
    .eq("plan_id", planId)
    .eq("id", betId);

  if (error) throw error;
}

export interface PlayerStanding {
  userId: string;
  name: string;
  bankroll: number;
  startingBankroll: number;
  bets: PlanBet[];
  settled: number;
  greens: number;
  reds: number;
  /** Losses since the last win — what the challenge's pause rule counts. */
  lossStreak: number;
  /**
   * The day this player is on: one step up the table for every day won, one
   * step back down for every day lost.
   *
   * Not a count of bets placed. A lost day does not move anyone forward, and a
   * number that only ever grows would keep asking for a bigger stake off a
   * smaller bankroll.
   */
  day: number;
  /** Days still open, which is what has to be closed before the next one. */
  openBets: number;
  openStake: number;
  /** The last day that was decided, for saying what just happened. */
  lastSettled: PlanBet | null;
}

/**
 * Each player's position, worked out from the bets themselves.
 *
 * The bankroll is not stored anywhere: it is the starting stake plus every
 * settled result, which means it can never disagree with the bets on screen.
 * A pending bet has not moved the bankroll yet, but its stake is already at
 * risk, so it is reported separately rather than quietly deducted.
 */
export function buildStanding(
  member: PlanMember,
  rules: ChallengeRules,
  bets: PlanBet[]
): PlayerStanding {
  const mine = bets
    .filter((bet) => bet.userId === member.user_id)
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt));

  let bankroll = Number(member.starting_bankroll);
  let greens = 0;
  let reds = 0;
  let lossStreak = 0;
  let openStake = 0;
  let openBets = 0;
  let lastSettled: PlanBet | null = null;

  mine.forEach((bet) => {
    if (bet.status === "green") {
      bankroll += bet.profitLoss;
      greens += 1;
      lossStreak = 0;
      lastSettled = bet;
    } else if (bet.status === "red") {
      bankroll += bet.profitLoss;
      reds += 1;
      lossStreak += 1;
      lastSettled = bet;
    } else if (bet.status === "pending") {
      openStake += bet.stake;
      openBets += 1;
    }
  });

  const rounded = Number(bankroll.toFixed(2));

  return {
    userId: member.user_id,
    name: member.display_name,
    bankroll: rounded,
    startingBankroll: Number(member.starting_bankroll),
    bets: mine,
    settled: greens + reds,
    greens,
    reds,
    lossStreak,
    // Win and you climb a step, lose and you go back one, never past the ends
    // of the table.
    day: Math.min(Math.max(1, 1 + greens - reds), rules.days),
    openBets,
    openStake: Number(openStake.toFixed(2)),
    lastSettled,
  };
}

function sameDay(iso: string, reference = new Date()): boolean {
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function betsPlacedToday(standing: PlayerStanding): number {
  return standing.bets.filter((bet) => sameDay(bet.placedAt)).length;
}

/**
 * Multiplies the legs into the odd the day is staked at.
 *
 * One game or ten, the arithmetic is the same: every game has to land, so the
 * prices multiply. This is what makes a handful of short prices add up to the
 * 1.75-2.10 the plan asks for.
 */
export function combineOdds(legs: { odds: number }[]): number {
  if (legs.length === 0) return 0;
  return Number(
    legs.reduce((product, leg) => product * (leg.odds || 0), 1).toFixed(2)
  );
}

/** The model's own chance of the whole day landing, legs multiplied out. */
export function combinedModelProb(legs: { modelProb: number }[]): number {
  if (legs.length === 0) return 0;
  return Number(
    (legs.reduce((product, leg) => product * (leg.modelProb / 100), 1) * 100).toFixed(1)
  );
}

/**
 * Settles a day's bet from the final scores of its games.
 *
 * All or nothing: one game lost loses the day. That is also why a bet can close
 * before every game has been played — once one leg is down, nothing the others
 * do can save it, and leaving it "open" would overstate what is still at stake.
 *
 * A game typed by hand has no result to fetch, so a bet holding one can only be
 * closed early, by a leg that already lost. Otherwise it waits for its owner to
 * say how it went. The same goes for a market a score cannot decide on its own:
 * it is left alone rather than guessed at.
 */
export function settleFromScores(
  bet: PlanBet,
  scores: Map<number, { homeGoals: number; awayGoals: number }>
): PlanBetPayload | null {
  const legs: PlanLeg[] = [];
  let undecided = 0;

  for (const leg of bet.legs) {
    if (leg.status === "green" || leg.status === "red") {
      legs.push(leg);
      continue;
    }

    const score = leg.fixtureId === null ? undefined : scores.get(leg.fixtureId);
    if (!score) {
      legs.push(leg);
      undecided += 1;
      continue;
    }

    const green = isGreenMarket(leg.market, score.homeGoals, score.awayGoals);
    if (green === null) {
      legs.push(leg);
      undecided += 1;
      continue;
    }

    legs.push({ ...leg, status: green ? "green" : "red" });
  }

  const lost = legs.some((leg) => leg.status === "red");
  if (undecided > 0 && !lost) return null;

  const won = !lost && legs.every((leg) => leg.status === "green");

  return {
    ...bet,
    legs,
    status: won ? "green" : "red",
    profitLoss: Number(
      (won ? bet.stake * (bet.odds - 1) : -bet.stake).toFixed(2)
    ),
    settledAt: new Date().toISOString(),
  };
}

/**
 * Closes a bet because its owner said how it went.
 *
 * The one place a person has to do the work themselves: nobody but them knows
 * the result of a game the app has never seen. A single game marks that game; a
 * day made of several marks the day as a whole, which is the only thing that
 * matters to the bankroll anyway.
 */
export function settleManually(bet: PlanBet, won: boolean): PlanBetPayload {
  return {
    ...bet,
    legs: bet.legs.map((leg) => ({
      ...leg,
      // A lost day says nothing about which game lost it, so the legs of a
      // multiple are left as they were rather than all being blamed.
      status: won ? "green" : bet.legs.length === 1 ? "red" : leg.status,
    })),
    status: won ? "green" : "red",
    profitLoss: Number((won ? bet.stake * (bet.odds - 1) : -bet.stake).toFixed(2)),
    settledAt: new Date().toISOString(),
  };
}

/**
 * Records how one game inside a bet went.
 *
 * Marking a day lost says the day went down, not which game took it — and with
 * every game typed by hand, nothing else ever fills that in. This is how the
 * person who was there says it, one game at a time, on an open bet or on one
 * already closed.
 *
 * On a bet still open the legs can decide it: one game down loses the day, and
 * every game in means it is won. A bet already settled keeps the money its
 * owner settled it with; this only records what each game did.
 */
export function setLegStatus(
  bet: PlanBet,
  index: number,
  status: BetStatus
): PlanBetPayload {
  const legs = bet.legs.map((leg, position) =>
    position === index ? { ...leg, status } : leg
  );

  if (bet.status !== "pending") return { ...bet, legs };

  const lost = legs.some((leg) => leg.status === "red");
  const won = legs.every((leg) => leg.status === "green");
  if (!lost && !won) return { ...bet, legs };

  return {
    ...bet,
    legs,
    status: lost ? "red" : "green",
    profitLoss: Number(
      (lost ? -bet.stake : bet.stake * (bet.odds - 1)).toFixed(2)
    ),
    settledAt: new Date().toISOString(),
  };
}

/**
 * Closes a lost day from the games that failed.
 *
 * In a multiple the day goes down because one game fell — the others came in.
 * So the person only has to point at the ones that failed, and everything they
 * did not point at is settled as landed. At least one has to be named, because
 * a day where every game landed is not a lost day.
 */
export function settleLostWith(
  bet: PlanBet,
  failed: number[]
): PlanBetPayload {
  const down = new Set(failed);

  return {
    ...bet,
    legs: bet.legs.map((leg, index) => ({
      ...leg,
      status: down.has(index) ? "red" : "green",
    })),
    status: "red",
    profitLoss: Number((-bet.stake).toFixed(2)),
    settledAt: bet.settledAt ?? new Date().toISOString(),
  };
}

/**
 * Settles every game still open in one go.
 *
 * The usual case by a mile: a day goes down with all of it, or comes in with
 * all of it. Making somebody mark three games one at a time is how the record
 * stays empty and the analysis stays blind.
 */
export function setRemainingLegs(
  bet: PlanBet,
  status: BetStatus
): PlanBetPayload {
  let payload: PlanBetPayload = bet;
  bet.legs.forEach((leg, index) => {
    if (leg.status === "pending") {
      payload = setLegStatus({ ...payload, id: bet.id, userId: bet.userId }, index, status);
    }
  });
  return payload;
}

/** Every fixture the open bets are waiting on. */
export function openFixtureRefs(bets: PlanBet[]): { id: number; league: string }[] {
  const refs = new Map<number, { id: number; league: string }>();

  bets
    .filter((bet) => bet.status === "pending")
    .forEach((bet) =>
      bet.legs.forEach((leg) => {
        if (leg.status === "pending" && leg.fixtureId !== null) {
          refs.set(leg.fixtureId, { id: leg.fixtureId, league: leg.league });
        }
      })
    );

  return [...refs.values()];
}
