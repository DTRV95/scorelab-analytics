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

/**
 * A marca de cor da secção.
 *
 * Era um quadrado chapado com o ícone lá dentro. Passa a ter a mesma luz
 * que o painel à volta dele — claro em cima, a cor em baixo, um aro da
 * própria cor — para a marca pertencer à superfície em vez de estar
 * colada a ela.
 */
const MARK: Record<SectionTone, string> = {
  cool: "bg-gradient-to-b from-[hsl(var(--sl-cool))]/24 to-[hsl(var(--sl-cool))]/10 text-[hsl(var(--sl-cool))] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.7),inset_0_0_0_1px_hsl(var(--sl-cool)/0.22)]",
  primary:
    "bg-gradient-to-b from-primary/26 to-primary/10 text-primary shadow-[inset_0_1px_0_hsla(0,0%,100%,0.7),inset_0_0_0_1px_hsl(var(--primary)/0.24)]",
  amber:
    "bg-gradient-to-b from-[hsl(var(--warning))]/32 to-[hsl(var(--warning))]/12 text-amber-700 shadow-[inset_0_1px_0_hsla(0,0%,100%,0.75),inset_0_0_0_1px_hsl(var(--warning)/0.3)]",
  green:
    "bg-gradient-to-b from-[hsl(var(--sl-green))]/24 to-[hsl(var(--sl-green))]/10 text-[hsl(var(--sl-green))] shadow-[inset_0_1px_0_hsla(0,0%,100%,0.7),inset_0_0_0_1px_hsl(var(--sl-green)/0.22)]",
  plain:
    "bg-gradient-to-b from-muted to-muted/60 text-muted-foreground shadow-[inset_0_1px_0_hsla(0,0%,100%,0.8),inset_0_0_0_1px_hsla(222,47%,11%,0.06)]",
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
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-[11px] ${MARK[tone]}`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.25} />
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
