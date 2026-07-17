import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { BarChart3, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { session, loading, updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const result = await updatePassword(password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <span className="font-bold text-lg text-foreground">ScoreLab</span>
        </div>

        {!loading && !session ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Link expired</h1>
            <p className="text-sm text-muted-foreground mt-2">
              This password reset link is invalid or has expired. Request a new one.
            </p>
            <Link to="/forgot-password" className="mt-6 inline-block text-sm text-primary hover:underline font-medium">
              Request new link
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-foreground">Set new password</h1>
            <p className="text-sm text-muted-foreground mt-1">Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive" role="alert">{error}</p>
              )}
              <Button type="submit" variant="hero" className="w-full" size="lg" disabled={submitting}>
                {submitting ? "Saving..." : "Save New Password"}
              </Button>
            </form>
          </>
        )}

        <Link to="/login" className="flex items-center justify-center gap-2 mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>
      </div>
    </div>
  );
}
