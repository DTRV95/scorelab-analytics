import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { LeagueCalibration } from "@/components/LeagueCalibration";

const payload = {
  leagues: {
    "Liga Portugal": {
      league_home_goals_avg: 1.61,
      league_away_goals_avg: 1.09,
      sample_matches: 34,
    },
  },
  pending: ["Serie A"],
};

function mockCalibration(body: unknown = payload, ok = true) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LeagueCalibration", () => {
  it("replaces the league baseline with measured season averages", async () => {
    mockCalibration();
    const onCalibrate = vi.fn();

    render(<LeagueCalibration league="Liga Portugal" onCalibrate={onCalibrate} />);

    await waitFor(() =>
      expect(onCalibrate).toHaveBeenCalledWith({
        league_home_goals_avg: "1.61",
        league_away_goals_avg: "1.09",
      })
    );

    expect(await screen.findByText(/calibrada com a época em curso/i)).toBeInTheDocument();
    expect(screen.getByText(/34 jogos/)).toBeInTheDocument();
  });

  it("stays out of the way for leagues without live data", async () => {
    mockCalibration();
    const onCalibrate = vi.fn();

    const { container } = render(
      <LeagueCalibration league="Primera B Chile" onCalibrate={onCalibrate} />
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(onCalibrate).not.toHaveBeenCalled();
  });

  it("never breaks the form when the engine is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const onCalibrate = vi.fn();

    const { container } = render(
      <LeagueCalibration league="Liga Portugal" onCalibrate={onCalibrate} />
    );

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    expect(onCalibrate).not.toHaveBeenCalled();
  });
});
