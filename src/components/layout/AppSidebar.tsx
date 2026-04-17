import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Clock,
  Layers3,
  Wallet,
  CreditCard,
  Settings,
  BarChart3,
  ChevronLeft,
  Radar,
} from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Match Analysis", url: "/analysis", icon: Target },
  { title: "Value Radar", url: "/radar", icon: Radar },
  { title: "Simple Bet", url: "/history", icon: Clock },
  { title: "Multiples Bet", url: "/history-multiples", icon: Layers3 },
  { title: "Bankroll Tools", url: "/bankroll", icon: Wallet },
  { title: "Pricing", url: "/pricing", icon: CreditCard },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn("relative shrink-0 transition-all duration-300", collapsed ? "w-16" : "w-60")}>
      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col border-r transition-all duration-300 backdrop-blur-xl",
        "bg-[linear-gradient(180deg,rgba(9,25,42,0.96)_0%,rgba(7,20,36,0.98)_34%,rgba(5,16,30,0.99)_100%)] border-cyan-200/10 shadow-[0_0_0_1px_rgba(34,211,238,0.04),0_24px_80px_-24px_rgba(34,211,238,0.22)]",
        collapsed ? "w-16" : "w-60"
      )}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.08),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(34,197,94,0.08),transparent_18%)]" />
        <div className="flex items-center h-16 px-4 border-b border-cyan-200/10">
          <Link to="/" className="flex items-center gap-2 overflow-hidden">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-primary/25 bg-[linear-gradient(135deg,rgba(34,211,238,0.22),rgba(34,197,94,0.18))] shadow-[0_10px_30px_rgba(34,211,238,0.18)] flex-shrink-0">
              <div className="absolute inset-[1px] rounded-[11px] bg-[linear-gradient(180deg,rgba(7,17,31,0.92),rgba(12,27,40,0.82))]" />
              <BarChart3 className="relative w-4 h-4 text-cyan-100" strokeWidth={1.7} />
            </div>
            {!collapsed && (
              <span className="bg-[linear-gradient(90deg,#ffffff_0%,#9fe8ff_42%,#8ef0c2_100%)] bg-clip-text text-lg font-bold tracking-tight text-transparent">ScoreLab</span>
            )}
          </Link>
        </div>

        <nav className="relative flex-1 p-3 space-y-1">
          {!collapsed && (
            <div className="mb-3 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">
                Workspace
              </p>
            </div>
          )}
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "text-foreground"
                    : "text-sidebar-foreground hover:bg-white/[0.05] hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-2xl border border-cyan-200/10 bg-[linear-gradient(90deg,rgba(34,211,238,0.14),rgba(34,197,94,0.12))] shadow-[0_14px_36px_-22px_rgba(34,211,238,0.45)]"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <item.icon className={cn(
                  "w-4 h-4 flex-shrink-0 relative z-10 transition-colors duration-200",
                  isActive && "text-primary"
                )} strokeWidth={1.5} />
                {!collapsed && <span className="relative z-10">{item.title}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary relative z-10" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="relative border-t border-sidebar-border/80 p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-11 w-full items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", collapsed && "rotate-180")} strokeWidth={1.5} />
          </button>
        </div>
      </aside>
    </div>
  );
}
