import { useEffect, useState } from "react";
import { SuggestionCard } from "@/components/SuggestionCard";
import { fetchMatchContext, type MatchContext } from "@/lib/marketPrice";
import { adjustments, fetchMarketCalibration } from "@/lib/marketCalibration";
import { fetchLeagueAccuracy, type AccuracyMarket } from "@/lib/modelAccuracy";
import { fetchSettledLegs, readPatterns, type Patterns } from "@/lib/betPatterns";
import { keepSuggestion } from "@/lib/suggestionRecord";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

/**
 * A opinião sobre um jogo, com tudo o que ela precisa de saber.
 *
 * O cartão sabe decidir mas não sabe ir buscar nada, e não há nada à
 * mão: nem preço, nem o registo do modelo naquela liga, nem o exagero
 * medido por mercado, nem o que o nosso dinheiro já fez em mercados
 * assim. Isto vai buscar as quatro coisas.
 *
 * E só decide quando as quatro chegarem. Antes disto o cartão desenhava
 * com o que tinha, que era só o número do modelo, e passados dois ou
 * três segundos mudava de ideias à frente de quem estava a ler — a
 * primeira coisa que se via não era a sugestão, era o modelo em bruto,
 * que é precisamente o contrário do que este cartão existe para ser.
 *
 * Entre uma resposta errada já e a certa daqui a um instante, vale a
 * certa. Até lá o cartão diz o que está a fazer.
 *
 * No quadro, só quando a linha abre: o preço vem de uma fonte com
 * quinhentas chamadas por mês, e carregá-lo para cem linhas que ninguém
 * abriu era ficar sem nenhuma para as que se abrem mesmo. O que se pede
 * fica guardado por sessão, por isso abrir a mesma linha outra vez já
 * não custa nada nem volta a mostrar o relógio.
 */
export function MatchSuggestion({
  match,
  active = true,
}: {
  match: BoardMatch;
  /** A linha está aberta. Fechada, não se pede nada a ninguém. */
  active?: boolean;
}) {
  const [context, setContext] = useState<MatchContext | null>(null);
  const [record, setRecord] = useState<Map<string, AccuracyMarket>>(new Map());
  const [tuning, setTuning] = useState<Record<string, number>>({});
  const [patterns, setPatterns] = useState<Patterns | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const vai = <T,>(ask: Promise<T>, keep: (found: T) => void) =>
      ask.then((found) => {
        if (!cancelled) keep(found);
      });

    Promise.allSettled([
      vai(
        fetchMatchContext(
          match.league,
          match.home_name,
          match.away_name,
          match.kickoff,
        ),
        setContext,
      ),
      vai(fetchLeagueAccuracy(match.league), (report) =>
        setRecord(new Map(report.markets.map((row) => [row.market, row]))),
      ),
      vai(fetchMarketCalibration(), (rows) => setTuning(adjustments(rows))),
      vai(fetchSettledLegs(), (legs) => setPatterns(readPatterns(legs))),
    ]).then(() => {
      // Uma que falhe não prende o cartão: decide-se com o que houver,
      // que é melhor do que um relógio a girar para sempre.
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [active, match.league, match.home_name, match.away_name, match.kickoff]);

  return (
    <SuggestionCard
      loading={!ready}
      markets={match.mercados}
      amostraPct={match.amostra_pct}
      prices={context?.market?.odds ?? null}
      implied={context?.market?.implied ?? null}
      derived={context?.market?.derived ?? []}
      record={record}
      adjustments={tuning}
      absences={context?.absences ?? null}
      teams={{ home: match.home_name, away: match.away_name }}
      homeAwayDisagrees={context?.market?.homeAwayDisagrees ?? false}
      patterns={patterns}
      goals={{
        home: match.lambda_casa,
        away: match.lambda_fora,
        total: match.total_golos_esperados,
      }}
      headline={match.headline_market}
      sample={{ label: match.amostra_label, pct: match.amostra_pct }}
      /* O que se diz fica escrito com o preço do dia, para daqui a um
         mês se saber se valeu alguma coisa. A primeira é a que conta:
         a tabela não aceita correcções. */
      onDecided={(decided) =>
        void keepSuggestion(
          match.fixture_id,
          match.league,
          match.kickoff,
          decided,
        ).catch(() => undefined)
      }
    />
  );
}
