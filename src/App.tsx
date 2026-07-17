import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { hydrateStorageFromServer } from "@/lib/persistenceSync";
import { ScoreLabCommandCenter } from "@/components/ScoreLabCommandCenter";
import { ScoreLabDataProvider } from "@/contexts/ScoreLabDataContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MatchAnalysis = lazy(() => import("./pages/MatchAnalysis"));
const ValueRadar = lazy(() => import("./pages/ValueRadar"));
const ModelLab = lazy(() => import("./pages/ModelLab"));
const History = lazy(() => import("./pages/History"));
const HistoryMultiples = lazy(() => import("./pages/HistoryMultiples"));
const BankrollTools = lazy(() => import("./pages/BankrollTools"));
const RoadmapPlanner = lazy(() => import("./pages/RoadmapPlanner"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));

function AppLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(8,18,40,0.96)_0%,rgba(4,11,28,0.98)_100%)] px-6 py-5 text-center shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-100/50">
          ScoreLab Sync
        </p>
        <p className="mt-3 text-sm text-white/72">
          Loading your workspace...
        </p>
      </div>
    </div>
  );
}

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
          <AppLoadingState />
        ) : (
          <BrowserRouter>
            <AuthProvider>
            <ScoreLabDataProvider>
              <ScoreLabCommandCenter />
              <Suspense fallback={<AppLoadingState />}>
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/analysis" element={<ProtectedRoute><MatchAnalysis /></ProtectedRoute>} />
                    <Route path="/radar" element={<ProtectedRoute><ValueRadar /></ProtectedRoute>} />
                    <Route path="/model-lab" element={<ProtectedRoute><ModelLab /></ProtectedRoute>} />
                    <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                    <Route path="/history-multiples" element={<ProtectedRoute><HistoryMultiples /></ProtectedRoute>} />
                    <Route path="/bankroll" element={<ProtectedRoute><BankrollTools /></ProtectedRoute>} />
                    <Route path="/roadmap" element={<ProtectedRoute><RoadmapPlanner /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </AnimatePresence>
              </Suspense>
            </ScoreLabDataProvider>
            </AuthProvider>
          </BrowserRouter>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
