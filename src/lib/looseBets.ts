import { supabase } from "@/lib/supabaseClient";
import {
  PLANS_CHANGED_EVENT,
  type PlanBet,
  type PlanBetPayload,
} from "@/lib/planStore";

/**
 * A bet that belongs to no challenge.
 *
 * The same shape as one inside a challenge, on purpose and not by accident:
 * everything that settles, corrects or counts a bet — the scores coming back
 * from the provider, a day closed by hand, a leg marked, the analysis by
 * market and by odd — then works on these without a line of it being written
 * twice. The one field that means nothing here is `day`, which stays at zero
 * and is never shown.
 */
export type LooseBet = PlanBet;

interface Row {
  id: string;
  user_id: string;
  payload: PlanBetPayload;
}

function client() {
  if (!supabase) throw new Error("Supabase não está configurado.");
  return supabase;
}

/** A bet about to be saved, before it has an id or a home. */
export function looseBetPayload(
  legs: PlanBetPayload["legs"],
  odds: number,
  stake: number,
): PlanBetPayload {
  return {
    legs,
    odds,
    stake,
    // Not a day of anything: these do not climb a ladder.
    day: 0,
    status: "pending",
    profitLoss: 0,
    placedAt: new Date().toISOString(),
    settledAt: null,
  };
}

export async function fetchLooseBets(): Promise<LooseBet[]> {
  const { data, error } = await client()
    .from("loose_bets")
    .select("id, user_id, payload")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as Row[]).map((row) => ({
    ...row.payload,
    id: row.id,
    userId: row.user_id,
  }));
}

export async function saveLooseBet(
  userId: string,
  bet: PlanBetPayload,
): Promise<LooseBet> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const { error } = await client()
    .from("loose_bets")
    .insert({ id, user_id: userId, payload: bet });

  if (error) throw error;
  announce();
  return { ...bet, id, userId };
}

export async function updateLooseBet(
  id: string,
  payload: PlanBetPayload,
): Promise<void> {
  const { error } = await client()
    .from("loose_bets")
    .update({ payload, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
  announce();
}

export async function deleteLooseBet(id: string): Promise<void> {
  const { error } = await client().from("loose_bets").delete().eq("id", id);
  if (error) throw error;
  announce();
}

/** The same announcement the challenges make: anything watching money moves. */
function announce(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PLANS_CHANGED_EVENT));
}

export interface LooseTotals {
  bets: number;
  open: number;
  staked: number;
  profit: number;
  won: number;
  lost: number;
  /** Null until something is decided, so a percentage never lies about zero. */
  winPct: number | null;
  /** What is riding on bets nobody has closed yet. */
  atRisk: number;
  /** What those would return on top of the stake, if they all landed. */
  couldWin: number;
}

/** What the loose bets add up to. */
export function looseTotals(bets: LooseBet[]): LooseTotals {
  const decided = bets.filter((bet) => bet.status !== "pending");
  const open = bets.filter((bet) => bet.status === "pending");
  const won = bets.filter((bet) => bet.status === "green").length;
  const lost = bets.filter((bet) => bet.status === "red").length;
  const settled = won + lost;
  const round = (value: number) => Number(value.toFixed(2));

  return {
    bets: bets.length,
    open: open.length,
    staked: round(decided.reduce((sum, bet) => sum + bet.stake, 0)),
    profit: round(decided.reduce((sum, bet) => sum + bet.profitLoss, 0)),
    won,
    lost,
    winPct: settled > 0 ? Math.round((won / settled) * 100) : null,
    atRisk: round(open.reduce((sum, bet) => sum + bet.stake, 0)),
    couldWin: round(
      open.reduce((sum, bet) => sum + bet.stake * bet.odds - bet.stake, 0),
    ),
  };
}
