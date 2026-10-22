import { useEffect, useState } from "react";
import { SuggestionCard } from "@/components/SuggestionCard";
import { fetchMatchContext, type MatchContext } from "@/lib/marketPrice";
import { adjustments, fetchMarketCalibration } from "@/lib/marketCalibration";
import { fetchLeagueAccuracy, type AccuracyMarket } from "@/lib/modelAccuracy";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

/**
 * A opinião sobre um jogo do quadro, sem sair do quadro.
 *
 * O cartão sabe decidir mas não sabe ir buscar nada, e no quadro não há
 * nada à mão: nem preço, nem o registo do modelo naquela liga, nem o
 * exagero medido por mercado. Isto vai buscar as três coisas e só
 * quando a linha abre — o preço vem de uma fonte com quinhentas
 * chamadas por mês, e carregá-lo para cem linhas que ninguém abriu era
 * ficar sem nenhuma para as que se abrem mesmo.
 *
 * Enquanto não chega, o cartão desenha-se na mesma com o que há. Sem
 * preço ele diz "ainda é cedo", que é falso durante dois segundos e
 * verdadeiro no resto do tempo; o contrário — um buraco à espera — era
 * pior em todos os casos.
 */
export function MatchSuggestion({
  match,
  active,
}: {
  match: BoardMatch;
  /** A linha está aberta. Fechada, não se pede nada a ninguém. */
  active: boolean;
}) {
  const [context, setContext] = useState<MatchContext | null>(null);
  const [record, setRecord] = useState<Map<string, AccuracyMarket>>(new Map());
  const [tuning, setTuning] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    fetchMatchContext(
      match.league,
      match.home_name,
      match.away_name,
      match.kickoff,
    )
      .then((found) => {
        if (!cancelled) setContext(found);
      })
      .catch(() => undefined);

    fetchLeagueAccuracy(match.league)
      .then((report) => {
        if (cancelled) return;
        setRecord(new Map(report.markets.map((row) => [row.market, row])));
      })
      .catch(() => undefined);

    fetchMarketCalibration()
      .then((rows) => {
        if (!cancelled) setTuning(adjustments(rows));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [active, match.league, match.home_name, match.away_name, match.kickoff]);

  return (
    <SuggestionCard
      markets={match.mercados}
      amostraPct={match.amostra_pct}
      prices={context?.market?.odds ?? null}
      implied={context?.market?.implied ?? null}
      derived={context?.market?.derived ?? []}
      record={record}
      adjustments={tuning}
      sample={{ label: match.amostra_label, pct: match.amostra_pct }}
    />
  );
}
