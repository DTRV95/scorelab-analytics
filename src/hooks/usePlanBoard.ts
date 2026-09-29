import { useContext } from "react";
import { PlanBoardContext } from "@/contexts/planBoardCore";

export function usePlanBoard() {
  const context = useContext(PlanBoardContext);

  if (!context) {
    throw new Error("usePlanBoard must be used within PlanBoardProvider");
  }

  return context;
}
