const KEY = "scorelab_seen_achievements";

/** userId → ids das conquistas que esta pessoa já viu ganhas. */
type Seen = Record<string, string[]>;

/**
 * Quais já foram vistas.
 *
 * Fica no browser, como a marca de leitura dos desafios: é a marca de uma
 * pessoa, não vale nada para mais ninguém, e uma ida ao servidor por cada
 * abertura da página custava mais do que vale. O preço é que uma conquista
 * vista no telemóvel volta a brilhar uma vez no computador — que para uma
 * medalha não é um problema.
 */
function read(): Seen {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Seen) : {};
  } catch {
    return {};
  }
}

export function seenAchievements(userId: string): string[] {
  if (!userId) return [];
  const mine = read()[userId];
  return Array.isArray(mine) ? mine : [];
}

export function markAchievementsSeen(userId: string, ids: string[]): void {
  if (!userId || ids.length === 0) return;

  try {
    const all = read();
    const mine = new Set([...(all[userId] ?? []), ...ids]);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ ...all, [userId]: [...mine] }),
    );
  } catch {
    // Não conseguir guardar faz a medalha brilhar outra vez, e mais nada.
  }
}
