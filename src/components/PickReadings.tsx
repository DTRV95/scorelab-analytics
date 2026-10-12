import { Check, Minus, X } from "lucide-react";
import {
  readPick,
  VERDICT_LABEL,
  type PickReading,
  type Tone,
} from "@/lib/pickReadings";
import type { BoardMatch } from "@/lib/probabilityBoardCache";

const TONE: Record<Tone, { icon: typeof Check; colour: string }> = {
  forte: { icon: Check, colour: "text-[hsl(var(--sl-green))]" },
  neutro: { icon: Minus, colour: "text-muted-foreground" },
  fraco: { icon: X, colour: "text-destructive" },
};

const PILL: Record<Tone, string> = {
  forte: "sl-pill-win",
  neutro: "sl-pill-muted",
  fraco: "sl-pill-loss",
};

const ASKS: Record<PickReading["about"], string> = {
  mercado: "o mercado",
  força: "a força",
  jogo: "o jogo",
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
 * O que o registo do quadro diz sobre esta escolha, linha a linha.
 *
 * Três perguntas separadas, porque escolher o mercado e escolher o jogo são
 * duas decisões diferentes e os números dizem coisas diferentes sobre cada
 * uma. Cada linha leva atrás o número de jogos de onde saiu: num registo de
 * duas semanas, uma leitura de quinze jogos e uma de cinquenta e sete não
 * valem o mesmo, e esconder isso seria vender como regra o que ainda é
 * indício.
 */
export function PickReadings({ match }: { match: BoardMatch }) {
  const { verdict, readings } = readPick(match);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
        <p className="flex-1 text-[12px] font-semibold text-foreground">
          O que o registo diz desta escolha
        </p>
        <span className={`sl-pill ${PILL[verdict]} text-[10px]`}>
          {VERDICT_LABEL[verdict]}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {readings.map((reading) => {
          const { icon: Icon, colour } = TONE[reading.tone];
          return (
            <li
              key={reading.about}
              className="flex items-start gap-2.5 px-3.5 py-2"
            >
              <Icon className={`mt-0.5 h-3.5 w-3.5 flex-none ${colour}`} />
              <div className="min-w-0 flex-1">
                <p className="sl-meta text-[10px] uppercase tracking-[0.1em]">
                  {ASKS[reading.about]}
                </p>
                <p className="text-[11.5px] leading-5 text-foreground">
                  {reading.text}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="sl-meta border-t border-border px-3.5 py-2 text-[10px] leading-4">
        Medido em 82 jogos do próprio quadro, já jogados, previstos outra vez
        a partir da liga como estava antes de cada apito. São duas semanas:
        tratem isto como indício, não como regra.
      </p>
    </div>
  );
}
