import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Section } from "@/components/Section";
import { MARKET_LABELS } from "@/components/ProbabilityBreakdown";
import { timeLabel } from "@/components/TodayMatches";
import type { BoardMatch } from "@/lib/probabilityBoardCache";
import { topByDay } from "@/lib/topGames";
import { minimumOdd, onShortlist } from "@/lib/shortlist";

/**
 * The three games the model is surest about, one day at a time.
 *
 * It was the three strongest of the whole week, which on a Monday meant
 * three games on Saturday: everything worth knowing about today was behind
 * them. A day at a time is how anybody decides what to back, and it is the
 * same question the challenge asks every evening.
 *
 * It looks like a shelf on purpose. On the challenge page this sits next to
 * the bet waiting to be closed, and the two were the same white card with
 * the same type in it — one is a list of things to choose from, the other is
 * money already on the table, and nothing on screen said which was which.
 * So: a tinted panel with the games as cards inside it, each ending in the
 * arrow that means "there is more behind this one".
 */
export function TopGames({ board }: { board: BoardMatch[] }) {
  const days = useMemo(() => topByDay(board), [board]);
  const [active, setActive] = useState(0);

  if (days.length === 0) return null;

  const day = days[Math.min(active, days.length - 1)];

  return (
    <Section
      tone="cool"
      icon={Sparkles}
      title="Os mais prováveis"
      action={
        <Link
          to="/probability"
          className="sl-tap sl-meta flex items-center gap-1 text-[11px]"
        >
          Ver todos <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >

      {/* The same days as the Jogos page, in the same order, so the two
          pages are never one tap out of step with each other. */}
      {days.length > 1 && (
        <div className="sl-scroll-x flex gap-1.5 overflow-x-auto px-2 pb-2.5">
          {days.map((option, index) => (
            <button
              key={option.long}
              type="button"
              onClick={() => setActive(index)}
              className={`sl-tap flex-none rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                index === Math.min(active, days.length - 1)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground ring-1 ring-border"
              }`}
            >
              {option.short}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {day.items.map((match, index) => (
          // Into the game itself, with its fifteen markets: the row carries
          // the one number the model is most sure of and no way to ask it
          // anything else.
          <Link
            key={match.fixture_id}
            to={`/match/${match.fixture_id}`}
            className="sl-tap flex items-center gap-2.5 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border transition-colors hover:ring-primary/40"
          >
            {/* Um número, não uma medalha: a bolinha comia vinte pixels
                de largura e os nomes das equipas passaram a ser cortados. */}
            <span className="sl-figure w-2.5 flex-none text-[11px] text-muted-foreground">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-bold tracking-[-0.015em] text-foreground">
                {match.home_name} vs {match.away_name}
              </p>
              {/* O mercado passou da coluna da direita para aqui: é o nome
                  da coisa, não um número, e à direita estava a roubar
                  largura ao que lá devia estar sozinho. */}
              <p className="truncate text-[11.5px] font-semibold text-foreground/80">
                {MARKET_LABELS[match.headline_market] ?? match.headline_market}
              </p>
              {/* A distância para a taxa da liga esteve aqui e saiu: nos
                  jogos já marcados, quanto maior essa distância pior foi o
                  acerto — 64% nos de +10 pp contra 74% nos de menos de +5.
                  No lugar dela fica a única coisa que decide se um acerto
                  vale dinheiro, que é o preço. */}
              {/* Dos destaques do quadro, os da lista curta entraram 87%
                  das vezes e os outros 53%: é a coisa mais útil desta linha
                  e estava escrita a miudinho. A marca passou a andar na
                  mesma linha da liga em vez de abrir uma só para ela. */}
              <p className="sl-meta flex items-center gap-1.5 text-[11px]">
                {/* A hora primeiro: é o que decide se ainda dá para apostar.
                    Com a liga à frente, era a hora que o corte comia. */}
                <span className="truncate">
                  {match.kickoff
                    ? `${timeLabel(new Date(match.kickoff))} · `
                    : ""}
                  {match.league}
                </span>
                {onShortlist(match) && (
                  <span className="sl-pill sl-pill-win flex-none px-1.5 py-0 text-[9.5px]">
                    lista curta
                  </span>
                )}
              </p>
            </div>
            {/* A direita fica com uma coisa só, e grande: a probabilidade.
                Tinha três linhas a disputá-la — o número, o mercado e o
                preço — e por isso o número lia-se a 13px, que para o
                assunto da linha é pequeno. */}
            <div className="flex-none text-right">
              <p className="sl-figure text-[22px] leading-none text-[hsl(var(--sl-green))]">
                {match.headline_pct.toFixed(0)}
                <span className="text-[13px]">%</span>
              </p>
              <p className="sl-meta mt-1 whitespace-nowrap text-[10px]">
                odd mín.{" "}
                <span className="font-mono-data font-bold text-foreground">
                  {minimumOdd(match.headline_pct).toFixed(2)}
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
