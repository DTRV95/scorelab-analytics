import { Bell, Download, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function TopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-cyan-200/10 bg-[linear-gradient(180deg,rgba(12,29,46,0.78)_0%,rgba(9,21,36,0.84)_100%)] px-6 backdrop-blur-xl shadow-[0_12px_40px_-28px_rgba(34,211,238,0.25)]">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search matches, markets..."
            className="h-9 w-64 pl-9 pr-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Download className="w-4 h-4" strokeWidth={1.5} />
        </Button>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
        </Button>
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="rounded-full">
            <User className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </Link>
      </div>
    </header>
  );
}
