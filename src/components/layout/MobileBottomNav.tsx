import { Link, useLocation } from "react-router-dom";
import { BarChart3, Gauge, Percent, Trophy, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

// Five destinations, the most a thumb row holds before the labels truncate.
// A phone has no sidebar, so what is here is all there is: the board to find a
// game, the challenges to bet it and follow it, how right the model has been,
// and the bankroll. Roadmap and Value Radar stay one level in, from the Dashboard.
const mobileItems = [
  { title: "Início", url: "/dashboard", icon: BarChart3 },
  { title: "Jogos", url: "/probability", icon: Percent },
  { title: "Desafios", url: "/desafios", icon: Trophy },
  { title: "Acerto", url: "/accuracy", icon: Gauge },
  { title: "Banca", url: "/bankroll", icon: Wallet },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="sl-bottomnav fixed inset-x-0 bottom-0 z-50 px-2 pb-[max(env(safe-area-inset-bottom),0.4rem)] pt-1.5 lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
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
