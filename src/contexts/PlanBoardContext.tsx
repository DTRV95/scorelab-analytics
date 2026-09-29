import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PlanBoardContext, type PlanBoardValue } from "@/contexts/planBoardCore";
import { useAuth } from "@/contexts/AuthContext";
import { homeBoard, type HomeBoard } from "@/lib/homeBoard";
import {
  fetchBetsOfPlans,
  fetchFundsOfPlans,
  fetchMembersOfPlans,
  fetchPlans,
  PLANS_CHANGED_EVENT,
  type PlanBet,
  type PlanFunds,
  type PlanMember,
} from "@/lib/planStore";

interface Loaded {
  board: HomeBoard | null;
  bets: (PlanBet & { planId: string })[];
  started: number;
  loading: boolean;
}

const EMPTY: Loaded = { board: null, bets: [], started: 0, loading: true };

/**
 * The challenges, read once for the whole app.
 *
 * The bankroll used to be worked out on the home page alone, which is why the
 * bar at the top of every page showed a different figure — one built from the
 * saved analyses nobody uses any more. Reading the challenges here means both
 * of them say the same number, and a bet registered on a third page moves both
 * at once.
 */
export function PlanBoardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // The id, not the user: the session object is replaced whenever the token is
  // refreshed, and reading four tables again every time it is would be work
  // nobody asked for.
  const userId = user?.id ?? null;
  const [state, setState] = useState<Loaded>(EMPTY);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((n) => n + 1), []);

  useEffect(() => {
    if (!userId) {
      setState({ ...EMPTY, loading: false });
      return;
    }

    let cancelled = false;
    setState((current) => ({ ...current, loading: true }));

    fetchPlans()
      .then(async (plans) => {
        const ids = plans.map((plan) => plan.id);
        const [members, placed, moved] = await Promise.all([
          fetchMembersOfPlans(ids).catch(() => [] as PlanMember[]),
          fetchBetsOfPlans(ids).catch(
            () => [] as (PlanBet & { planId: string })[],
          ),
          // Money put into a bankroll is part of that bankroll. Leaving it out
          // made the same figure read differently in two places, which is worse
          // than either number on its own.
          fetchFundsOfPlans(ids).catch(
            () => [] as (PlanFunds & { planId: string })[],
          ),
        ]);
        if (cancelled) return;

        setState({
          board: homeBoard(userId, plans, members, placed, moved),
          bets: placed.filter((bet) => bet.userId === userId),
          started: members
            .filter((entry) => entry.user_id === userId)
            .reduce((sum, entry) => sum + Number(entry.starting_bankroll), 0),
          loading: false,
        });
      })
      .catch(() => {
        // A figure that cannot be read is left unsaid rather than guessed at.
        if (!cancelled) setState((current) => ({ ...current, loading: false }));
      });

    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  // Every write that moves a bankroll says so. Listening here means the figure
  // in the bar follows a bet registered two pages away.
  useEffect(() => {
    window.addEventListener(PLANS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(PLANS_CHANGED_EVENT, reload);
  }, [reload]);

  const value = useMemo<PlanBoardValue>(
    () => ({ ...state, reload }),
    [state, reload],
  );

  return (
    <PlanBoardContext.Provider value={value}>
      {children}
    </PlanBoardContext.Provider>
  );
}
