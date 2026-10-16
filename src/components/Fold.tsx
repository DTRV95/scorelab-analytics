import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * O resto, dobrado.
 *
 * Uma página que mostra tudo o que sabe não está a ser generosa: está a
 * obrigar a ler tudo para encontrar uma coisa. Isto é a dobra — uma linha
 * discreta que diz o que está lá dentro e abre quando se pede.
 *
 * Não é um cartão: se fosse, os cartões lá de dentro ficavam dentro de
 * outro cartão, que é a maneira mais fácil de uma página parecer uma
 * gaveta dentro de uma gaveta. É só um controlo, e o que abre fica ao lado
 * do resto da página, como se sempre lá tivesse estado.
 */
export function Fold({
  label,
  hint,
  children,
  className = "",
}: {
  /** O que está lá dentro, dito em duas ou três palavras. */
  label: string;
  /** Uma pista do que se ganha em abrir. Opcional, e curta. */
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        aria-controls={id}
        className="sl-tap group flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[12.5px] font-bold text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <span>{open ? `Fechar ${label.toLowerCase()}` : label}</span>
        {hint && !open && (
          <span className="font-semibold text-muted-foreground/70">
            {hint}
          </span>
        )}
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: "spring", stiffness: 320, damping: 36 },
              opacity: { duration: 0.18 },
            }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
