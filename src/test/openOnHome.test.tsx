import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { OpenOnHome } from "@/components/OpenOnHome";

/** Pretends the app is running from an icon on the home screen, or not. */
function installed(yes: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: yes && query.includes("standalone"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <OpenOnHome />
      <Routes>
        <Route path="/dashboard" element={<p>Início</p>} />
        <Route path="/desafios" element={<p>A lista</p>} />
        <Route path="/desafios/:id" element={<p>Um desafio</p>} />
        <Route path="/reset-password" element={<p>Nova palavra-passe</p>} />
        <Route path="/" element={<p>Apresentação</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sessionStorage.clear();
  installed(false);
});
afterEach(() => cleanup());

describe("launching the app from the icon on the home screen", () => {
  it("lands on Início, whatever address the icon was made at", () => {
    // The icon remembers where it was created. One made while looking at a
    // challenge opened on that challenge for the rest of its life.
    installed(true);

    renderAt("/desafios/abc");

    expect(screen.getByText("Início")).toBeInTheDocument();
  });

  it("leaves a browser tab exactly where it was pointed", () => {
    // In a tab the address is a choice — a challenge somebody was sent, a
    // page somebody bookmarked. Hijacking it breaks every link the app makes.
    installed(false);

    renderAt("/desafios/abc");

    expect(screen.getByText("Um desafio")).toBeInTheDocument();
  });

  it("does not interrupt a link that is being completed", () => {
    installed(true);

    renderAt("/reset-password");

    expect(screen.getByText("Nova palavra-passe")).toBeInTheDocument();
  });

  it("only decides once per launch, so moving around afterwards sticks", () => {
    installed(true);

    // The launch itself.
    const first = renderAt("/desafios/abc");
    expect(screen.getByText("Início")).toBeInTheDocument();
    first.unmount();

    // The same app session, now opening a challenge on purpose. Coming back
    // from the background must not throw away what is on screen.
    renderAt("/desafios/abc");
    expect(screen.getByText("Um desafio")).toBeInTheDocument();
  });

  it("leaves Início alone when that is already the address", () => {
    installed(true);

    renderAt("/dashboard");

    expect(screen.getByText("Início")).toBeInTheDocument();
  });

  it("lets the front door handle the root, instead of racing it", () => {
    // "/" decides for itself: Início for somebody signed in, the public page
    // for everybody else.
    installed(true);

    renderAt("/");

    expect(screen.getByText("Apresentação")).toBeInTheDocument();
  });
});
