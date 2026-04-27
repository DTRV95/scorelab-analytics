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
    <header className="border-b border-cyan-100/15 bg-[linear-gradient(180deg,rgba(10,34,54,0.78)_0%,rgba(5,20,38,0.90)_100%)] px-5 backdrop-blur-2xl shadow-[0_18px_56px_-30px_rgba(34,211,238,0.42),inset_0_1px_0_rgba(255,255,255,0.05)] md:px-6">
      <div className="flex h-16 items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={openCommandCenter}
          className="relative text-left"
          title="Open Command Center"
        >
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <span className="flex h-10 w-56 items-center justify-between rounded-2xl border border-cyan-100/12 bg-cyan-100/[0.045] pl-9 pr-3 text-sm text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:border-cyan-200/25 hover:bg-cyan-100/[0.065] md:w-72">
            <span>Search or command...</span>
            <span className="rounded-md border border-cyan-100/12 bg-black/10 px-1.5 py-0.5 font-mono-data text-[10px] text-cyan-50/45">
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
          className="relative rounded-2xl border border-cyan-100/12 bg-cyan-100/[0.04] hover:border-cyan-100/22 hover:bg-cyan-100/[0.07]"
        >
          <Download className="w-4 h-4" strokeWidth={1.5} />
        </Button>
        <Button variant="ghost" size="icon" className="relative rounded-2xl border border-cyan-100/12 bg-cyan-100/[0.04] hover:border-cyan-100/22 hover:bg-cyan-100/[0.07]">
          <Bell className="w-4 h-4" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary shadow-[0_0_14px_rgba(52,211,153,0.85)]" />
        </Button>
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="rounded-2xl border border-cyan-100/16 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(52,211,153,0.12))] shadow-[0_12px_30px_-20px_rgba(34,211,238,0.65)] hover:border-cyan-100/26 hover:bg-cyan-100/[0.07]">
            <User className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </Link>
      </div>
      </div>
    </header>
  );
}
