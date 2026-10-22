import { buildApiUrl } from "@/lib/apiConfig";

/**
 * O que as casas estão a pagar num jogo, pedido ao nosso motor.
 *
 * Vale mais do que parece. O modelo diz o que acha que vai acontecer; o
 * mercado diz o que milhares de pessoas com dinheiro em cima acham. Quando
 * os dois discordam muito, quem costuma estar errado não é o mercado.
 */

export interface Absence {
  name: string;
  /** Se é certo ou dúvida. */
  status: string;
  /** Porquê — lesão, castigo, o que for. */
  reason?: string;
  /** Quando se espera que volte, quando se sabe. */
  back?: string;
  /** Que posição faz falta. Não diz se era titular — isso não sabemos. */
  position?: string;
}

export interface Headline {
  title: string;
  link: string;
  source: string;
  at: number | null;
}

export interface MatchContext {
  market: MarketPrice | null;
  /**
   * Quem falta, por equipa. Null quando ninguém olhou — que não é o
   * mesmo que uma lista vazia, essa diz que estão todos bons.
   */
  absences: Record<string, Absence[]> | null;
  news: Record<string, Headline[]>;
}

export interface MarketPrice {
  odds: Record<string, number>;
  /** Já sem a margem da casa, retirada no servidor. */
  implied: Record<string, number>;
  /**
   * Quais destes preços ninguém cotou.
   *
   * A fonte só dá 1X2 e totais. O 1X e o 2X saem exactos das três
   * simples — e são os dois mercados que esta casa mais joga — mas não
   * são cotações, são o que as cotações obrigam. Quem lê fica a saber.
   */
  derived: string[];
  /**
   * As duas fontes discordam sobre quem joga em casa.
   *
   * O preço não sofre com isso, porque vai pelo nome da equipa. A nossa
   * previsão sofre: ela conta com um deles a jogar em casa, e essa
   * vantagem vale golos.
   */
  homeAwayDisagrees: boolean;
}

export async function fetchMatchContext(
  league: string,
  home: string,
  away: string,
  kickoff: string | null,
): Promise<MatchContext | null> {
  if (!kickoff) return null;

  const query = new URLSearchParams({ league, home, away, kickoff });
  const response = await fetch(
    buildApiUrl(`/data/match-context?${query.toString()}`),
  );
  if (!response.ok) return null;

  const data = await response.json();

  // Sem preço não se devolve um objecto vazio: o dossiê distingue "não
  // há" de "não encontrámos", e um vazio apagava essa diferença. O
  // mesmo vale para as baixas, e por isso cada parte vem por si.
  const market =
    data?.odds && typeof data.odds === "object"
      ? {
          odds: data.odds,
          implied: data.implied_pct ?? {},
          derived: Array.isArray(data.derived) ? data.derived.map(String) : [],
          homeAwayDisagrees: Boolean(data.home_away_disagrees),
        }
      : null;

  return {
    market,
    absences: data?.absences ?? null,
    news: data?.news ?? {},
  };
}
