import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-[0.04em] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent gradient-primary text-primary-foreground shadow-[0_12px_30px_-18px_var(--scorelab-accent-b)] hover:-translate-y-0.5",
        secondary:
          "border-white/10 bg-white/[0.055] text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.055)] hover:bg-white/[0.08]",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "border-cyan-100/14 bg-cyan-100/[0.04] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.045)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
