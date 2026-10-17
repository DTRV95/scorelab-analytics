import { useEffect, useState } from "react";

/**
 * Se a página já saiu do topo.
 *
 * Serve para a barra de cima encolher e ganhar sombra assim que há conteúdo
 * a passar por baixo dela — é o que a faz parecer pousada sobre a página em
 * vez de pintada no cimo dela. Lê o scroll num ouvinte passivo e só muda de
 * estado ao cruzar o limiar, por isso não repinta a cada pixel.
 */
export function useScrolled(threshold = 12): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const read = () => setScrolled(window.scrollY > threshold);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, [threshold]);

  return scrolled;
}
