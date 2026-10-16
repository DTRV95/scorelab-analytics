import { useEffect, useRef, useState } from "react";

/**
 * Um número que anda até ao valor novo, em vez de saltar para ele.
 *
 * Só quando muda: na primeira pintura o valor é o que é, porque abrir uma
 * página não é novidade nenhuma e um número a contar do zero de cada vez
 * que se abre a aplicação cansa à terceira. O salto fica para quem pediu
 * menos movimento ao sistema, e para quem não tem requestAnimationFrame —
 * nos testes, por exemplo, onde o valor final tem de estar lá desde o
 * primeiro render.
 */
export function useCountUp(value: number, durationMs = 650): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const previous = from.current;
    from.current = value;

    if (previous === value) return;

    const still =
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // Uma diferença minúscula não vale uma animação, e um salto enorme
    // (entrar numa conta com mil euros) também não: isto é para mostrar
    // que mexeu, não para contar até lá.
    if (still || Math.abs(value - previous) < 0.01) {
      setShown(value);
      return;
    }

    const started = performance.now();
    const step = (now: number) => {
      const through = Math.min(1, (now - started) / durationMs);
      // Devagar no fim, que é onde o número se lê.
      const eased = 1 - (1 - through) ** 3;
      setShown(previous + (value - previous) * eased);

      if (through < 1) frame.current = window.requestAnimationFrame(step);
      else setShown(value);
    };

    frame.current = window.requestAnimationFrame(step);

    // Rede: num separador em segundo plano, ou num ambiente onde o
    // requestAnimationFrame não corre, o número ficaria parado no valor
    // antigo — que é pior do que não ter animação nenhuma.
    const safety = window.setTimeout(() => setShown(value), durationMs + 80);

    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
      window.clearTimeout(safety);
    };
  }, [value, durationMs]);

  return shown;
}
