import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, Link } from "react-router-dom";

import { PageTransition } from "@/components/PageTransition";
import { forgetWarmedRoutes, routeLoaders, warmRoutes } from "@/lib/routeLoaders";

beforeEach(() => {
  forgetWarmedRoutes();
  vi.restoreAllMocks();
});
afterEach(() => cleanup());

describe("moving between pages", () => {
  it("starts a new page at the top, however far down the last one was", () => {
    // Tapping a challenge from halfway down Início used to open it halfway
    // down, because nothing reset the scroll between pages.
    const scroll = vi.fn();
    vi.stubGlobal("scrollTo", scroll);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PageTransition>
          <Routes>
            <Route
              path="/dashboard"
              element={<Link to="/desafios">Desafios</Link>}
            />
            <Route path="/desafios" element={<p>A lista</p>} />
          </Routes>
        </PageTransition>
      </MemoryRouter>,
    );

    scroll.mockClear();
    fireEvent.click(screen.getByText("Desafios"));

    expect(screen.getByText("A lista")).toBeInTheDocument();
    expect(scroll).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  });
});

describe("fetching the pages before they are asked for", () => {
  it("asks for the ones a tap away, while nothing else is happening", () => {
    const page = { default: () => null };
    const board = vi
      .spyOn(routeLoaders, "probability")
      .mockResolvedValue(page as never);
    const list = vi
      .spyOn(routeLoaders, "challenges")
      .mockResolvedValue(page as never);

    vi.stubGlobal("requestIdleCallback", (run: () => void) => {
      run();
      return 1;
    });

    warmRoutes(["probability", "challenges"]);

    // Both pages are in the module cache before anybody taps anything.
    expect(board).toHaveBeenCalled();
    expect(list).toHaveBeenCalled();
  });

  it("shrugs off a page that fails to arrive early", async () => {
    // A prefetch that fails is not a failure: the tap fetches it again, the
    // normal way. Letting it reject unhandled would take the page down.
    vi.spyOn(routeLoaders, "leagues").mockRejectedValue(new Error("offline"));
    vi.stubGlobal("requestIdleCallback", (run: () => void) => {
      run();
      return 1;
    });

    expect(() => warmRoutes(["leagues"])).not.toThrow();
    await waitFor(() => expect(routeLoaders.leagues).toHaveBeenCalled());
  });

  it("asks only once, however many times it is called", () => {
    const run = vi.fn((callback: () => void) => {
      callback();
      return 1;
    });
    vi.stubGlobal("requestIdleCallback", run);

    warmRoutes([]);
    warmRoutes([]);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("falls back to a timer where the browser has no idle callback", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    const timer = vi.spyOn(window, "setTimeout");

    warmRoutes([]);

    expect(timer).toHaveBeenCalled();
  });
});
