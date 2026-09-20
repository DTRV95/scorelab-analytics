import { Link, useLocation } from "react-router-dom";
import { BarChart3, BrainCircuit, Clock, Percent, Radar, Target, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isOwnerEmail } from "@/lib/ownerAccess";

// Five destinations, the most a thumb row can hold before the labels start
// truncating. Roadmap and Value Radar live one level in (Dashboard links to
// them) rather than competing for a slot here.
const baseMobileItems = [
  { title: "Início", url: "/dashboard", icon: BarChart3 },
  { title: "Jogos", url: "/probability", icon: Percent },
  { title: "Analisar", url: "/analysis", icon: Target },
  { title: "Apostas", url: "/history", icon: Clock },
  { title: "Banca", url: "/bankroll", icon: Wallet },
];

const modelLabItem = { title: "Lab", url: "/model-lab", icon: BrainCircuit };

const GRID_COLS_CLASS: Record<number, string> = {
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const mobileItems = isOwnerEmail(user?.email)
    ? [...baseMobileItems, modelLabItem]
    : baseMobileItems;

  return (
    <nav className="sl-bottomnav fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 lg:hidden">
      <div className={cn("mx-auto grid max-w-lg gap-1", GRID_COLS_CLASS[mobileItems.length])}>
        {mobileItems.map((item) => {
          const isActive =
            location.pathname === item.url ||
            (item.url === "/dashboard" && location.pathname === "/");

          return (
            <Link
              key={item.url}
              to={item.url}
              data-active={isActive}
              className={cn(
                "sl-bottomnav-item flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition",
                isActive ? "" : "text-white/55 hover:text-white/85"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
              <span className="max-w-full truncate">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
