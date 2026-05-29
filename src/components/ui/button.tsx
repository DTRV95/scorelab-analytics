import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold tracking-[-0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "gradient-primary text-primary-foreground shadow-[0_18px_42px_-22px_var(--scorelab-accent-b),inset_0_1px_0_rgba(255,255,255,0.28)] hover:-translate-y-0.5 hover:shadow-[0_22px_52px_-24px_var(--scorelab-accent-a)] active:translate-y-0 active:scale-[0.98]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_16px_38px_-24px_rgba(248,113,113,0.85)] hover:-translate-y-0.5 hover:bg-destructive/90",
        outline:
          "ring-1 ring-cyan-100/14 bg-cyan-100/[0.035] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] hover:-translate-y-0.5 hover:bg-cyan-100/[0.07] hover:ring-cyan-100/24",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-secondary/80",
        ghost: "text-muted-foreground hover:bg-cyan-100/[0.055] hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "gradient-primary text-primary-foreground font-bold shadow-[0_22px_58px_-26px_var(--scorelab-accent-b),0_0_42px_-24px_var(--scorelab-accent-a)] hover:-translate-y-0.5 hover:shadow-[0_28px_68px_-28px_var(--scorelab-accent-a)] active:translate-y-0 active:scale-[0.98]",
        "hero-outline": "ring-1 ring-cyan-100/22 bg-cyan-100/[0.055] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm hover:-translate-y-0.5 hover:bg-cyan-100/[0.10]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-xl px-3",
        lg: "h-12 rounded-2xl px-8 text-base",
        xl: "h-14 rounded-[1.35rem] px-10 text-base",
        icon: "h-10 w-10",
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
