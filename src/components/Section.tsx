import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Uma secção da aplicação, com a cor do que é.
 *
 * As páginas eram uma pilha de rectângulos brancos iguais, e isso é o mesmo
 * que não ter secções: os jogos para escolher, a aposta à espera de ti e o
 * que já ficou fechado liam-se todos da mesma maneira. Cada tipo de coisa
 * passa a ter um painel da sua cor, com o mesmo cabeçalho em todo o lado —
 * marca de cor, nome, contagem, e o atalho à direita se houver.
 *
 * A cor é fraca e está por baixo de tudo: o que se destaca continuam a ser
 * os cartões brancos lá dentro, não o fundo.
 */
export type SectionTone = "cool" | "primary" | "amber" | "green" | "plain";

const MARK: Record<SectionTone, string> = {
  cool: "bg-[hsl(var(--sl-cool))]/12 text-[hsl(var(--sl-cool))]",
  primary: "bg-primary/15 text-primary",
  amber: "bg-[hsl(var(--warning))]/20 text-amber-700",
  green: "bg-[hsl(var(--sl-green))]/15 text-[hsl(var(--sl-green))]",
  plain: "bg-muted text-muted-foreground",
};

const COUNT: Record<SectionTone, string> = {
  cool: "sl-pill-muted",
  primary: "sl-pill-muted",
  amber: "sl-pill-open",
  green: "sl-pill-win",
  plain: "sl-pill-muted",
};

/**
 * Só o cabeçalho, para onde já existe um cartão à volta.
 *
 * Os títulos de secção eram um <h2> escrito à mão de cada vez, cada um com
 * o seu tamanho, o seu ícone e o seu espaçamento. Isto é o mesmo em todo o
 * lado: marca de cor, sobrenome, nome, contagem, atalho.
 */
export function SectionHeader({
  tone = "plain",
  icon: Icon,
  eyebrow,
  title,
  count,
  note,
  action,
  className = "",
}: {
  tone?: SectionTone;
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  count?: number;
  note?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      {Icon && (
        <span
          className={`flex h-7 w-7 flex-none items-center justify-center rounded-xl ${MARK[tone]}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {eyebrow && <p className="sl-sec-eyebrow">{eyebrow}</p>}
        <h2 className="sl-sec-title">
          {title}
          {count !== undefined && (
            <span className={`sl-pill ${COUNT[tone]} text-[11px]`}>{count}</span>
          )}
        </h2>
        {note && <p className="sl-meta mt-0.5 text-[11px] leading-5">{note}</p>}
      </div>

      {action && <div className="flex-none pt-0.5">{action}</div>}
    </div>
  );
}

export function Section({
  tone = "plain",
  icon: Icon,
  eyebrow,
  title,
  count,
  note,
  action,
  children,
  className = "",
}: {
  tone?: SectionTone;
  icon?: LucideIcon;
  /** Duas palavras por cima do nome: o que esta secção é para fazer. */
  eyebrow?: string;
  title: string;
  /** Quantos, quando o número é parte da pergunta. */
  count?: number;
  /** Uma linha por baixo do título. Uma, não um parágrafo. */
  note?: string;
  /** O atalho à direita do título. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-tone={tone} className={`sl-sec ${className}`}>
      <SectionHeader
        tone={tone}
        icon={Icon}
        eyebrow={eyebrow}
        title={title}
        count={count}
        note={note}
        action={action}
        className="px-2 pb-2.5 pt-1.5"
      />

      {children}
    </section>
  );
}
