import { AuthAside } from "@/components/AuthAside";
import { Button } from "@/components/ui/button";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { session, loading, signIn } = useAuth();
  const navigate = useNavigate();

  if (!loading && session) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await signIn(email.trim(), password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <AuthAside
        title="Continua de onde ficaste."
        lead="Os desafios a decorrer, o nível a que vais e a aposta que falta registar hoje."
        points={[
          "Onze competições com jogos, previsões e resultados automáticos",
          "Cada aposta comparada com o que a liga costuma dar",
          "O teu registo, por mercado e por faixa de odd",
        ]}
      />

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black text-white"
              style={{ background: "var(--sl-gradient)" }}
            >
              SL
            </span>
            <span className="text-[15px] font-black tracking-[-0.02em] text-foreground">
              ScoreLab
            </span>
          </Link>

          <h1 className="text-2xl font-bold text-foreground">Entrar</h1>
          <p className="text-sm text-muted-foreground mt-1">Introduz as tuas credenciais para continuar.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Palavra-passe</label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueceste-te?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-lg input-surface text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">{error}</p>
            )}
            <Button type="submit" variant="hero" className="w-full" size="lg" disabled={submitting}>
              {submitting ? "A entrar..." : "Entrar"} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ainda não tens conta?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">Criar conta</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
