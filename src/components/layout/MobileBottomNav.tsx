import { Link, useLocation } from "react-router-dom";
import { BarChart3, Globe, Percent, Ticket, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

// Five destinations, the most a thumb row holds before the labels truncate.
// A phone has no sidebar, so what is here is all there is: the board to find a
// game, the challenges to bet it and follow it, the loose bets, and what each
// competition actually gives.
//
// The bankroll gave up its place to the leagues: the banca somada is already
// in the top bar of every page, and tapping it opens the bankroll — so it
// costs one tap from anywhere, while the leagues could not be reached from a
// phone at all.
const mobileItems = [
  { title: "Início", url: "/dashboard", icon: BarChart3 },
  { title: "Jogos", url: "/probability", icon: Percent },
  { title: "Desafios", url: "/desafios", icon: Trophy },
  { title: "Apostas", url: "/apostas", icon: Ticket },
  { title: "Ligas", url: "/ligas", icon: Globe },
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
