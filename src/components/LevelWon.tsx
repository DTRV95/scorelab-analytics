import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

/** Onde caem os pontos. Fixos, para serem sempre os mesmos. */
const CONFETTI = [
  { x: -120, y: -60, delay: 0 },
  { x: 110, y: -80, delay: 0.04 },
  { x: -70, y: -130, delay: 0.08 },
  { x: 80, y: -140, delay: 0.02 },
  { x: -150, y: 20, delay: 0.1 },
  { x: 140, y: 10, delay: 0.06 },
  { x: -40, y: -170, delay: 0.12 },
  { x: 40, y: -175, delay: 0.09 },
];

/**
 * O momento em que um nível se fecha ganho.
 *
 * É a única coisa que esta aplicação tem para festejar, e por isso é a
 * única que leva o ecrã inteiro: um nível que subiu e o dinheiro que
 * entrou. Um nível perdido não leva nada disto — nem festa ao contrário,
 * nem consolo, nem um "tenta outra vez" que é o que faz uma pessoa ir
 * atrás do dinheiro que acabou de perder.
 *
 * Sai sozinho ao fim de dois segundos e meio, ou ao primeiro toque. E quem
 * pediu menos movimento ao sistema recebe a mesma mensagem sem nada a
 * saltar.
 */
export function LevelWon({
  won,
  onDone,
}: {
  won: { day: number; amount: number } | null;
  onDone: () => void;
}) {
  const still = useReducedMotion();

  useEffect(() => {
    if (!won) return;
    const timer = window.setTimeout(onDone, 2500);
    return () => window.clearTimeout(timer);
  }, [won, onDone]);

  return (
    <AnimatePresence>
      {won && (
        <motion.button
          type="button"
          aria-label="Fechar"
          onClick={onDone}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[hsl(var(--sl-ink))]/45 px-8 backdrop-blur-[2px]"
        >
          <div className="relative">
            {!still &&
              CONFETTI.map((dot, index) => (
                <motion.span
                  key={index}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    x: dot.x,
                    y: dot.y,
                    scale: 1,
                  }}
                  transition={{
                    duration: 1.1,
                    delay: dot.delay,
                    ease: "easeOut",
                  }}
                  className={`absolute left-1/2 top-1/2 h-2 w-2 rounded-full ${
                    index % 3 === 0
                      ? "bg-[hsl(var(--sl-green))]"
                      : index % 3 === 1
                        ? "bg-primary"
                        : "bg-[hsl(var(--warning))]"
                  }`}
                />
              ))}

            <motion.div
              initial={still ? false : { scale: 0.8, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 20 }}
              className="sl-raised relative px-7 py-6 text-center"
            >
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--sl-green))]/14 text-[hsl(var(--sl-green))]">
                <Trophy className="h-5 w-5" />
              </span>

              <p className="sl-sec-eyebrow mt-3">Nível {won.day} fechado</p>
              <p className="sl-figure mt-1 text-[30px] leading-9 text-[hsl(var(--sl-green))]">
                +{eur.format(won.amount)}
              </p>
              <p className="sl-meta mt-1 text-[11.5px]">
                Vais no nível {won.day + 1}.
              </p>
            </motion.div>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
