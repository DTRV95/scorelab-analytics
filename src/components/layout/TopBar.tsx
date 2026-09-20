import { Download, LogOut, Search, Sparkles, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { downloadScoreLabExport } from "@/lib/exportData";
import { OPEN_COMMAND_CENTER_EVENT } from "@/components/ScoreLabCommandCenter";
import { useAuth } from "@/contexts/AuthContext";
import { useScoreLabData } from "@/hooks/useScoreLabData";

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});

export function TopBar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { financialSnapshot } = useScoreLabData();

  const openCommandCenter = () => {
    window.dispatchEvent(new Event(OPEN_COMMAND_CENTER_EVENT));
  };

  const handleSignOut = async () => {
    // Leave the protected area first so ProtectedRoute never sees the
    // signed-out state and bounces the user to /login.
    navigate("/");
    await signOut();
  };

  const iconButton =
    "inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg text-white/90 transition hover:bg-white/15 hover:text-white";

  return (
    <header className="sl-topbar px-3 sm:px-5 md:px-6">
      <div className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/dashboard"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-white/15 text-sm font-black text-white lg:hidden"
          >
            SL
          </Link>

          <button
            type="button"
            onClick={openCommandCenter}
            title="Pesquisar (Ctrl K)"
            className={`${iconButton} sm:hidden`}
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={openCommandCenter}
            className="hidden h-9 min-w-0 items-center gap-2 rounded-lg bg-white/15 px-3 text-sm text-white/90 transition hover:bg-white/20 sm:flex sm:w-56 md:w-72"
            title="Pesquisar (Ctrl K)"
          >
            <Search className="h-4 w-4 flex-none" strokeWidth={2} />
            <span className="truncate">Pesquisar equipa, liga, mercado...</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/bankroll"
            title="Banca"
            className="flex h-9 flex-none items-center gap-1.5 rounded-full bg-black/20 pl-1 pr-2.5 text-white transition hover:bg-black/30 sm:pr-3"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <User className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="font-mono-data text-[13px] font-semibold">
              {eur.format(financialSnapshot.stats.currentBankroll)}
            </span>
          </Link>

          <Link
            to="/probability"
            className="sl-btn-cta inline-flex h-9 flex-none items-center gap-1.5 px-3 text-[13px] sm:px-4"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:inline">Analisar</span>
          </Link>

          <button
            type="button"
            onClick={downloadScoreLabExport}
            title="Exportar dados"
            className={`${iconButton} hidden md:inline-flex`}
          >
            <Download className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>

          <Link to="/settings" title="Definições" className={iconButton}>
            <User className="h-[18px] w-[18px]" strokeWidth={2} />
          </Link>

          <button
            type="button"
            onClick={handleSignOut}
            title="Terminar sessão"
            className={iconButton}
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}
