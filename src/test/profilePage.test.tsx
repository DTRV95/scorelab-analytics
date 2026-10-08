import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { PlanBet, PlanRecord } from "@/lib/planStore";

const auth = vi.hoisted(() => ({
  updatePassword: vi.fn(async () => ({ error: null as string | null })),
  signOut: vi.fn(async () => undefined),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "david", email: "david@exemplo.pt" },
    updatePassword: auth.updatePassword,
    signOut: auth.signOut,
  }),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const board = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/hooks/usePlanBoard", () => ({ usePlanBoard: () => board.value }));

const store = vi.hoisted(() => ({
  profile: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/lib/planStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/planStore")>();
  return { ...actual, fetchMyProfile: store.profile, saveDisplayName: store.save };
});

const toasts = vi.hoisted(() => ({ shown: [] as Record<string, unknown>[] }));
vi.mock("@/components/ui/use-toast", () => ({
  toast: (payload: Record<string, unknown>) => toasts.shown.push(payload),
}));

import Settings, { initials } from "@/pages/Settings";

const plan = (ended: string | null): PlanRecord => ({
  id: "p1",
  name: "Um mês perfeito",
  starting_bankroll: 20,
  target: 1000,
  created_by: "david",
  start_date: null,
  days: 30,
  rules: {},
  visible: false,
  template_key: "mes",
  ended_at: ended,
  ended_by: null,
});

const bet = (status: "green" | "red"): PlanBet & { planId: string } => ({
  planId: "p1",
  id: `b-${Math.random()}`,
  userId: "david",
  legs: [],
  odds: 1.9,
  stake: 5,
  day: 1,
  status,
  profitLoss: status === "green" ? 4.5 : -5,
  placedAt: "2026-09-20T10:00:00.000Z",
  settledAt: "2026-09-20T20:00:00.000Z",
});

beforeEach(() => {
  vi.clearAllMocks();
  toasts.shown = [];
  store.profile.mockResolvedValue({
    id: "david",
    display_name: "David Vilaverde",
    email: "david@exemplo.pt",
    joined_at: "2026-07-17T15:24:07.000Z",
  });
  store.save.mockImplementation(async (name: string) => name);
  board.value = {
    board: null,
    bets: [bet("green"), bet("green"), bet("red")],
    plans: [plan(null), plan("2026-09-30T18:00:00.000Z")],
    members: [],
    allBets: [],
    funds: [],
    started: 20,
    invites: [],
    loading: false,
    reload: () => {},
  };
});
afterEach(() => cleanup());

const renderPage = () =>
  render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>,
  );

describe("the profile of an account", () => {
  it("shows the real name and email, not the template's", async () => {
    // This page used to say "John Analyst", "john@example.com" and a Pro
    // Plan at $29 a month, none of it wired to anything.
    renderPage();

    expect(await screen.findByText("David Vilaverde")).toBeInTheDocument();
    expect(screen.getByText(/david@exemplo\.pt/)).toBeInTheDocument();
    expect(screen.queryByText(/John Analyst/)).toBeNull();
    expect(screen.queryByText(/Pro Plan/)).toBeNull();
  });

  it("counts the challenges running and the bets settled", async () => {
    renderPage();

    await screen.findByText("David Vilaverde");
    // One of the two challenges is over, and three bets are decided.
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("+4,00 €")).toBeInTheDocument();
  });

  it("saves a new name, which the server writes everywhere", async () => {
    renderPage();

    const input = await screen.findByLabelText("O teu nome");
    fireEvent.change(input, { target: { value: "David V." } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(store.save).toHaveBeenCalledWith("David V."));
  });

  it("will not save a name nobody changed, or an empty one", async () => {
    renderPage();

    const input = await screen.findByLabelText("O teu nome");
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    expect(store.save).not.toHaveBeenCalled();
  });

  it("refuses two passwords that are not the same", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("Nova palavra-passe"), {
      target: { value: "umaboapalavra" },
    });
    fireEvent.change(screen.getByLabelText("Repetir a palavra-passe"), {
      target: { value: "outraqualquer" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Mudar a palavra-passe/ }),
    );

    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(toasts.shown.at(-1)?.title).toBe("As duas não são iguais");
  });

  it("refuses a password too short to be one", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("Nova palavra-passe"), {
      target: { value: "curta" },
    });
    fireEvent.change(screen.getByLabelText("Repetir a palavra-passe"), {
      target: { value: "curta" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Mudar a palavra-passe/ }),
    );

    expect(auth.updatePassword).not.toHaveBeenCalled();
    expect(toasts.shown.at(-1)?.title).toBe("Palavra-passe curta de mais");
  });

  it("changes the password when the two match", async () => {
    renderPage();

    fireEvent.change(await screen.findByLabelText("Nova palavra-passe"), {
      target: { value: "umaboapalavra" },
    });
    fireEvent.change(screen.getByLabelText("Repetir a palavra-passe"), {
      target: { value: "umaboapalavra" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Mudar a palavra-passe/ }),
    );

    await waitFor(() =>
      expect(auth.updatePassword).toHaveBeenCalledWith("umaboapalavra"),
    );
  });

  it("says plainly that clearing this browser leaves the account alone", async () => {
    renderPage();

    await screen.findByText("David Vilaverde");
    expect(
      screen.getByText(/Os desafios e as apostas ficam na tua conta/),
    ).toBeInTheDocument();
  });
});

describe("the round mark a name comes down to", () => {
  it("takes the first and the last", () => {
    expect(initials("David Vilaverde")).toBe("DV");
    expect(initials("Vilagreen")).toBe("VI");
    expect(initials("  ana rita costa ")).toBe("AC");
    expect(initials("")).toBe("?");
  });
});
