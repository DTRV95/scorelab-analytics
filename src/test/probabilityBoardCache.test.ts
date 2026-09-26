import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readCachedBoard,
  writeCachedBoard,
  type BoardMatch,
} from "@/lib/probabilityBoardCache";

const match = { fixture_id: 1, league: "Eredivisie" } as unknown as BoardMatch;

describe("keeping the last board", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  });

  it("holds a complete board for the afternoon", () => {
    writeCachedBoard({ days: 7, matches: [match], unavailable: [], skipped: 0 });

    vi.setSystemTime(new Date("2026-09-26T13:30:00Z"));
    expect(readCachedBoard(7)?.matches).toHaveLength(1);
  });

  it("lets go of a board that came back with a competition missing", () => {
    // The usual reason is the provider's per-minute limit, which clears on its
    // own. Holding the incomplete board for two hours is what turned a passing
    // rate limit into a league with "no games" all afternoon.
    writeCachedBoard({
      days: 7,
      matches: [match],
      unavailable: ["Eredivisie"],
      skipped: 0,
    });

    vi.setSystemTime(new Date("2026-09-26T12:03:00Z"));
    expect(readCachedBoard(7)).not.toBeNull();

    vi.setSystemTime(new Date("2026-09-26T12:07:00Z"));
    expect(readCachedBoard(7)).toBeNull();
  });
});
