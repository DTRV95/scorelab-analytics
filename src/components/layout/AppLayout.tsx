import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-background">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[radial-gradient(circle_at_14%_16%,rgba(34,211,238,0.10),transparent_18%),radial-gradient(circle_at_82%_12%,rgba(34,197,94,0.09),transparent_16%),radial-gradient(circle_at_50%_70%,rgba(34,211,238,0.05),transparent_24%),linear-gradient(180deg,rgba(6,11,20,1)_0%,rgba(7,17,31,1)_34%,rgba(5,12,21,1)_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:88px_88px] opacity-30" />
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
