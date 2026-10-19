import { useSyncExternalStore } from "react";
import {
  EMPTY_SLIP,
  readSlip,
  withLeg,
  withOdds,
  withPlan,
  withStake,
  withoutLeg,
  writeSlip,
  type DraftSlip,
  type SlipLeg,
} from "@/lib/draftSlip";

/**
 * Um boletim só, visto de todo o lado.
 *
 * Está fora do React de propósito. Quem o lê são dois sítios que não têm
 * nenhum antepassado comum perto — a lista de jogos e a barra que flutua por
 * cima do rodapé — e pô-los debaixo de um provedor comum seria envolver a
 * aplicação inteira para partilhar um objecto. A loja é o módulo; os
 * componentes subscrevem-na.
 */
let current: DraftSlip =
  typeof window === "undefined" ? EMPTY_SLIP : readSlip();

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: DraftSlip): void {
  if (next === current) return;
  current = next;
  writeSlip(next);
  listeners.forEach((listener) => listener());
}

/** As acções, estáveis entre repinturas porque não dependem de nada. */
export const draftSlip = {
  add(planId: string, leg: Omit<SlipLeg, "key">) {
    commit(withLeg(current, planId, leg));
  },
  remove(key: string) {
    commit(withoutLeg(current, key));
  },
  setOdds(key: string, odds: string) {
    commit(withOdds(current, key, odds));
  },
  setPlan(planId: string) {
    commit(withPlan(current, planId));
  },
  setStake(stake: string | null) {
    commit(withStake(current, stake));
  },
  clear() {
    commit(EMPTY_SLIP);
  },
  /** O estado de agora, para quem precisa de o ler fora de um componente. */
  read(): DraftSlip {
    return current;
  },
};

/** Só para os testes: a loja é um módulo e um módulo não se desmonta. */
export function resetDraftSlip(): void {
  current = EMPTY_SLIP;
  writeSlip(EMPTY_SLIP);
  listeners.forEach((listener) => listener());
}

export function useDraftSlip(): DraftSlip {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY_SLIP,
  );
}
