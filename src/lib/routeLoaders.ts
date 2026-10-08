/**
 * Every page, as the function that fetches it.
 *
 * Each page is its own download, which keeps the first load small and makes
 * every later one a wait — a tap on Jogos went to the network before anything
 * could move. Naming the loaders in one place lets the app ask for the pages
 * somebody is about to want while nothing else is happening, so the tap has
 * nothing left to fetch.
 */
export const routeLoaders = {
  landing: () => import("@/pages/Landing"),
  login: () => import("@/pages/Login"),
  signup: () => import("@/pages/Signup"),
  forgotPassword: () => import("@/pages/ForgotPassword"),
  resetPassword: () => import("@/pages/ResetPassword"),
  home: () => import("@/pages/Home"),
  analyses: () => import("@/pages/Analyses"),
  matchAnalysis: () => import("@/pages/MatchAnalysis"),
  probability: () => import("@/pages/ProbabilityRadar"),
  modelLab: () => import("@/pages/ModelLab"),
  accuracy: () => import("@/pages/ModelAccuracy"),
  leagues: () => import("@/pages/Leagues"),
  matchDeepDive: () => import("@/pages/MatchDeepDive"),
  challenge: () => import("@/pages/Challenges"),
  challenges: () => import("@/pages/ChallengeCatalogue"),
  bettorAnalysis: () => import("@/pages/BettorAnalysis"),
  bankroll: () => import("@/pages/BankrollTools"),
  looseBets: () => import("@/pages/LooseBets"),
  settings: () => import("@/pages/Settings"),
  notFound: () => import("@/pages/NotFound"),
} as const;

export type RouteKey = keyof typeof routeLoaders;

/**
 * The pages reachable in one tap from Início, in the order they get tapped.
 *
 * Not everything: a page nobody opens is a download somebody paid for on a
 * phone connection for nothing.
 */
const WARM: RouteKey[] = [
  "challenge",
  "probability",
  "challenges",
  "looseBets",
  "leagues",
  "bankroll",
];

let warmed = false;

/** Fetches those pages while the browser has nothing better to do. */
export function warmRoutes(keys: RouteKey[] = WARM) {
  if (warmed) return;
  warmed = true;

  const run = () => {
    for (const key of keys) {
      // A page that fails to prefetch is not a failure: the tap fetches it
      // again, the normal way.
      void routeLoaders[key]().catch(() => undefined);
    }
  };

  const idle = (
    window as typeof window & {
      requestIdleCallback?: (callback: () => void) => number;
    }
  ).requestIdleCallback;

  if (idle) idle(run);
  else window.setTimeout(run, 1200);
}

/** For tests, which need each one to start from cold. */
export function forgetWarmedRoutes() {
  warmed = false;
}
