import { AppLayout } from "@/components/layout/AppLayout";
import { ValueBadge, DecisionBadge } from "@/components/ValueBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Download, Search } from "lucide-react";

const history = [
  { id: 1, match: "Arsenal vs Chelsea", market: "Over 2.5", edge: 11.8, confidence: 9, decision: "Bet" as const, date: "2026-03-16" },
  { id: 2, match: "Liverpool vs Man City", market: "BTTS", edge: 5.2, confidence: 7, decision: "Bet" as const, date: "2026-03-16" },
  { id: 3, match: "Tottenham vs Newcastle", market: "Under 3.5", edge: -2.1, confidence: 4, decision: "No Bet" as const, date: "2026-03-15" },
  { id: 4, match: "Man Utd vs Wolves", market: "Over 2.5", edge: 3.8, confidence: 6, decision: "Caution" as const, date: "2026-03-15" },
  { id: 5, match: "Bayern vs Dortmund", market: "Over 3.5", edge: 7.1, confidence: 7, decision: "Bet" as const, date: "2026-03-14" },
  { id: 6, match: "Barcelona vs Real Madrid", market: "Over 2.5", edge: 8.3, confidence: 8, decision: "Bet" as const, date: "2026-03-14" },
  { id: 7, match: "PSG vs Marseille", market: "BTTS", edge: 4.2, confidence: 6, decision: "Caution" as const, date: "2026-03-13" },
  { id: 8, match: "Juventus vs AC Milan", market: "Under 2.5", edge: 5.8, confidence: 7, decision: "Bet" as const, date: "2026-03-13" },
];

export default function History() {
  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analysis History</h1>
            <p className="text-sm text-muted-foreground mt-1">Review and export your past analyses.</p>
          </div>
          <Button variant="outline" size="sm"><Download className="w-4 h-4 mr-1" strokeWidth={1.5} /> Export All</Button>
        </div>

        <div className="rounded-xl bg-card ring-surface p-4 card-shadow mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Search analyses..."
              className="w-full h-9 pl-9 pr-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl bg-card ring-surface card-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Date", "Match", "Market", "Edge", "Confidence", "Decision", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer">
                    <td className="px-5 py-3.5 text-muted-foreground font-mono-data text-xs">{h.date}</td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{h.match}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{h.market}</td>
                    <td className="px-5 py-3.5"><ValueBadge value={h.edge} /></td>
                    <td className="px-5 py-3.5"><ConfidenceMeter score={h.confidence} className="w-20" /></td>
                    <td className="px-5 py-3.5"><DecisionBadge decision={h.decision} /></td>
                    <td className="px-5 py-3.5">
                      <Button variant="ghost" size="sm" className="text-xs">View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
