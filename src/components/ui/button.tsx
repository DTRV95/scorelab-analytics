import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "gradient-primary text-primary-foreground shadow-[0_12px_30px_-18px_rgba(52,211,153,0.78),inset_0_1px_0_rgba(255,255,255,0.24)] hover:shadow-[0_16px_38px_-18px_rgba(34,211,238,0.72)] active:scale-[0.98]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "ring-1 ring-cyan-100/14 bg-cyan-100/[0.035] hover:bg-cyan-100/[0.07] hover:ring-cyan-100/24 text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
        ghost: "hover:bg-cyan-100/[0.055] text-muted-foreground hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "gradient-primary text-primary-foreground font-semibold shadow-[0_18px_46px_-24px_rgba(52,211,153,0.82),0_0_36px_-22px_rgba(34,211,238,0.85)] hover:shadow-[0_22px_56px_-24px_rgba(34,211,238,0.88)] active:scale-[0.98]",
        "hero-outline": "ring-1 ring-cyan-100/22 bg-cyan-100/[0.055] text-foreground hover:bg-cyan-100/[0.10] backdrop-blur-sm",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-lg px-8 text-base",
        xl: "h-14 rounded-xl px-10 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
