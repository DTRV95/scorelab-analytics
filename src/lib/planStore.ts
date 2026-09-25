import { supabase } from "@/lib/supabaseClient";
import { isGreenMarket } from "@/lib/modelAudit";
import type { BetStatus } from "@/types/analysis";

export interface PlanRecord {
  id: string;
  name: string;
  starting_bankroll: number;
  target: number;
  created_by: string;
}

export interface PlanMember {
  plan_id: string;
  user_id: string;
  display_name: string;
  starting_bankroll: number;
}

/** A bet placed inside the plan. One per player per day, by the plan's rules. */
export interface PlanBetPayload {
  match: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  market: string;
  odds: number;
  stake: number;
  modelProb: number;
  day: number;
  status: BetStatus;
  profitLoss: number;
  placedAt: string;
  settledAt: string | null;
  fixture: { id: number; league: string; kickoff: string | null } | null;
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
    .select("id, name, starting_bankroll, target, created_by")
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
 * Settles a plan bet from a final score, the same way the rest of the app does.
 *
 * Returns null when the score cannot decide the market, so it stays pending
 * and visible rather than being guessed at.
 */
export function settleFromScore(
  bet: PlanBet,
  homeGoals: number,
  awayGoals: number
): PlanBetPayload | null {
  const green = isGreenMarket(bet.market, homeGoals, awayGoals);
  if (green === null) return null;

  return {
    ...bet,
    status: green ? "green" : "red",
    profitLoss: Number(
      (green ? bet.stake * (bet.odds - 1) : -bet.stake).toFixed(2)
    ),
    settledAt: new Date().toISOString(),
  };
}
