const KEY = "scorelab_seen_plans";

/** userId → planId → when that person last had the challenge open. */
type Seen = Record<string, Record<string, string>>;

/**
 * When each challenge was last looked at.
 *
 * Kept in the browser rather than on the server, and deliberately: this is one
 * person's reading mark, worth nothing to anybody else, and a round trip for
 * it on every page would cost more than it is worth. The price is that a
 * challenge read on the phone still looks new on the laptop.
 *
 * Scoped by user, so two accounts on one browser never inherit each other's
 * marks — the brother's phone is also the brother's.
 */
function read(): Seen {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Seen) : {};
  } catch {
    // Private windows, blocked storage, a half-written value: none of it is
    // worth taking the page down for. Nothing seen is a safe answer.
    return {};
  }
}

export function lastSeen(userId: string, planId: string): string | null {
  if (!userId || !planId) return null;
  return read()[userId]?.[planId] ?? null;
}

/** Every mark this person holds, for reading a whole page's worth at once. */
export function seenByPlan(userId: string): Record<string, string> {
  if (!userId) return {};
  return read()[userId] ?? {};
}

export function markSeen(
  userId: string,
  planId: string,
  at: string = new Date().toISOString()
): void {
  if (!userId || !planId) return;

  try {
    const all = read();
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...all, [userId]: { ...all[userId], [planId]: at } })
    );
  } catch {
    // Not being able to remember is a worse experience, not a broken one.
  }
}
