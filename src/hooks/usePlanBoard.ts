import { useContext } from "react";
import { PlanBoardContext } from "@/contexts/planBoardCore";

export function usePlanBoard() {
  const context = useContext(PlanBoardContext);

  if (!context) {
    throw new Error("usePlanBoard must be used within PlanBoardProvider");
  }

  return context;
}

/**
 * Os desafios desta conta, ou nada, sem rebentar por isso.
 *
 * O usePlanBoard atira sem provedor à volta, e é o que deve fazer numa
 * página que existe para os desafios. O quadro de probabilidades não é
 * uma dessas: lê-se sem desafio nenhum, e o atalho para o boletim é um
 * extra que aparece quando há um a decorrer.
 */
export function useMaybePlanBoard() {
  return useContext(PlanBoardContext);
}
