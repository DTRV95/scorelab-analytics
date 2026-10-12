import {
  readPick,
  VERDICT_LABEL,
  type Tone,
} from "@/lib/pickReadings";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

const FIGURE: Record<Tone, string> = {
  forte: "text-[hsl(var(--sl-green))]",
  neutro: "text-foreground",
  fraco: "text-destructive",
};

const PILL: Record<Tone, string> = {
  forte: "sl-pill-win",
  neutro: "sl-pill-muted",
  fraco: "sl-pill-loss",
};

/** Uma palavra, para onde não cabe mais do que isso. */
export function VerdictPill({
  match,
  className = "",
}: {
  match: Parameters<typeof readPick>[0];
  className?: string;
}) {
  const { verdict } = readPick(match);

  return (
    <span className={`sl-pill ${PILL[verdict]} text-[10px] ${className}`}>
      {VERDICT_LABEL[verdict]}
    </span>
  );
}

/**
 * Três números, uma olhadela.
 *
 * Isto já foi três frases e um parágrafo de ressalvas — honesto e ilegível,
 * que num ecrã onde se decide em dez segundos dá no mesmo que não estar lá.
 * Cada pergunta — o mercado, a força do número, o jogo — vale um número: a
 * percentagem de vezes que as escolhas assim entraram, com a amostra por
 * baixo em letra pequena. A cor diz o resto.
 */
export function PickReadings({ match }: { match: BoardMatch }) {
  const { verdict, readings } = readPick(match);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-3.5 pb-1.5 pt-2.5">
        <p className="sl-meta flex-1 text-[10px] uppercase tracking-[0.12em]">
          Escolhas assim
        </p>
        <span className={`sl-pill ${PILL[verdict]} text-[10px]`}>
          {VERDICT_LABEL[verdict]}
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        {readings.map((reading) => (
          <div key={reading.about} className="px-2 py-2 text-center">
            <p className="sl-meta text-[9.5px] uppercase tracking-[0.12em]">
              {reading.about}
            </p>
            <p
              className={`sl-figure text-[18px] leading-6 ${FIGURE[reading.tone]}`}
            >
              {reading.pct === null ? "—" : `${reading.pct}%`}
            </p>
            <p className="sl-meta truncate text-[10px] leading-4">
              {reading.text}
            </p>
            <p className="sl-meta text-[9.5px] leading-4 opacity-70">
              {reading.games} jogos
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
