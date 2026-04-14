import { Bell, Download, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { downloadScoreLabExport } from "@/lib/exportData";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-cyan-200/10 bg-[linear-gradient(180deg,rgba(11,28,45,0.72)_0%,rgba(8,20,35,0.84)_100%)] px-5 backdrop-blur-2xl shadow-[0_16px_48px_-28px_rgba(34,211,238,0.28)] md:px-6">
      <div className="flex h-16 items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search matches, markets..."
            className="h-10 w-56 rounded-2xl border border-white/8 bg-white/[0.04] pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-300/20 transition-all md:w-72"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={downloadScoreLabExport}
          title="Download ScoreLab export"
          className="relative rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
        >
          <Download className="w-4 h-4" strokeWidth={1.5} />
        </Button>
        <Button variant="ghost" size="icon" className="relative rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06]">
          <Bell className="w-4 h-4" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
        </Button>
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(34,197,94,0.08))] hover:bg-white/[0.06]">
            <User className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </Link>
      </div>
      </div>
    </header>
  );
}
