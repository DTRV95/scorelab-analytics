import { useEffect, useMemo, useState } from "react";
import { Medal } from "lucide-react";
import { Section } from "@/components/Section";
import { achievements, type Achievement } from "@/lib/achievements";
import {
  markAchievementsSeen,
  seenAchievements,
} from "@/lib/achievementsSeen";
import type { PlanBet } from "@/lib/planStore";

/** Uma medalha tem de se ver: fundo da cor do que é, e um aro por cima. */
const TONE: Record<Achievement["tone"], string> = {
  discipline:
    "bg-[hsl(var(--sl-green))]/14 text-[hsl(var(--sl-green))] ring-1 ring-[hsl(var(--sl-green))]/25",
  record:
    "bg-[hsl(var(--sl-cool))]/12 text-[hsl(var(--sl-cool))] ring-1 ring-[hsl(var(--sl-cool))]/25",
  ladder: "bg-primary/12 text-primary ring-1 ring-primary/25",
};

/**
 * As conquistas, e a que vem a seguir.
 *
 * Ganham-se por aceitar o preço certo, escolher o que o quadro mede bem e
 * manter o registo em dia — nunca por apostar mais, que seria a maneira
 * fácil de fazer isto e a única que podia fazer mal a alguém.
 *
 * Uma conquista nova brilha uma vez: ao abrir a página fica marcada como
 * vista, e da próxima é uma medalha como as outras.
 */
export function Achievements({
  bets,
  level = 0,
  userId,
}: {
  bets: PlanBet[];
  /** O nível mais alto a que chegou em qualquer desafio. */
  level?: number;
  userId: string;
}) {
  const view = useMemo(() => achievements(bets, level), [bets, level]);

  // Lido uma vez, na montagem: se fosse lido a cada render, marcar como
  // vistas apagava o brilho no mesmo instante em que ele aparecia.
  const [seen] = useState(() => new Set(seenAchievements(userId)));

  const fresh = view.earned.filter((item) => !seen.has(item.id));

  useEffect(() => {
    if (fresh.length === 0) return;
    const timer = window.setTimeout(
      () => markAchievementsSeen(userId, fresh.map((item) => item.id)),
      1200,
    );
    return () => window.clearTimeout(timer);
  }, [fresh, userId]);

  // Sem nada ganho e sem nada perto, isto seria uma prateleira vazia a
  // dizer a alguém que ainda não fez nada.
  if (view.earned.length === 0) return null;

  const next = view.next;
  const pct = next
    ? Math.min(100, Math.round((next.value / next.target) * 100))
    : 100;

  return (
    <Section
      tone="green"
      icon={Medal}
      eyebrow="Conquistas"
      title={
        fresh.length === 1
          ? `Ganhaste: ${fresh[0].title}`
          : fresh.length > 1
            ? `Ganhaste ${fresh.length} novas`
            : `${view.earned.length} de ${view.all.length}`
      }
      count={fresh.length > 0 ? fresh.length : undefined}
      className="space-y-2"
    >
      <div className="flex flex-wrap gap-1.5 px-0.5">
        {view.earned.map((item) => {
          const isNew = !seen.has(item.id);
          return (
            <span
              key={item.id}
              title={item.note}
              className={`sl-pill text-[11px] ${TONE[item.tone]} ${
                isNew ? "ring-2 ring-offset-1 ring-offset-transparent" : ""
              }`}
            >
              {item.title}
              {isNew && <span className="text-[9px] font-bold">novo</span>}
            </span>
          );
        })}
      </div>

      {next && (
        <div className="rounded-xl bg-card px-3.5 py-2.5 ring-1 ring-border">
          <div className="flex items-baseline justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-foreground">
              A seguir: {next.title}
            </p>
            <p className="sl-figure flex-none text-[12px] text-muted-foreground">
              {Math.min(next.value, next.target)}/{next.target}
            </p>
          </div>

          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--sl-surface))]">
            <div
              className="h-full rounded-full bg-[hsl(var(--sl-green))]"
              style={{ width: `${Math.max(pct, 3)}%` }}
            />
          </div>

          <p className="sl-meta mt-1.5 text-[11px] leading-5">{next.note}</p>
        </div>
      )}
    </Section>
  );
}
