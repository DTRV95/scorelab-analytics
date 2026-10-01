import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom has no ResizeObserver, and recharts' ResponsiveContainer asks for one
// the moment a chart mounts. Without this the exception takes the whole page
// down, so a page with a chart on it cannot be tested at all.
class StubResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: StubResizeObserver,
});

globalThis.ResizeObserver =
  StubResizeObserver as unknown as typeof ResizeObserver;
