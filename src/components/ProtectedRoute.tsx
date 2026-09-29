import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isOwnerEmail } from "@/lib/ownerAccess";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

/**
 * The front door.
 *
 * Signed in, it opens on Início; signed out, on the page that explains what
 * this is. Before this, somebody with a session who opened the app landed on
 * the sales page and had to find their way in from there.
 *
 * It waits for the session to be known rather than guessing: redirecting on a
 * session that has not loaded yet would send everybody to the sales page for a
 * blink on every single visit.
 */
export function FrontDoor({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

// Unlisted pages (e.g. Model Lab's calibration internals). Nothing in the app
// navigates here; the route stays reachable by URL for the account that owns
// this deployment, and redirects everyone else.
export function OwnerRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!isOwnerEmail(user?.email)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
