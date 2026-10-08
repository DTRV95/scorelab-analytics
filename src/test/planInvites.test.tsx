import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PendingInvite } from "@/lib/planStore";

const store = vi.hoisted(() => ({
  accept: vi.fn(async () => undefined),
  decline: vi.fn(async () => undefined),
}));

vi.mock("@/lib/planStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/planStore")>();
  return { ...actual, acceptInvite: store.accept, declineInvite: store.decline };
});

import { PlanInvites, waitingFor } from "@/components/PlanInvites";

const invite = (overrides: Partial<PendingInvite> = {}): PendingInvite => ({
  plan_id: "p1",
  plan_name: "Plano Milhão",
  invited_by_name: "Vilagreen",
  created_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
  starting_bankroll: 10,
  target: 1000000,
  days: 38,
  template_key: "milhao",
  players: 1,
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("an invitation to a challenge", () => {
  it("says who, which challenge, and what it is", () => {
    // Somebody invited is not a member yet and cannot read the challenge, so
    // saying yes used to be the only way to find out what it was.
    render(<PlanInvites invites={[invite()]} onAnswered={() => {}} />);

    expect(screen.getByText(/convidou-te para o/)).toBeInTheDocument();
    expect(screen.getByText("Vilagreen")).toBeInTheDocument();
    expect(screen.getByText("Plano Milhão")).toBeInTheDocument();
    expect(
      screen.getByText(/10 € → 1 000 000 € · 38 níveis · 1 jogador lá dentro/),
    ).toBeInTheDocument();
  });

  it("says how long it has been waiting", () => {
    render(<PlanInvites invites={[invite()]} onAnswered={() => {}} />);

    expect(screen.getByText("há 2 horas")).toBeInTheDocument();
  });

  it("joins the challenge when accepted, and says so upstream", async () => {
    const answered = vi.fn();
    render(<PlanInvites invites={[invite()]} onAnswered={answered} />);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));

    await waitFor(() => expect(store.accept).toHaveBeenCalledWith("p1"));
    expect(answered).toHaveBeenCalled();
    expect(store.decline).not.toHaveBeenCalled();
  });

  it("turns it down without joining anything", async () => {
    const answered = vi.fn();
    render(<PlanInvites invites={[invite()]} onAnswered={answered} />);

    fireEvent.click(screen.getByRole("button", { name: "Recusar" }));

    await waitFor(() => expect(store.decline).toHaveBeenCalledWith("p1"));
    expect(store.accept).not.toHaveBeenCalled();
  });

  it("says a refusal failed instead of pretending it worked", async () => {
    store.accept.mockRejectedValueOnce(new Error("sem rede"));
    const answered = vi.fn();
    render(<PlanInvites invites={[invite()]} onAnswered={answered} />);

    fireEvent.click(screen.getByRole("button", { name: "Aceitar" }));

    expect(
      await screen.findByText(/Não deu para entrar no desafio/),
    ).toBeInTheDocument();
    expect(answered).not.toHaveBeenCalled();
  });

  it("shows nothing at all when there is nothing waiting", () => {
    const { container } = render(
      <PlanInvites invites={[]} onAnswered={() => {}} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("how long an invitation has been waiting", () => {
  const now = new Date("2026-10-08T12:00:00.000Z").getTime();

  it("uses the words somebody would use out loud", () => {
    expect(waitingFor("2026-10-08T11:40:00.000Z", now)).toBe("agora mesmo");
    expect(waitingFor("2026-10-08T09:00:00.000Z", now)).toBe("há 3 horas");
    expect(waitingFor("2026-10-07T11:00:00.000Z", now)).toBe("há 1 dia");
    expect(waitingFor("2026-10-02T12:00:00.000Z", now)).toBe("há 6 dias");
  });
});
