import { canonicalMarket } from "@/lib/marketNames";
import type { PlanLeg } from "@/lib/planStore";

/**
 * A bet read the way a betting slip reads it.
 *
 * The list of registered bets said "Benfica vs Porto + Sporting vs Braga" on
 * one line and the markets on the next, which is how four separate bets end up
 * looking like the legs of a single one. A slip says three things instead:
 * what kind of bet it is, what was actually backed on each game, and what it
 * pays. This works out the first two.
 */

/** Simples, Dupla, Tripla — what everybody calls a bet with this many games. */
export function slipKind(legs: number): string {
  if (legs <= 1) return "Simples";
  if (legs === 2) return "Dupla";
  if (legs === 3) return "Tripla";
  return `Múltipla de ${legs}`;
}

/** The half of a combination that names a result, written with the teams in. */
function resultPart(part: string, home: string, away: string): string | null {
  if (part === "Casa") return home || "Casa";
  if (part === "Fora") return away || "Fora";
  if (part === "Empate") return "Empate";
  if (part === "1X") return home ? `${home} ou Empate` : "Casa ou Empate";
  if (part === "2X") return away ? `${away} ou Empate` : "Fora ou Empate";
  if (part === "12") return home && away ? `${home} ou ${away}` : "Casa ou Fora";
  return null;
}

const NAMED: Record<string, string> = {
  "Ambas Marcam": "Ambas Marcam",
  "BTTS No": "Ambas Não Marcam",
};

/**
 * What was backed, said with the team's name in it.
 *
 * "1X e Mais de 1.5 Golos" is the market's name, not the bet: the bet was
 * Benfica or empate, and mais de 1.5 golos. The name of the team is the part
 * somebody recognises at a glance three weeks later.
 */
export function pickLabel(leg: PlanLeg): string {
  const canonical = canonicalMarket(leg.market);
  const home = (leg.homeTeam ?? "").trim();
  const away = (leg.awayTeam ?? "").trim();

  const parts = canonical.split(/\s+e\s+/).filter(Boolean);
  if (parts.length === 0) return canonical;

  const written = parts.map(
    (part) => resultPart(part, home, away) ?? NAMED[part] ?? part,
  );

  return written.join(" e ");
}

function familyOf(part: string): string | null {
  if (part === "Casa" || part === "Fora" || part === "Empate")
    return "Resultado final";
  if (part === "1X" || part === "2X" || part === "12") return "Hipótese dupla";
  if (/^(Mais|Menos) de /.test(part)) return "Total de golos";
  if (part === "Ambas Marcam" || part === "BTTS No") return "Ambas marcam";
  return null;
}

/**
 * The kind of market, under the pick: "Hipótese dupla & Total de golos".
 *
 * Empty for anything this cannot name — a handicap, a market somebody typed in
 * their own words — because a wrong label under a bet is worse than none.
 */
export function marketFamily(market: string): string {
  const parts = canonicalMarket(market).split(/\s+e\s+/).filter(Boolean);
  const families: string[] = [];

  for (const part of parts) {
    const family = familyOf(part);
    if (!family) return "";
    if (!families.includes(family)) families.push(family);
  }

  return families.join(" & ");
}
