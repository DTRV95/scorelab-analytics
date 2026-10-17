import type { Variants } from "framer-motion";

/**
 * O movimento da casa, num sítio só.
 *
 * Isto estava escrito treze vezes, uma em cada página, com treze valores
 * ligeiramente diferentes — 10px aqui, 12px ali, 0,35s numa, nada noutra.
 * O resultado é que a aplicação entrava de maneira diferente conforme a
 * página, que é o contrário de um sistema.
 *
 * O gesto é um só: a coisa sobe um pouco, ganha foco e assenta. A mola é o
 * que faz a diferença entre "apareceu" e "chegou" — uma curva de duração
 * fixa termina sempre no mesmo instante, uma mola termina quando o peso
 * dela manda, e é isso que o olho lê como físico. O desfoque de saída é
 * curto de propósito: dá profundidade à entrada sem pôr o texto a tremer.
 *
 * Quem pediu menos movimento ao sistema não leva nada disto: o
 * <MotionConfig reducedMotion="user"> na raiz da aplicação desliga as
 * transformações e deixa só a opacidade.
 */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14, filter: "blur(3px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 280, damping: 28, mass: 0.85 },
  },
};

/** O mesmo gesto, sem o desfoque: para listas longas e linhas pequenas. */
export const fadeUpPlain: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 30, mass: 0.7 },
  },
};

/**
 * Os filhos entram em fila, não todos ao mesmo tempo.
 *
 * 55ms é o intervalo em que se lê uma cascata; abaixo disso parece um salto
 * e acima disso parece uma página a carregar devagar.
 */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.055, delayChildren: 0.03 } },
};

/** A mola das coisas que respondem ao dedo. */
export const spring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.7,
};
