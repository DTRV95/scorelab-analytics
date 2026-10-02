import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  Settings,
  BarChart3,
  ChevronLeft,
  ChevronDown,
  Gauge,
  Globe,
  Trophy,
  Ticket,
  Percent,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import { planNews } from "@/lib/planNews";
import { seenByPlan } from "@/lib/seenStore";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** The challenges entry, which carries what happened in all of them. */
  challenges?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// In Portuguese, like the pages they open. "Dashboard" opened a page whose
// own title said "Início", and "Overview" sat above it in a second language.
const navGroups: NavGroup[] = [
  {
    title: "Geral",
    items: [
      { title: "Início", url: "/dashboard", icon: LayoutDashboard },
      // One way in, and everything about the challenges behind it. The menu
      // used to unfold them — each challenge, the full list, the comparison —
      // which put four entries in a sidebar for what is one page.
      { title: "Desafios", url: "/desafios", icon: Trophy, challenges: true },
      { title: "Apostas", url: "/apostas", icon: Ticket },
      { title: "Banca", url: "/bankroll", icon: Wallet },
      { title: "Análises", url: "/dashboard/analises", icon: BarChart3 },
    ],
  },
  {
    title: "Jogos",
    items: [
      { title: "Quadro de jogos", url: "/probability", icon: Percent },
      { title: "Ligas", url: "/ligas", icon: Globe },
      { title: "Acerto do modelo", url: "/accuracy", icon: Gauge },
    ],
  },
  {
    title: "Conta",
    items: [
      { title: "Definições", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  // Read from the app's own copy of the challenges rather than fetched again
  // here: the sidebar is on every page, and so was its own extra query.
  const { members, allBets, funds } = usePlanBoard();

  // Everything the other players did, across every challenge, since this
  // person last looked at each of them.
  const waiting = useMemo(() => {
    const since = seenByPlan(user?.id ?? "");
    return planNews({
      userId: user?.id ?? "",
      members,
      bets: allBets,
      funds,
      since,
    }).length;
  }, [user?.id, members, allBets, funds]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Geral: true,
    Jogos: true,
    Conta: false,
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
                  // Every challenge page sits behind this one entry, so the
                  // entry has to stay lit on all of them.
                  const isActive =
                    location.pathname === item.url ||
                    (item.challenges && location.pathname.startsWith("/desafios"));
                  const unseen = item.challenges ? waiting : 0;
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
                      {!collapsed && <span className="truncate">{item.title}</span>}
                      {/* A dot means something happened, here as everywhere
                          else in the app. It used to mean "you are here", on
                          a row already saying that in colour and background —
                          which read as a notification that was never one. */}
                      {unseen > 0 && !collapsed && (
                        <span
                          className="ml-auto flex-none rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                          aria-label={`${unseen} ${unseen === 1 ? "novidade" : "novidades"}`}
                        >
                          {unseen}
                        </span>
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
