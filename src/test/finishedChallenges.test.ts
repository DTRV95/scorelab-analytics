import { describe, expect, it } from "vitest";
import { finishedChallenges } from "@/lib/finishedChallenges";
import { MILLION_PLAN_RULES } from "@/lib/challengeRules";
import type {
  PlanBet,
  PlanFunds,
  PlanMember,
  PlanRecord,
} from "@/lib/planStore";

function plan(overrides: Partial<PlanRecord> = {}): PlanRecord {
  return {
    id: "p1",
    name: "Dobrar a banca",
    starting_bankroll: 10,
    target: 20,
    created_by: "david",
    start_date: null,
    days: 14,
    rules: MILLION_PLAN_RULES,
    visible: false,
    template_key: "dobrar",
    ended_at: "2026-10-02T18:00:00.000Z",
    ended_by: "david",
    ...overrides,
  };
}

const member = (userId: string, name: string, planId = "p1"): PlanMember => ({
  plan_id: planId,
  user_id: userId,
  display_name: name,
  starting_bankroll: 10,
});

function bet(
  userId: string,
  status: PlanBet["status"],
  profitLoss: number,
  placedAt = "2026-09-20T10:00:00.000Z",
  planId = "p1"
): PlanBet & { planId: string } {
  return {
    planId,
    id: Math.random().toString(36),
    userId,
    legs: [],
    odds: 1.9,
    stake: 5,
    day: 1,
    status,
    profitLoss,
    placedAt,
    settledAt: status === "pending" ? null : "2026-09-20T20:00:00.000Z",
  };
}

describe("the shelf of challenges that are over", () => {
  it("keeps only the ones that ended, newest first", () => {
    const shelf = finishedChallenges(
      "david",
      [
        plan({ id: "a", ended_at: "2026-09-10T12:00:00.000Z" }),
        plan({ id: "b", ended_at: "2026-10-02T12:00:00.000Z" }),
        plan({ id: "c", ended_at: null }),
      ],
      [member("david", "David", "a"), member("david", "David", "b"), member("david", "David", "c")],
      [],
    );

    expect(shelf.map((entry) => entry.plan.id)).toEqual(["b", "a"]);
  });

  it("leaves out a challenge this person was never in", () => {
    const shelf = finishedChallenges(
      "david",
      [plan({ id: "dos-outros" })],
      [member("irmao", "Vilagreen", "dos-outros")],
      [],
    );

    expect(shelf).toEqual([]);
  });

  it("says what the challenge did, read off the bets", () => {
    const [entry] = finishedChallenges(
      "david",
      [plan()],
      [member("david", "David")],
      [
        bet("david", "green", 4.5),
        bet("david", "green", 4.5),
        bet("david", "red", -5),
      ],
    );

    expect(entry.me?.bankroll).toBe(14);
    expect(entry.me?.profit).toBe(4);
    expect(entry.me?.settled).toBe(3);
    expect(entry.me?.greens).toBe(2);
    expect(entry.me?.reds).toBe(1);
    expect(entry.me?.hitRate).toBe(67);
    expect(entry.bets).toBe(3);
  });

  it("counts the days it ran from the first bet to the end", () => {
    const [entry] = finishedChallenges(
      "david",
      [plan({ ended_at: "2026-10-02T18:00:00.000Z" })],
      [member("david", "David")],
      [bet("david", "green", 4.5, "2026-09-22T10:00:00.000Z")],
    );

    expect(entry.startedAt).toBe("2026-09-22T10:00:00.000Z");
    // 22/09 às 10:00 até 02/10 às 18:00: dez dias e oito horas.
    expect(entry.lasted).toBe(10);
  });

  it("names whoever finished ahead, and nobody in a challenge of one", () => {
    const together = finishedChallenges(
      "david",
      [plan()],
      [member("david", "David"), member("irmao", "Vilagreen")],
      [bet("david", "green", 9), bet("irmao", "red", -5)],
    );
    expect(together[0].winner?.name).toBe("David");

    const alone = finishedChallenges(
      "david",
      [plan()],
      [member("david", "David")],
      [bet("david", "green", 9)],
    );
    expect(alone[0].winner).toBeNull();
  });

  it("calls nobody the winner on a dead heat", () => {
    const shelf = finishedChallenges(
      "david",
      [plan()],
      [member("david", "David"), member("irmao", "Vilagreen")],
      [bet("david", "green", 4.5), bet("irmao", "green", 4.5)],
    );

    expect(shelf[0].winner).toBeNull();
  });

  it("says whether the money actually got where it was going", () => {
    const missed = finishedChallenges(
      "david",
      [plan({ target: 100 })],
      [member("david", "David")],
      [bet("david", "green", 4.5)],
    );
    expect(missed[0].hitTarget).toBe(false);

    const made = finishedChallenges(
      "david",
      [plan({ target: 14 })],
      [member("david", "David")],
      [bet("david", "green", 4.5)],
    );
    expect(made[0].hitTarget).toBe(true);
  });

  it("keeps money put in apart from what the betting did", () => {
    const funds: (PlanFunds & { planId: string })[] = [
      {
        planId: "p1",
        id: "f1",
        userId: "david",
        amount: 50,
        note: null,
        at: "2026-09-25T10:00:00.000Z",
      },
    ];

    const [entry] = finishedChallenges(
      "david",
      [plan()],
      [member("david", "David")],
      [bet("david", "green", 4.5)],
      funds,
    );

    // €50 deposited moves the bankroll exactly as far as €50 won, and only one
    // of the two says anything about the betting.
    expect(entry.me?.bankroll).toBe(64.5);
    expect(entry.me?.profit).toBe(4.5);
    expect(entry.me?.added).toBe(50);
  });
});
