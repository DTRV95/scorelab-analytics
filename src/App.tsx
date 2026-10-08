import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { hydrateStorageFromServer } from "@/lib/persistenceSync";
import { routeLoaders, warmRoutes } from "@/lib/routeLoaders";
import { OpenOnHome } from "@/components/OpenOnHome";
import { PageTransition } from "@/components/PageTransition";
import { RouteProgress } from "@/components/RouteProgress";
import { ScoreLabCommandCenter } from "@/components/ScoreLabCommandCenter";
import { ScoreLabDataProvider } from "@/contexts/ScoreLabDataContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlanBoardProvider } from "@/contexts/PlanBoardContext";
import { FrontDoor, ProtectedRoute, OwnerRoute } from "@/components/ProtectedRoute";

const Landing = lazy(routeLoaders.landing);
const Login = lazy(routeLoaders.login);
const Signup = lazy(routeLoaders.signup);
const ForgotPassword = lazy(routeLoaders.forgotPassword);
const Home = lazy(routeLoaders.home);
const Analyses = lazy(routeLoaders.analyses);
const MatchAnalysis = lazy(routeLoaders.matchAnalysis);
const ProbabilityRadar = lazy(routeLoaders.probability);
const ModelLab = lazy(routeLoaders.modelLab);
const ModelAccuracy = lazy(routeLoaders.accuracy);
const Leagues = lazy(routeLoaders.leagues);
const MatchDeepDive = lazy(routeLoaders.matchDeepDive);
const Challenges = lazy(routeLoaders.challenge);
const ChallengeCatalogue = lazy(routeLoaders.challenges);
const BettorAnalysis = lazy(routeLoaders.bettorAnalysis);
const BankrollTools = lazy(routeLoaders.bankroll);
const LooseBets = lazy(routeLoaders.looseBets);
const ResetPassword = lazy(routeLoaders.resetPassword);
const Settings = lazy(routeLoaders.settings);
const NotFound = lazy(routeLoaders.notFound);

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // In the background, not in the way.
    //
    // This used to hold the entire app behind a loading card for as long as
    // two and a half seconds on every single visit, to copy some stored
    // analyses down from the server. Everything that reads them already
    // listens for the event it fires when it lands, so the app can be on
    // screen while it happens.
    void hydrateStorageFromServer().catch(() => undefined);

    // And the pages one tap away are fetched while nothing is happening, so
    // the tap itself has nothing left to wait for.
    warmRoutes();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
          <BrowserRouter>
            <AuthProvider>
            <PlanBoardProvider>
            <ScoreLabDataProvider>
              <OpenOnHome />
              <ScoreLabCommandCenter />
              <Suspense fallback={<RouteProgress />}>
                <PageTransition>
                  <Routes>
                    <Route path="/" element={<FrontDoor><Landing /></FrontDoor>} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/dashboard/analises" element={<ProtectedRoute><Analyses /></ProtectedRoute>} />
                    <Route path="/analysis" element={<ProtectedRoute><MatchAnalysis /></ProtectedRoute>} />
                    <Route path="/probability" element={<ProtectedRoute><ProbabilityRadar /></ProtectedRoute>} />
                    <Route path="/desafios" element={<ProtectedRoute><ChallengeCatalogue /></ProtectedRoute>} />
                    <Route path="/desafios/:planId/analise" element={<ProtectedRoute><BettorAnalysis /></ProtectedRoute>} />
                    <Route path="/desafios/:planId" element={<ProtectedRoute><Challenges /></ProtectedRoute>} />
                    {/* The tab was "Plano" before it held more than one challenge. */}
                    <Route path="/plano" element={<Navigate to="/desafios" replace />} />
                    <Route path="/match/:fixtureId" element={<ProtectedRoute><MatchDeepDive /></ProtectedRoute>} />
                    <Route path="/ligas" element={<ProtectedRoute><Leagues /></ProtectedRoute>} />
                    <Route path="/accuracy" element={<ProtectedRoute><ModelAccuracy /></ProtectedRoute>} />
                    <Route path="/model-lab" element={<ProtectedRoute><OwnerRoute><ModelLab /></OwnerRoute></ProtectedRoute>} />
                    <Route path="/bankroll" element={<ProtectedRoute><BankrollTools /></ProtectedRoute>} />
                    <Route path="/apostas" element={<ProtectedRoute><LooseBets /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </PageTransition>
              </Suspense>
            </ScoreLabDataProvider>
            </PlanBoardProvider>
            </AuthProvider>
          </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
