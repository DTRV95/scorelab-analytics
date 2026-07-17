import { Bell, Download, LogOut, Search, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { downloadScoreLabExport } from "@/lib/exportData";
import { OPEN_COMMAND_CENTER_EVENT } from "@/components/ScoreLabCommandCenter";
import { useAuth } from "@/contexts/AuthContext";

export function TopBar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const openCommandCenter = () => {
    window.dispatchEvent(new Event(OPEN_COMMAND_CENTER_EVENT));
  };

  const handleSignOut = async () => {
    // Leave the protected area first so ProtectedRoute never sees the
    // signed-out state and bounces the user to /login.
    navigate("/");
    await signOut();
  };

  return (
    <header className="scorelab-chrome-topbar border-b px-3 backdrop-blur-2xl sm:px-5 md:px-6">
      <div className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/dashboard" className="scorelab-brand-mark flex h-10 w-10 flex-none items-center justify-center rounded-2xl border border-[var(--scorelab-control-border-hover)] lg:hidden">
            <span className="scorelab-brand-text text-sm font-black">SL</span>
          </Link>
          <button
            type="button"
            onClick={openCommandCenter}
            className="relative min-w-0 text-left"
            title="Open Command Center"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <span className="scorelab-chrome-control flex h-10 w-[min(56vw,13rem)] items-center justify-between rounded-2xl border pl-9 pr-3 text-sm text-muted-foreground transition-all hover:-translate-y-0.5 sm:w-56 md:w-80">
              <span className="truncate">Search...</span>
              <span className="hidden rounded-md border border-[var(--scorelab-control-border)] bg-black/10 px-1.5 py-0.5 font-mono-data text-[10px] text-cyan-50/45 sm:inline-flex">
                Ctrl K
              </span>
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/analysis" className="hidden md:block">
            <Button variant="hero" size="sm" className="h-10 rounded-2xl px-4">
              <Sparkles className="h-4 w-4" strokeWidth={1.5} />
              Analyze
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={downloadScoreLabExport}
            title="Download ScoreLab export"
            className="scorelab-chrome-control relative hidden rounded-2xl border sm:inline-flex"
          >
            <Download className="h-4 w-4" strokeWidth={1.5} />
          </Button>
          <Button variant="ghost" size="icon" className="scorelab-chrome-control relative rounded-2xl border">
            <Bell className="h-4 w-4" strokeWidth={1.5} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_14px_var(--scorelab-accent-b-soft)]" />
          </Button>
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="scorelab-brand-mark rounded-2xl border border-[var(--scorelab-control-border-hover)]">
              <User className="h-4 w-4" strokeWidth={1.5} />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            title="Log out"
            className="scorelab-chrome-control rounded-2xl border"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
    </header>
  );
}
