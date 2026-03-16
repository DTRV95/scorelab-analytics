import { Bell, Download, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function TopBar() {
  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
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
