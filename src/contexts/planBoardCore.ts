import { createContext } from "react";
import type { HomeBoard } from "@/lib/homeBoard";
import type { PlanBet } from "@/lib/planStore";

export interface PlanBoardValue {
  /** Every challenge this person is in, summed. Null until the first load. */
  board: HomeBoard | null;
  /** Their own bets, across every challenge, newest last. */
  bets: (PlanBet & { planId: string })[];
  /** What they put on the table to start with, summed across challenges. */
  started: number;
  /** True until the first load finishes, so a figure is never guessed at. */
  loading: boolean;
  /** Read the challenges again. Mutations announce themselves, so this is
   *  only for a page that wants to force it. */
  reload: () => void;
}

export const PlanBoardContext = createContext<PlanBoardValue | null>(null);
