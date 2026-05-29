import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { TopBar } from "./TopBar";
import { LiveIntelligenceDock } from "@/components/LiveIntelligenceDock";
import { PremiumAtmosphere } from "@/components/PremiumAtmosphere";
import {
  APPEARANCE_UPDATED_EVENT,
  applyScoreLabAppearance,
  getScoreLabAppearance,
} from "@/lib/appearanceSettings";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isAnalysisPage = location.pathname === "/analysis";
  const routeClassName =
    location.pathname === "/"
      ? "scorelab-route-dashboard"
      : `scorelab-route-${location.pathname.replace(/^\/+/, "").replace(/[^a-z0-9-]/gi, "-") || "home"}`;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  useEffect(() => {
    applyScoreLabAppearance(getScoreLabAppearance());

    const syncAppearance = () => {
      applyScoreLabAppearance(getScoreLabAppearance());
    };

    window.addEventListener(APPEARANCE_UPDATED_EVENT, syncAppearance);
    window.addEventListener("storage", syncAppearance);

    return () => {
      window.removeEventListener(APPEARANCE_UPDATED_EVENT, syncAppearance);
      window.removeEventListener("storage", syncAppearance);
    };
  }, []);

  return (
    <div className="scorelab-premium-shell scorelab-arena-atmosphere relative flex min-h-screen w-full overflow-x-hidden bg-background text-foreground antialiased">
      <div className="scorelab-aurora pointer-events-none fixed left-[14%] top-[-18%] -z-20 h-[520px] w-[760px] rounded-full opacity-45" />
      <div className="scorelab-aurora pointer-events-none fixed bottom-[-24%] right-[-10%] -z-20 h-[560px] w-[760px] rounded-full opacity-32 [animation-delay:-7s]" />
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_12%_10%,rgba(34,211,238,0.09),transparent_22%),radial-gradient(circle_at_86%_12%,rgba(52,211,153,0.08),transparent_22%),linear-gradient(180deg,rgba(3,9,18,1)_0%,rgba(5,17,31,1)_42%,rgba(2,10,22,1)_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,rgba(125,245,238,0.012),transparent_48%,rgba(52,211,153,0.010))] opacity-70" />
      <div className="scorelab-arena-pitch-glow pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[36vh]" />
      <PremiumAtmosphere />
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        <div className="sticky top-0 z-30">
          <TopBar />
          <LiveIntelligenceDock />
        </div>
        <main className="flex-1 px-3 pb-28 pt-4 sm:px-5 md:px-7 md:pb-12 md:pt-7 xl:px-9">
          <div className="mx-auto max-w-[1500px]">
            <div
              className={`animate-[page-rise_420ms_ease-out_both] ${
                isAnalysisPage
                  ? ""
                  : `scorelab-mobile-compact scorelab-mobile-overview ${routeClassName}`
              }`}
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
