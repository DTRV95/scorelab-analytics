import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-sm font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow,filter,transform] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none active:scale-[0.976] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // A camisola da casa: o único gradiente da aplicação, no botão que
        // compromete. O brilho por baixo é laranja, não o ciano que aqui
        // ficou do mundo escuro anterior.
        default: "sl-btn-primary",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_hsla(0,0%,100%,0.22),0_6px_16px_-6px_hsl(var(--destructive)/0.5)] hover:brightness-[1.06]",
        // Sobre papel claro, o contorno é uma linha a sério e o fundo é
        // branco — o antigo véu de ciano a 3,5% não se via.
        outline:
          "border border-border bg-card text-foreground hover:border-muted-foreground/40 hover:bg-muted/50",
        secondary:
          "bg-[hsl(var(--sl-surface))] text-foreground shadow-[inset_0_0_0_1px_hsla(222,47%,11%,0.06)] hover:bg-muted",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "sl-btn-primary font-bold shadow-[inset_0_1px_0_hsla(0,0%,100%,0.3),0_10px_26px_-8px_hsla(14,100%,50%,0.6)]",
        "hero-outline":
          "border border-border bg-card/80 text-foreground backdrop-blur-sm hover:border-muted-foreground/40 hover:bg-card",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-[12px] px-3",
        lg: "h-12 px-8 text-base",
        xl: "h-14 rounded-[18px] px-10 text-base",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
