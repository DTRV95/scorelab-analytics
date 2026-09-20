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
