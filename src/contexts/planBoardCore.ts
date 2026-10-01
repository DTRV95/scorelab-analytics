import { createContext } from "react";
import type { HomeBoard } from "@/lib/homeBoard";
import type {
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
  /** True until the first load finishes, so a figure is never guessed at. */
  loading: boolean;
  /** Read the challenges again. Mutations announce themselves, so this is
   *  only for a page that wants to force it. */
  reload: () => void;
}

export const PlanBoardContext = createContext<PlanBoardValue | null>(null);
