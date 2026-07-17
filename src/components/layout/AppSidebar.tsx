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
  BrainCircuit,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

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
      { title: "Match Analysis", url: "/analysis", icon: Target },
      { title: "Value Radar", url: "/radar", icon: Radar },
      { title: "Model Lab", url: "/model-lab", icon: BrainCircuit },
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
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r transition-all duration-300 backdrop-blur-2xl",
        "scorelab-chrome-sidebar",
        collapsed ? "w-16" : "w-60"
      )}>
        <div className="scorelab-chrome-overlay pointer-events-none absolute inset-0" />
        <div className="flex h-16 items-center border-b border-[var(--scorelab-chrome-border)] px-4">
          <Link to="/" className="flex items-center gap-2 overflow-hidden">
            <div className="scorelab-brand-mark relative flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-white/20 flex-shrink-0">
              <div className="absolute inset-[1px] rounded-[11px] bg-[linear-gradient(180deg,rgba(7,24,40,0.94),rgba(7,35,43,0.84))]" />
              <BarChart3 className="relative w-4 h-4 text-cyan-100 drop-shadow-[0_0_8px_rgba(125,245,238,0.55)]" strokeWidth={1.7} />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <span className="scorelab-brand-text block text-lg font-black tracking-[-0.04em] drop-shadow-[0_0_18px_var(--scorelab-accent-a-soft)]">ScoreLab</span>
                <span className="block -mt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/32">Analytics OS</span>
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
                  className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-all duration-200 hover:bg-[var(--scorelab-control-bg)] hover:text-white"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-50/34">
                      {group.title}
                    </p>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 text-white/30 transition-transform duration-200",
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
                        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold tracking-[-0.01em] transition-all duration-200",
                        isActive
                          ? "text-foreground"
                          : "text-sidebar-foreground hover:-translate-y-0.5 hover:bg-[var(--scorelab-control-bg)] hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="scorelab-active-nav absolute inset-0 rounded-2xl border"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      <item.icon
                        className={cn(
                          "relative z-10 h-4 w-4 flex-shrink-0 transition-colors duration-200",
                          isActive && "text-primary"
                        )}
                        strokeWidth={1.5}
                      />
                      {!collapsed && <span className="relative z-10">{item.title}</span>}
                      {isActive && !collapsed && (
                        <div className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_14px_var(--scorelab-accent-b)]" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="relative border-t border-[var(--scorelab-chrome-border)] p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="scorelab-chrome-control flex h-11 w-full items-center justify-center rounded-2xl border text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", collapsed && "rotate-180")} strokeWidth={1.5} />
          </button>
        </div>
      </aside>
    </div>
  );
}
