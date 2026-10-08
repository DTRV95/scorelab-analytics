import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PlanRecord } from "@/lib/planStore";

const { setPlanEnded } = vi.hoisted(() => ({
  setPlanEnded: vi.fn(async () => undefined),
}));

vi.mock("@/lib/planStore", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planStore")>(
    "@/lib/planStore",
  );
  return { ...actual, setPlanEnded };
});

import { EndChallenge, type EndSummary } from "@/components/EndChallenge";

const plan = (endedAt: string | null = null): PlanRecord => ({
  id: "p1",
  name: "Dobrar a banca",
  starting_bankroll: 20,
  target: 40,
  created_by: "david",
  start_date: null,
  days: 14,
  rules: {},
  visible: false,
  template_key: "dobrar",
  ended_at: endedAt,
  ended_by: endedAt ? "david" : null,
});

const summary = (overrides: Partial<EndSummary> = {}): EndSummary => ({
  bankroll: 31.4,
  profit: 11.4,
  day: 6,
  days: 14,
  openBets: 0,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("giving a challenge as over", () => {
  it("says where it finished before asking anything", () => {
    render(
      <EndChallenge
        plan={plan()}
        isOwner
        summary={summary()}
        onDone={() => {}}
      />,
    );

    expect(screen.getByText("31,40 €")).toBeInTheDocument();
    expect(screen.getByText("+11,40 €")).toBeInTheDocument();
    expect(screen.getByText("6 de 14")).toBeInTheDocument();
  });

  it("promises what it does, and what it does not", () => {
    render(
      <EndChallenge
        plan={plan()}
        isOwner
        summary={summary()}
        onDone={() => {}}
      />,
    );

    expect(screen.getByText(/Não apaga nada/)).toBeInTheDocument();
  });

  it("ends it, and says so upstream", async () => {
    const onDone = vi.fn();
    render(
      <EndChallenge plan={plan()} isOwner summary={summary()} onDone={onDone} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Terminar o desafio/ }));

    await waitFor(() => expect(setPlanEnded).toHaveBeenCalledWith("p1", true));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("refuses while a bet is still open, and says how many", () => {
    render(
      <EndChallenge
        plan={plan()}
        isOwner
        summary={summary({ openBets: 2 })}
        onDone={() => {}}
      />,
    );

    // A challenge ended with a bet in the air freezes on a bankroll that is
    // not the real one.
    expect(screen.getByText(/Há 2 apostas por decidir/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Terminar/ })).toBeNull();
  });

  it("offers to put it back on once it is over", async () => {
    const onDone = vi.fn();
    render(
      <EndChallenge
        plan={plan("2026-10-02T18:00:00.000Z")}
        isOwner
        summary={summary()}
        onDone={onDone}
      />,
    );

    expect(screen.getByText(/02\/10\/2026/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reabrir o desafio/ }));

    await waitFor(() => expect(setPlanEnded).toHaveBeenCalledWith("p1", false));
  });

  it("tells somebody who did not create it why they cannot", () => {
    render(
      <EndChallenge
        plan={plan()}
        isOwner={false}
        summary={summary()}
        onDone={() => {}}
      />,
    );

    expect(screen.getByText(/Só quem criou o desafio/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("repeats the server's own refusal rather than guessing", async () => {
    setPlanEnded.mockRejectedValueOnce(
      new Error("Há 1 aposta(s) por decidir. Fecha-as antes de terminar o desafio."),
    );

    render(
      <EndChallenge
        plan={plan()}
        isOwner
        summary={summary()}
        onDone={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Terminar o desafio/ }));

    expect(
      await screen.findByText(/Fecha-as antes de terminar o desafio/),
    ).toBeInTheDocument();
  });
});
