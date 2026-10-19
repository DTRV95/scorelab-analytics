import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { TopBar } from "./TopBar";
import { DraftSlipBar } from "@/components/DraftSlipBar";
import { useDraftSlip } from "@/hooks/useDraftSlip";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // O boletim flutua por cima da página, e uma coisa que flutua tapa o fim
  // dela. O ar por baixo é dado aqui e não em cada página, pela mesma razão
  // que o do rodapé já era.
  const comBoletim = useDraftSlip().legs.length > 0;

  // Scrolling a new page back to the top is the router's job now, and it
  // leaves the browser's own restoration alone when somebody goes back. This
  // copy did not, so going back landed at the top of the page it returned to.

  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-background text-foreground antialiased">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        <div className="sticky top-0 z-30">
          <TopBar />
        </div>
        {/* Two numbers, each said once. The air under the bar belongs here
            rather than to each page: some pages had four pixels of it and
            others thirty-two, because half of them carried a negative margin
            to fight a forced one that no longer exists. And the thumb row
            floats over the page with Início standing proud of it, so the
            last card needs the height of both to clear them. */}
        <main
          className={`flex-1 px-3 pt-8 sm:px-5 md:px-7 md:pt-9 xl:px-8 ${
            comBoletim ? "pb-[13rem] lg:pb-28" : "pb-32 md:pb-12"
          }`}
        >
          {/* Aqui esteve uma camada de !important que, em telemóvel,
              reescrevia o tamanho de todos os h1/h2/h3, o espaçamento de
              todos os space-y e o padding de metade das classes do
              Tailwind. Era herança do layout escuro e era a razão de as
              decisões tomadas em cada componente não se verem no telefone:
              o que a página pedia perdia sempre para ela. As páginas mandam
              outra vez em si próprias. */}
          <div className="mx-auto max-w-[1280px]">{children}</div>
        </main>
      </div>
      <DraftSlipBar />
      <MobileBottomNav />
    </div>
  );
}
