import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isAnalysisPage = location.pathname === "/analysis";

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
        <main className="flex-1 px-3 pb-32 pt-8 sm:px-5 md:px-7 md:pb-12 md:pt-9 xl:px-8">
          <div className="mx-auto max-w-[1280px]">
            {/* The per-route class that used to go here only fed a rule that
                hid whole sections on phones. Nothing styles a route by name
                now, so the page is just compacted, not cut short. */}
            <div
              className={
                isAnalysisPage
                  ? ""
                  : "scorelab-mobile-compact scorelab-mobile-overview"
              }
            >
              {children}
            </div>
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
