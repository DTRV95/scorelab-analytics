import { Link, useLocation } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  Clock,
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
  { title: "Daily Opportunities", url: "/opportunities", icon: TrendingUp },
  { title: "History", url: "/history", icon: Clock },
  { title: "Bankroll Tools", url: "/bankroll", icon: Wallet },
  { title: "Pricing", url: "/pricing", icon: CreditCard },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 sticky top-0",
      collapsed ? "w-16" : "w-60"
    )}>
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <Link to="/" className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
            <BarChart3 className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
          </div>
          {!collapsed && (
            <span className="font-bold text-foreground text-lg tracking-tight">ScoreLab</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          return (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative group",
                isActive
                  ? "bg-sidebar-accent text-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-sidebar-accent"
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

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-sidebar-border text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className={cn("w-4 h-4 transition-transform duration-300", collapsed && "rotate-180")} strokeWidth={1.5} />
      </button>
    </aside>
  );
}
