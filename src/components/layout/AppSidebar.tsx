import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Target,
  Clock,
  Layers3,
  Wallet,
  Flag,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronDown,
  Radar,
  Gauge,
  Percent,
} from "lucide-react";
import { useState } from "react";

const navGroups = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "Bankroll Tools", url: "/bankroll", icon: Wallet },
      { title: "Roadmap", url: "/roadmap", icon: Flag },
    ],
  },
  {
    title: "Analysis",
    items: [
      { title: "Probability", url: "/probability", icon: Percent },
      { title: "Match Analysis", url: "/analysis", icon: Target },
      { title: "Value Radar", url: "/radar", icon: Radar },
      { title: "Acerto do Modelo", url: "/accuracy", icon: Gauge },
    ],
  },
  {
    title: "Tracking",
    items: [
      { title: "Simple Bet", url: "/history", icon: Clock },
      { title: "Multiples Bet", url: "/history-multiples", icon: Layers3 },
    ],
  },
  {
    title: "System",
    items: [
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true,
    Analysis: true,
    Tracking: true,
    System: false,
  });

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  return (
    <div className={cn("relative hidden shrink-0 transition-all duration-300 lg:block", collapsed ? "w-16" : "w-60")}>
      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}>
        <div className="flex h-16 items-center border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-primary">
              <BarChart3 className="h-4 w-4 text-white" strokeWidth={2.2} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="block text-lg font-black tracking-[-0.04em] text-foreground">ScoreLab</span>
                <span className="block -mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Analytics OS</span>
              </div>
            )}
          </Link>
        </div>

        <nav className="relative flex-1 overflow-y-auto p-3">
          <div className="space-y-4">
            {navGroups.map((group) => (
              <div key={group.title} className="space-y-1">
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors duration-200 hover:bg-muted"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                      {group.title}
                    </p>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                        openGroups[group.title] && "rotate-180"
                      )}
                      strokeWidth={1.7}
                    />
                  </button>
                )}
                {(collapsed || openGroups[group.title]) &&
                  group.items.map((item) => {
                  const isActive = location.pathname === item.url;
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold tracking-[-0.01em] transition-colors duration-200",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <item.icon
                        className="h-4 w-4 flex-shrink-0"
                        strokeWidth={2}
                      />
                      {!collapsed && <span>{item.title}</span>}
                      {isActive && !collapsed && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="relative border-t border-border p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-10 w-full items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", collapsed && "rotate-180")} strokeWidth={2} />
          </button>
        </div>
      </aside>
    </div>
  );
}
