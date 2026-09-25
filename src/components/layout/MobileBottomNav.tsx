import { Link, useLocation } from "react-router-dom";
import { BarChart3, Clock, Layers3, Percent, Trophy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// Six destinations. Five is the comfortable maximum before labels truncate,
// but a phone has no sidebar, and both the plan and the multiples are
// otherwise unreachable from one: the plan is the screen these two open every
// day, and a multiple placed from the betslip would have nowhere to be read.
// Roadmap, Value Radar and the model's track record stay one level in, reached
// from the Dashboard.
const mobileItems = [
  { title: "Início", url: "/dashboard", icon: BarChart3 },
  { title: "Jogos", url: "/probability", icon: Percent },
  { title: "Plano", url: "/plano", icon: Trophy },
  { title: "Múltiplas", url: "/history-multiples", icon: Layers3 },
  { title: "Apostas", url: "/history", icon: Clock },
  { title: "Banca", url: "/bankroll", icon: Wallet },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="sl-bottomnav fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6 gap-1">
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
