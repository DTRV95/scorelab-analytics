import { Link, useLocation } from "react-router-dom";
import { BarChart3, Globe, Percent, Ticket, Trophy } from "lucide-react";
import { usePlanBoard } from "@/hooks/usePlanBoard";
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
//
// Início is not in this list. It sits in the middle, raised and in the app's
// own orange, because it is the one page everything else leads back to — and
// the middle of the row is where a thumb lands without aiming.
const mobileItems = [
  { title: "Jogos", url: "/probability", icon: Percent },
  { title: "Desafios", url: "/desafios", icon: Trophy },
  { title: "Apostas", url: "/apostas", icon: Ticket },
  { title: "Ligas", url: "/ligas", icon: Globe },
];

const HOME = { title: "Início", url: "/dashboard", icon: BarChart3 };

export function MobileBottomNav() {
  const location = useLocation();
  // Somebody waiting for an answer, on the one bar a phone always has.
  const { invites } = usePlanBoard();
  const onHome =
    location.pathname === HOME.url || location.pathname === "/";

  const item = (entry: (typeof mobileItems)[number]) => {
    const isActive = location.pathname === entry.url;
    const asking = entry.url === "/desafios" ? invites.length : 0;

    return (
      <Link
        key={entry.url}
        to={entry.url}
        data-active={isActive}
        className={cn(
          "sl-bottomnav-item relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-[20px] px-1 py-1.5 text-[10px] font-semibold transition",
          isActive ? "" : "text-white/55 hover:text-white/85",
        )}
      >
        <entry.icon className="h-[18px] w-[18px]" strokeWidth={2} />
        {asking > 0 && (
          <span
            className="absolute right-1.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground"
            aria-label={`${asking} ${asking === 1 ? "convite" : "convites"}`}
          >
            {asking}
          </span>
        )}
        <span className="max-w-full truncate">{entry.title}</span>
      </Link>
    );
  };

  return (
    // A bar that floats clear of the bottom edge instead of being welded to
    // it. The strip around the pill lets go of taps, so the page underneath is
    // still reachable where the bar is not.
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-2 lg:hidden">
      <div className="sl-bottomnav-pill pointer-events-auto mx-auto grid max-w-sm grid-cols-5 items-end gap-0.5 rounded-[26px] p-1.5">
        {mobileItems.slice(0, 2).map(item)}

        {/* The middle of the row, lifted out of it.
            Orange whatever page is open, because it is the way back rather
            than one destination among five — so being there cannot be said in
            colour like the others say it. It is said in weight: the ring
            lights up and the label goes white. */}
        <Link
          to={HOME.url}
          aria-current={onHome ? "page" : undefined}
          className="flex min-w-0 flex-col items-center justify-end gap-0.5 pb-1.5"
        >
          <span
            className={cn(
              "-mt-6 flex h-[46px] w-[46px] items-center justify-center rounded-full ring-4 ring-[hsl(var(--sl-nav))] transition [background:var(--sl-gradient)]",
              onHome
                ? "shadow-[0_0_0_2px_hsl(var(--primary)/0.55),0_8px_18px_-6px_hsl(var(--primary)/0.8)]"
                : "shadow-[0_6px_14px_-6px_hsl(var(--primary)/0.65)]",
            )}
          >
            <HOME.icon className="h-[22px] w-[22px] text-white" strokeWidth={2.2} />
          </span>
          <span
            className={cn(
              "max-w-full truncate text-[10px] font-semibold transition",
              onHome ? "text-white" : "text-white/55",
            )}
          >
            {HOME.title}
          </span>
        </Link>

        {mobileItems.slice(2).map(item)}
      </div>
    </nav>
  );
}
