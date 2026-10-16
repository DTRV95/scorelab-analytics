import { useEffect, useRef, useState } from "react";

/** Quanto é preciso puxar para valer como pedido. */
export const PULL_THRESHOLD = 72;

/**
 * Puxar para baixo, no topo da página, para ir buscar outra vez.
 *
 * O gesto que toda a gente tenta antes de procurar um botão. Está escrito
 * com cuidado para nunca estragar o que já funcionava:
 *
 *  - só começa com a página mesmo no topo e com um dedo;
 *  - nunca chama preventDefault, por isso o scroll normal e o efeito de
 *    borracha do iOS continuam exactamente como são;
 *  - um gesto que acabe por ser horizontal, ou que suba, é abandonado;
 *  - com o rato não faz nada: é um gesto de dedo.
 *
 * Devolve o quanto está puxado, em pixels, para quem quiser desenhar o
 * indicador. Zero quer dizer que não está a acontecer nada.
 */
export function usePullToRefresh({
  onRefresh,
  disabled = false,
}: {
  onRefresh: () => void;
  disabled?: boolean;
}): number {
  const [pulled, setPulled] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const live = useRef(false);
  // O valor mais recente, para o fim do gesto não ler um estado velho.
  const pulledRef = useRef(0);
  pulledRef.current = pulled;
  // Guardado numa referência para os ouvintes serem postos uma vez, e não
  // a cada render só porque quem chama passou outra função igual.
  const fire = useRef(onRefresh);
  fire.current = onRefresh;

  useEffect(() => {
    if (disabled) return;

    const begin = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (window.scrollY > 0) return;
      start.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
      };
      live.current = false;
    };

    const move = (event: TouchEvent) => {
      const from = start.current;
      if (!from || event.touches.length !== 1) return;

      const dy = event.touches[0].clientY - from.y;
      const dx = Math.abs(event.touches[0].clientX - from.x);

      // A subir, de lado, ou já com a página rolada: não é este gesto.
      if (dy <= 0 || dx > dy || window.scrollY > 0) {
        start.current = null;
        setPulled(0);
        return;
      }

      live.current = true;
      // Resistência: os primeiros pixels andam, os seguintes custam mais,
      // que é o que faz o gesto parecer preso ao dedo.
      setPulled(Math.min(PULL_THRESHOLD * 1.6, dy * 0.55));
    };

    const end = () => {
      const was = live.current;
      const far = pulledRef.current >= PULL_THRESHOLD;
      start.current = null;
      live.current = false;
      setPulled(0);
      if (was && far) fire.current();
    };

    window.addEventListener("touchstart", begin, { passive: true });
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end, { passive: true });
    window.addEventListener("touchcancel", end, { passive: true });

    return () => {
      window.removeEventListener("touchstart", begin);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("touchend", end);
      window.removeEventListener("touchcancel", end);
    };
  }, [disabled]);

  return pulled;
}
