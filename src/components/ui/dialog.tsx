import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Tinta a 80% tapava a aplicação por completo e cada abertura era um
      // corte a negro. A 55%, com um desfoque leve, a página continua lá
      // atrás — o que se abriu está por cima dela, não no lugar dela.
      "fixed inset-0 z-50 bg-[hsl(222_47%_11%/0.55)] backdrop-blur-[3px] duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/**
 * The dialog is a grid, and a grid's implicit column is sized `auto` — whose
 * maximum is max-content. Anything wide inside it (a row of league chips, a
 * long table) stretches that column past the dialog's own max-width and drags
 * every sibling out with it: a 340px dialog was laying its contents out at
 * 1113px, so half of every market button sat outside the box. Naming the
 * column minmax(0, 1fr) is what keeps `max-w-lg` meaning anything at all.
 *
 * overscroll-contain keeps a flick that reaches the end of a dialog's own
 * scrolling from carrying on into the page behind it.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "sl-raised fixed z-50 grid max-w-lg grid-cols-[minmax(0,1fr)] gap-4 overflow-y-auto overscroll-contain p-5 duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:p-6",
        // Telemóvel: uma folha que sobe do fundo, encostada à borda de
        // baixo, onde o polegar chega. Um painel ao centro do ecrã obriga
        // a mão a subir e deixa o teclado a empurrá-lo; isto fica onde a
        // mão já está e abre com o gesto que o telefone inteiro usa.
        "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[88dvh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:rounded-t-[26px] max-sm:pb-[max(env(safe-area-inset-bottom),1rem)] max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom",
        // Ecrã grande: continua ao centro, que é onde um painel pertence
        // quando não há uma borda à mão.
        "sm:left-[50%] sm:top-[50%] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-1.5rem)] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {/* A pega. Não faz nada que o toque fora não faça, e é por isso que
          está lá: diz, antes de se tentar, que isto é uma folha e que se
          fecha para baixo. */}
      <div
        aria-hidden
        className="pointer-events-none mx-auto mt-2.5 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden"
      />
      {children}
      <DialogPrimitive.Close className="sl-tap absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 disabled:pointer-events-none">
        <X className="h-[18px] w-[18px]" />
        <span className="sr-only">Fechar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
