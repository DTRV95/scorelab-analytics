import { buildApiUrl } from "@/lib/apiConfig";

/**
 * O que as casas estão a pagar num jogo, pedido ao nosso motor.
 *
 * Vale mais do que parece. O modelo diz o que acha que vai acontecer; o
 * mercado diz o que milhares de pessoas com dinheiro em cima acham. Quando
 * os dois discordam muito, quem costuma estar errado não é o mercado.
 */

export interface MarketPrice {
  odds: Record<string, number>;
  /** Já sem a margem da casa, retirada no servidor. */
  implied: Record<string, number>;
}

export async function fetchMarketPrice(
  league: string,
  home: string,
  away: string,
  kickoff: string | null,
): Promise<MarketPrice | null> {
  if (!kickoff) return null;

  const query = new URLSearchParams({ league, home, away, kickoff });
  const response = await fetch(
    buildApiUrl(`/data/match-context?${query.toString()}`),
  );
  if (!response.ok) return null;

  const data = await response.json();
  // Sem preço não se devolve um objecto vazio: o dossiê distingue "não
  // há" de "não encontrámos", e um vazio apagava essa diferença.
  if (!data?.odds || typeof data.odds !== "object") return null;

  return { odds: data.odds, implied: data.implied_pct ?? {} };
}
