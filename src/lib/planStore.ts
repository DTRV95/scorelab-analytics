import { supabase } from "@/lib/supabaseClient";
import { isGreenMarket } from "@/lib/modelAudit";
import type { BetStatus } from "@/types/analysis";

export interface PlanRecord {
  id: string;
  name: string;
  starting_bankroll: number;
  target: number;
  created_by: string;
  /** The day the plan begins, as YYYY-MM-DD. Null when it was never set. */
  start_date: string | null;
  days: number;
}

export interface PlanTerms {
  name: string;
  startDate: string | null;
  startingBankroll: number;
  target: number;
}

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
  modelProb: number;
  fixtureId: number;
  kickoff: string | null;
  /** Set once the final score decides this game. */
  status: BetStatus;
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
    .select("id, name, starting_bankroll, target, created_by, start_date, days")
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
    .select("id, name, starting_bankroll, target, created_by, start_date, days")
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

export async function createPlan(terms: PlanTerms & { days?: number }): Promise<string> {
  const { data, error } = await client().rpc("create_plan", {
    plan_name: terms.name,
    plan_start: terms.startDate,
    plan_starting_bankroll: terms.startingBankroll,
    plan_target: terms.target,
    plan_days: terms.days ?? 38,
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
  });

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
  /** Losses since the last win — what the plan's pause rule counts. */
  lossStreak: number;
  /** The day this player is on: one per bet already placed, plus the next. */
  day: number;
  openStake: number;
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

  mine.forEach((bet) => {
    if (bet.status === "green") {
      bankroll += bet.profitLoss;
      greens += 1;
      lossStreak = 0;
    } else if (bet.status === "red") {
      bankroll += bet.profitLoss;
      reds += 1;
      lossStreak += 1;
    } else if (bet.status === "pending") {
      openStake += bet.stake;
    }
  });

  return {
    userId: member.user_id,
    name: member.display_name,
    bankroll: Number(bankroll.toFixed(2)),
    startingBankroll: Number(member.starting_bankroll),
    bets: mine,
    settled: greens + reds,
    greens,
    reds,
    lossStreak,
    day: mine.length + 1,
    openStake: Number(openStake.toFixed(2)),
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
 * All or nothing: one game lost loses the day. A game whose market a score
 * cannot decide leaves the whole bet open rather than being guessed at, and so
 * does a game that has not been played.
 */
export function settleFromScores(
  bet: PlanBet,
  scores: Map<number, { homeGoals: number; awayGoals: number }>
): PlanBetPayload | null {
  const legs: PlanLeg[] = [];

  for (const leg of bet.legs) {
    if (leg.status === "green" || leg.status === "red") {
      legs.push(leg);
      continue;
    }

    const score = scores.get(leg.fixtureId);
    if (!score) return null;

    const green = isGreenMarket(leg.market, score.homeGoals, score.awayGoals);
    if (green === null) return null;

    legs.push({ ...leg, status: green ? "green" : "red" });
  }

  if (legs.length !== bet.legs.length) return null;

  const won = legs.every((leg) => leg.status === "green");

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

/** Every fixture the open bets are waiting on. */
export function openFixtureRefs(bets: PlanBet[]): { id: number; league: string }[] {
  const refs = new Map<number, { id: number; league: string }>();

  bets
    .filter((bet) => bet.status === "pending")
    .forEach((bet) =>
      bet.legs.forEach((leg) => {
        if (leg.status === "pending") {
          refs.set(leg.fixtureId, { id: leg.fixtureId, league: leg.league });
        }
      })
    );

  return [...refs.values()];
}
