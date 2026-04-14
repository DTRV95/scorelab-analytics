import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_10%_12%,rgba(34,211,238,0.14),transparent_18%),radial-gradient(circle_at_84%_10%,rgba(34,197,94,0.12),transparent_16%),radial-gradient(circle_at_52%_48%,rgba(56,189,248,0.08),transparent_22%),radial-gradient(circle_at_68%_82%,rgba(16,185,129,0.08),transparent_20%),linear-gradient(180deg,rgba(4,10,18,1)_0%,rgba(6,15,28,1)_36%,rgba(4,11,22,1)_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:88px_88px] opacity-25" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(153,246,228,0.05),transparent_28%)]" />
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-5 pb-8 pt-6 md:px-6 md:pb-10">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
