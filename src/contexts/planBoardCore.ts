import { createContext } from "react";
import type { GlobalBalance } from "@/lib/globalBalance";
import type { HomeBoard } from "@/lib/homeBoard";
import type {
  PendingInvite,
  PlanBet,
  PlanFunds,
  PlanMember,
  PlanRecord,
} from "@/lib/planStore";

export interface PlanBoardValue {
  /** Every challenge this person is in, summed. Null until the first load. */
  board: HomeBoard | null;
  /** Their own bets, across every challenge, newest last. */
  bets: (PlanBet & { planId: string })[];
  /**
   * The pieces the board was built from.
   *
   * Everything about the other players lives in here — who is in which
   * challenge, and what they did. A page that wants to say something about
   * somebody else needs the roster, not only this person's own row.
   */
  plans: PlanRecord[];
  members: PlanMember[];
  allBets: (PlanBet & { planId: string })[];
  funds: (PlanFunds & { planId: string })[];
  /** What they put on the table to start with, summed across challenges. */
  started: number;
  /**
   * Challenges somebody asked them to join and they have not answered.
   *
   * Read here rather than on one page, because an invitation that can only
   * be seen inside a challenge is an invitation nobody sees.
   */
  invites: PendingInvite[];
  /** Bets that belong to no challenge — this person's money all the same. */
  looseBets: PlanBet[];
  /**
   * Everything this account has, added up: every challenge — finished ones
   * included — and the bets made outside them. The figure in the bar.
   */
  balance: GlobalBalance;
  /** True until the first load finishes, so a figure is never guessed at. */
  loading: boolean;
  /** Read the challenges again. Mutations announce themselves, so this is
   *  only for a page that wants to force it. */
  reload: () => void;
}

export const PlanBoardContext = createContext<PlanBoardValue | null>(null);
