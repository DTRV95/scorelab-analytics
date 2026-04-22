import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import MatchAnalysis from "./pages/MatchAnalysis";
import ValueRadar from "./pages/ValueRadar";
import History from "./pages/History";
import HistoryMultiples from "./pages/HistoryMultiples";
import BankrollTools from "./pages/BankrollTools";
import RoadmapPlanner from "./pages/RoadmapPlanner";
import PricingPage from "./pages/PricingPage";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import { hydrateStorageFromServer } from "@/lib/persistenceSync";


const queryClient = new QueryClient();

const App = () => {
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      await hydrateStorageFromServer();
      if (isMounted) {
        setIsHydrating(false);
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {isHydrating ? (
          <div className="flex min-h-screen items-center justify-center bg-background px-6">
            <div className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] px-6 py-5 text-center shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/50">
                ScoreLab Sync
              </p>
              <p className="mt-3 text-sm text-white/72">
                Loading your saved workspace...
              </p>
            </div>
          </div>
        ) : (
          <BrowserRouter>
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analysis" element={<MatchAnalysis />} />
                <Route path="/radar" element={<ValueRadar />} />
                <Route path="/history" element={<History />} />
                <Route path="/history-multiples" element={<HistoryMultiples />} />
                <Route path="/bankroll" element={<BankrollTools />} />
                <Route path="/roadmap" element={<RoadmapPlanner />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AnimatePresence>
          </BrowserRouter>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
