import { Link } from "react-router-dom";
import { Swords } from "lucide-react";
import { describeNews, type NewsItem } from "@/lib/planNews";
import type { Rivalry } from "@/lib/rivals";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** How long ago, in the words somebody would use out loud. */
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

function Row({ rivalry, news }: { rivalry: Rivalry; news: NewsItem[] }) {
  const { plan, me, closest, gap, early } = rivalry;
  const ahead = gap > 0;
  const level = gap === 0;

  // The whole point of the card: the sentence somebody would say out loud.
  const headline = level
    ? `Estás empatado com ${closest.name}`
    : ahead
      ? `Estás ${eur.format(gap)} à frente de ${closest.name}`
      : `Estás ${eur.format(Math.abs(gap))} atrás de ${closest.name}`;

  // A split bar needs two parts of a whole, and a loss is not a part of
  // anything: at -7,15 € against +9,64 € it drew the one losing more as the
  // longer side. Each profit gets its own bar from a shared middle instead,
  // which is the only shape that survives a negative number.
  const scale = Math.max(Math.abs(me.profit), Math.abs(closest.profit), 1);
  const sides = [
    { name: "Tu", profit: me.profit, mine: true },
    { name: closest.name, profit: closest.profit, mine: false },
  ];

  return (
    <Link
      to={`/desafios/${plan.id}`}
      className="sl-tap block border-t border-border px-4 py-3 first:border-t-0"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-semibold text-foreground">
          {plan.name}
        </span>
        {news.length > 0 && (
          <span className="flex-none rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary">
            {news.length === 1 ? "1 novidade" : `${news.length} novidades`}
          </span>
        )}
      </div>

      <p
        className={`mt-1 text-[13px] font-semibold leading-5 ${
          level
            ? "text-foreground"
            : ahead
              ? "text-[hsl(var(--sl-green))]"
              : "text-destructive"
        }`}
      >
        {headline}
      </p>

      <div className="mt-1.5 space-y-1">
        {sides.map((side) => {
          const up = side.profit >= 0;
          const half = (Math.abs(side.profit) / scale) * 50;

          return (
            <div key={side.name} className="flex items-center gap-2">
              <span
                className={`w-16 flex-none truncate text-[11px] ${
                  side.mine
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {side.name}
              </span>

              <div className="relative h-1.5 min-w-0 flex-1 rounded-full bg-muted">
                <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                {side.profit !== 0 && (
                  <div
                    className={`absolute inset-y-0 rounded-full ${
                      up ? "bg-[hsl(var(--sl-green))]" : "bg-destructive"
                    }`}
                    style={
                      up
                        ? { left: "calc(50% + 1px)", width: `${Math.max(half, 1)}%` }
                        : { right: "calc(50% + 1px)", width: `${Math.max(half, 1)}%` }
                    }
                  />
                )}
              </div>

              <span className="sl-figure w-14 flex-none text-right text-[11px] text-foreground">
                {up ? "+" : ""}
                {eur.format(side.profit)}
              </span>
            </div>
          );
        })}
      </div>

      {news.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {news.slice(0, 3).map((item) => (
            <li key={`${item.kind}-${item.at}-${item.day}`} className="sl-meta text-[11px]">
              {describeNews(item)} · {ago(item.at)}
            </li>
          ))}
        </ul>
      )}

      {early && news.length === 0 && (
        <p className="sl-meta mt-1 text-[10px]">
          Poucos dias fechados para isto querer dizer muito.
        </p>
      )}
    </Link>
  );
}

/**
 * Who you are playing against, and what they did while you were away.
 *
 * The home page said only what this person had to do next, which is the job
 * but not the reason: two brothers running the same challenge find out what
 * the other did by opening the challenge and noticing. Nothing ever told
 * them. This is the part of the app that is about somebody else.
 */
export function HomeRivals({
  rivalries,
  news,
}: {
  rivalries: Rivalry[];
  /** Everything the others did since this person last looked, any challenge. */
  news: NewsItem[];
}) {
  if (rivalries.length === 0) return null;

  return (
    <section className="sl-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Swords className="h-3.5 w-3.5 text-muted-foreground" />
          Frente a frente
        </h2>
      </div>

      {rivalries.map((rivalry) => (
        <Row
          key={rivalry.plan.id}
          rivalry={rivalry}
          news={news.filter((item) => item.planId === rivalry.plan.id)}
        />
      ))}
    </section>
  );
}
