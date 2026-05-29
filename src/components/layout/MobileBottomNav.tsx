import { Link, useLocation } from "react-router-dom";
import { BarChart3, BrainCircuit, Flag, Radar, Target, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const mobileItems = [
  { title: "Dash", url: "/dashboard", icon: BarChart3 },
  { title: "Analyze", url: "/analysis", icon: Target },
  { title: "Radar", url: "/radar", icon: Radar },
  { title: "Bankroll", url: "/bankroll", icon: Wallet },
  { title: "Roadmap", url: "/roadmap", icon: Flag },
  { title: "Lab", url: "/model-lab", icon: BrainCircuit },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--scorelab-chrome-border)] bg-[linear-gradient(180deg,rgba(4,18,33,0.84),rgba(2,10,22,0.96))] px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6 gap-1">
        {mobileItems.map((item) => {
          const isActive =
            location.pathname === item.url ||
            (item.url === "/dashboard" && location.pathname === "/");

          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[10px] font-semibold transition",
                isActive
                  ? "scorelab-active-nav text-white"
                  : "text-cyan-50/48 hover:bg-white/[0.04] hover:text-white/82"
              )}
            >
              <item.icon
                className={cn("h-4 w-4", isActive ? "text-primary" : "text-current")}
                strokeWidth={1.6}
              />
              <span className="max-w-full truncate">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
