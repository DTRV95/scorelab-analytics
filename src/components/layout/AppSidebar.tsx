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
  Trophy,
  Percent,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanBoard } from "@/hooks/usePlanBoard";
import { newsByPlan, planNews } from "@/lib/planNews";
import { seenByPlan } from "@/lib/seenStore";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Set on a challenge, so its row can carry what happened there. */
  planId?: string;
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
      { title: "Banca", url: "/bankroll", icon: Wallet },
      { title: "Análises", url: "/dashboard/analises", icon: BarChart3 },
    ],
  },
  {
    title: "Jogos",
    items: [
      { title: "Quadro de jogos", url: "/probability", icon: Percent },
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
  const { plans, members, allBets, funds } = usePlanBoard();

  const news = useMemo(() => {
    const since = seenByPlan(user?.id ?? "");
    return newsByPlan(
      planNews({ userId: user?.id ?? "", members, bets: allBets, funds, since }),
    );
  }, [user?.id, members, allBets, funds]);

  // The challenges, and then the two things somebody does around them. The
  // group used to open with "Todos os desafios", which under a heading that
  // already says Desafios is a tautology — after the list it is the whole set
  // beside mine, which is a different thing. And it used to close with
  // "Análise de apostador": not a challenge, sitting in a list of challenge
  // names, answering to almost the same words as the "Análises" above it.
  const challengeGroup: NavGroup = {
    title: "Desafios",
    items: [
      ...plans.map((plan) => ({
        title: plan.name,
        url: `/desafios/${plan.id}`,
        icon: Trophy,
        planId: plan.id,
      })),
      { title: "Todos os desafios", url: "/desafios", icon: ListChecks },
      { title: "Comparar jogadores", url: "/desafios/analise", icon: BarChart3 },
    ],
  };

  // The challenges are what this is used for every day, so they come before
  // the board and the model's record, which are the tools around them.
  const groups = [
    navGroups[0],
    challengeGroup,
    ...navGroups.slice(1),
  ];
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Geral: true,
    Jogos: true,
    Desafios: true,
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
            {groups.map((group) => (
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
                  const waiting = item.planId ? (news[item.planId] ?? 0) : 0;
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
                      {waiting > 0 && !collapsed && (
                        <span
                          className="ml-auto flex-none rounded-full bg-primary/12 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                          aria-label={`${waiting} ${waiting === 1 ? "novidade" : "novidades"}`}
                        >
                          {waiting}
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
