import { useEffect } from "react";
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

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-background text-foreground antialiased">
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        <div className="sticky top-0 z-30">
          <TopBar />
        </div>
        <main className="flex-1 px-3 pb-28 pt-4 sm:px-5 md:px-7 md:pb-12 md:pt-6 xl:px-8">
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
