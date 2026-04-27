import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Target,
  Clock,
  Layers3,
  Wallet,
  Flag,
  CreditCard,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronDown,
  Radar,
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
      { title: "Pricing", url: "/pricing", icon: CreditCard },
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
    <div className={cn("relative shrink-0 transition-all duration-300", collapsed ? "w-16" : "w-60")}>
      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r transition-all duration-300 backdrop-blur-2xl",
        "bg-[linear-gradient(180deg,rgba(8,31,50,0.96)_0%,rgba(5,23,42,0.985)_42%,rgba(2,13,27,0.99)_100%)] border-cyan-100/15 shadow-[0_0_0_1px_rgba(125,245,238,0.08),0_28px_90px_-26px_rgba(34,211,238,0.34),0_0_80px_-44px_rgba(52,211,153,0.42)]",
        collapsed ? "w-16" : "w-60"
      )}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(52,211,153,0.12),transparent_20%),linear-gradient(90deg,rgba(255,255,255,0.035),transparent_34%)]" />
        <div className="flex items-center h-16 px-4 border-b border-cyan-100/15">
          <Link to="/" className="flex items-center gap-2 overflow-hidden">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-cyan-200/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(52,211,153,0.26))] shadow-[0_12px_34px_rgba(34,211,238,0.28),0_0_28px_-12px_rgba(52,211,153,0.55)] flex-shrink-0">
              <div className="absolute inset-[1px] rounded-[11px] bg-[linear-gradient(180deg,rgba(7,24,40,0.94),rgba(7,35,43,0.84))]" />
              <BarChart3 className="relative w-4 h-4 text-cyan-100 drop-shadow-[0_0_8px_rgba(125,245,238,0.55)]" strokeWidth={1.7} />
            </div>
            {!collapsed && (
              <span className="bg-[linear-gradient(90deg,#ffffff_0%,#9eeeff_38%,#80f7c5_100%)] bg-clip-text text-lg font-bold tracking-tight text-transparent drop-shadow-[0_0_18px_rgba(34,211,238,0.18)]">ScoreLab</span>
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
                    className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition-colors hover:bg-cyan-200/[0.045]"
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
                        "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                        isActive
                          ? "text-foreground"
                          : "text-sidebar-foreground hover:bg-cyan-200/[0.055] hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute inset-0 rounded-2xl border border-cyan-100/18 bg-[linear-gradient(90deg,rgba(34,211,238,0.20),rgba(52,211,153,0.16))] shadow-[0_16px_42px_-22px_rgba(34,211,238,0.62),inset_0_1px_0_rgba(255,255,255,0.08)]"
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
                        <div className="relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        <div className="relative border-t border-cyan-100/12 p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-cyan-100/12 bg-cyan-100/[0.04] text-muted-foreground transition-colors hover:border-cyan-100/20 hover:bg-cyan-100/[0.07] hover:text-foreground"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", collapsed && "rotate-180")} strokeWidth={1.5} />
          </button>
        </div>
      </aside>
    </div>
  );
}
