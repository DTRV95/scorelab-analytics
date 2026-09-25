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
import { ProtectedRoute, OwnerRoute } from "@/components/ProtectedRoute";

const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MatchAnalysis = lazy(() => import("./pages/MatchAnalysis"));
const ProbabilityRadar = lazy(() => import("./pages/ProbabilityRadar"));
const ValueRadar = lazy(() => import("./pages/ValueRadar"));
const ModelLab = lazy(() => import("./pages/ModelLab"));
const ModelAccuracy = lazy(() => import("./pages/ModelAccuracy"));
const MatchDeepDive = lazy(() => import("./pages/MatchDeepDive"));
const MillionPlan = lazy(() => import("./pages/MillionPlan"));
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
      <div className="sl-card px-6 py-5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          ScoreLab Sync
        </p>
        <p className="mt-3 text-sm text-foreground">
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
      // Never hold first paint hostage to a slow connection: after 2.5s we
      // render with the local cache and let the sync finish in background.
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
      await Promise.race([hydrateStorageFromServer(), timeout]);
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
                    <Route path="/probability" element={<ProtectedRoute><ProbabilityRadar /></ProtectedRoute>} />
                    <Route path="/radar" element={<ProtectedRoute><ValueRadar /></ProtectedRoute>} />
                    <Route path="/plano" element={<ProtectedRoute><MillionPlan /></ProtectedRoute>} />
                    <Route path="/match/:fixtureId" element={<ProtectedRoute><MatchDeepDive /></ProtectedRoute>} />
                    <Route path="/accuracy" element={<ProtectedRoute><ModelAccuracy /></ProtectedRoute>} />
                    <Route path="/model-lab" element={<ProtectedRoute><OwnerRoute><ModelLab /></OwnerRoute></ProtectedRoute>} />
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
