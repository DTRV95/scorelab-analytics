import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const auth = vi.hoisted(() => ({
  state: { session: null as unknown, loading: false },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => auth.state,
}));

import { FrontDoor } from "@/components/ProtectedRoute";

afterEach(() => cleanup());

function renderDoor() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <FrontDoor>
              <p>Página de apresentação</p>
            </FrontDoor>
          }
        />
        <Route path="/dashboard" element={<p>Início</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("what the app opens on", () => {
  it("opens on Início for somebody already signed in", () => {
    auth.state = { session: { user: { id: "david" } }, loading: false };

    renderDoor();

    expect(screen.getByText("Início")).toBeInTheDocument();
  });

  it("shows what this is to somebody who is not", () => {
    auth.state = { session: null, loading: false };

    renderDoor();

    expect(screen.getByText("Página de apresentação")).toBeInTheDocument();
  });

  it("waits rather than guessing while the session is still loading", () => {
    // Guessing would flash the sales page at everybody, on every visit.
    auth.state = { session: null, loading: true };

    renderDoor();

    expect(screen.queryByText("Página de apresentação")).not.toBeInTheDocument();
    expect(screen.queryByText("Início")).not.toBeInTheDocument();
  });
});
