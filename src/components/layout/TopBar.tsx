import { Bell, Download, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { downloadScoreLabExport } from "@/lib/exportData";
import { OPEN_COMMAND_CENTER_EVENT } from "@/components/ScoreLabCommandCenter";

export function TopBar() {
  const openCommandCenter = () => {
    window.dispatchEvent(new Event(OPEN_COMMAND_CENTER_EVENT));
  };

  return (
    <header className="scorelab-chrome-topbar border-b px-4 backdrop-blur-2xl sm:px-5 md:px-6">
      <div className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={openCommandCenter}
            className="relative text-left"
            title="Open Command Center"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
            <span className="scorelab-chrome-control flex h-10 w-44 items-center justify-between rounded-2xl border pl-9 pr-3 text-sm text-muted-foreground transition-all sm:w-56 md:w-72">
              <span className="truncate">Search or command...</span>
              <span className="hidden rounded-md border border-[var(--scorelab-control-border)] bg-black/10 px-1.5 py-0.5 font-mono-data text-[10px] text-cyan-50/45 sm:inline-flex">
                Ctrl K
              </span>
            </span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={downloadScoreLabExport}
            title="Download ScoreLab export"
            className="scorelab-chrome-control relative rounded-2xl border"
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
        </div>
      </div>
    </header>
  );
}
